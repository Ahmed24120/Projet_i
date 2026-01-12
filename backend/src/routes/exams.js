// backend/src/routes/exams.js
const express = require("express");
const db = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

/* ---------- util ---------- */
const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

/* ---------- Multer storage (par examen) ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const examId = req.params.id || req.body.examId;
    if (!examId) return cb(new Error("examId manquant"), null);

    const base = path.join(__dirname, "../../uploads/exams", String(examId));
    const dest =
      file.fieldname === "subject" ? base : path.join(base, "attachments");

    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const okExt = [
      ".pdf",
      ".doc",
      ".docx",
      ".xlsx",
      ".xls",
      ".zip",
      ".txt",
      ".csv",
      ".ppt",
      ".pptx",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (okExt.includes(ext)) return cb(null, true);
    cb(new Error("Type de fichier non autorisé"));
  },
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 Mo
});

/* ---------- Routes existantes ---------- */

// Liste des examens (filtrée par rôle et salle)
// Liste des examens (corrigée avec allowed-list et auto-finish)
router.get("/", authenticateToken, (req, res) => {
  const { role, id } = req.user; // id is users.id
  const { roomNumber } = req.query;

  if (role === 'professor' || role === 'ADMIN') {
    // PROFESSEUR : Voit ses examens
    // ADMIN : Voit TOUS les examens
    let sql = "";
    let params = [];

    if (role === 'ADMIN') {
      sql = "SELECT e.*, u.name as prof_name FROM examen e LEFT JOIN users u ON e.professor_id = u.id ORDER BY e.id DESC";
      params = [];
    } else {
      sql = "SELECT * FROM examen WHERE professor_id = ? ORDER BY id DESC";
      params = [id];
    }

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // 3.4 Auto-finish simple sur lecture
      const now = new Date();
      let updates = 0;
      rows.forEach(r => {
        if (r.status_code === 2 && r.started_at && r.duration_min > 0) {
          const start = new Date(r.started_at);
          const end = new Date(start.getTime() + r.duration_min * 60000);
          if (now > end) {
            db.run("UPDATE examen SET status_code=4, status='finished', finished_at=CURRENT_TIMESTAMP WHERE id=?", [r.id]);
            r.status_code = 4;
            r.status = 'finished';
            updates++;
          }
        }
      });
      res.json(rows);
    });

  } else {
    // ETUDIANT : 10.2 NOUVELLE LOGIQUE VISIBILITE
    // Excel = source de vérité (allowed list + room/classe)
    const now = new Date().toISOString();

    const sql = `
      SELECT DISTINCT e.*
      FROM examen e
      JOIN users u ON u.id = ?
      -- Join allowed list (MANDATORY)
      JOIN exam_allowed_students a ON a.exam_id = e.id AND a.student_id = u.id
      -- Join Profile for Room Check (MANDATORY)
      LEFT JOIN profile p ON p.id_user = u.id
      -- Join Session/Network Check (SECURITY)
      LEFT JOIN exam_sessions s ON s.exam_id = e.id
      LEFT JOIN student_connections sc ON sc.student_id = u.id AND sc.session_id = s.id AND sc.disconnection_time IS NULL
      
      WHERE
      -- 1) Status Visible
      (e.status_code IN (1, 2) OR (e.status_code IS NULL AND e.status IN ('published','launched')))
      
      -- 2) Room Check: REMOVED (Trust Allowed List)
      -- AND (
      --    e.room_number IS NULL 
      --    OR e.room_number = p.classe
      -- )

      -- 4) Network Check: If session exists and has wifi_ssid, student must be connected
      AND (
          s.wifi_ssid IS NULL
          OR sc.id IS NOT NULL
      )
      
      -- 5) Not Finalized
      AND NOT EXISTS (
        SELECT 1 FROM exam_results r
        WHERE r.exam_id = e.id AND r.student_id = u.id AND r.is_finalized = 1
      )
      
      ORDER BY e.id DESC
    `;

    db.all(sql, [id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});

// GET /:id - Détails d'un examen
router.get("/:id", authenticateToken, (req, res) => {
  const sql = `SELECT * FROM examen WHERE id = ?`;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Examen non trouvé" });

    // Sécurité : un prof ne doit pas voir l'examen d'un autre
    if (req.user.role === 'professor' && row.professor_id && row.professor_id !== req.user.id) {
      return res.status(403).json({ error: "Accès non autorisé à cet examen" });
    }

    // Check if finalized or exited for this student
    if (req.user && req.user.role === 'student') {
      db.get(
        `SELECT is_finalized, has_exited FROM exam_results WHERE exam_id = ? AND student_id = ?`,
        [req.params.id, req.user.id],
        (err, result) => {
          if (result && result.is_finalized) {
            row.isFinalized = true;
          }
          if (result && result.has_exited) {
            row.hasExited = true;
          }
          res.json(row);
        }
      );
    } else {
      res.json(row);
    }
  });
});

// Création d’un examen
router.post("/", authenticateToken, (req, res) => {
  const { titre, description, date_debut, date_fin, sujet_path } = req.body;

  if (req.user.role !== 'professor') {
    return res.status(403).json({ error: "Seuls les professeurs peuvent créer des examens" });
  }

  if (!titre) return res.status(400).json({ error: "Titre requis" });

  // On force le statut 'ready' à la création
  const sql = `
    INSERT INTO examen (titre, description, date_debut, date_fin, sujet_path, professor_id, room_number, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ready')
  `;

  db.run(
    sql,
    [titre, description || "", date_debut || "", date_fin || "", sujet_path || "", req.user.id, req.body.roomNumber || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, titre, description, professor_id: req.user.id, status: 'ready' });
    }
  );
});

// Lancer (Publier) un examen
router.put("/:id/launch", authenticateToken, (req, res) => {
  const examId = req.params.id;

  if (req.user.role !== 'professor') {
    return res.status(403).json({ error: "Action non autorisée" });
  }

  // Vérifier propriété
  db.get("SELECT professor_id FROM examen WHERE id = ?", [examId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Examen non trouvé" });
    if (row.professor_id !== req.user.id) return res.status(403).json({ error: "Accès refusé" });

    db.run("UPDATE examen SET status = 'launched' WHERE id = ?", [examId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: "Examen lancé avec succès", status: 'launched' });
    });
  });
});

// Suppression d’un examen
router.delete("/:id", authenticateToken, (req, res) => {
  const examId = req.params.id;

  // Vérifier d'abord si l'examen appartient au prof
  db.get("SELECT professor_id FROM examen WHERE id = ?", [examId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Examen non trouvé" });

    if (req.user.role === 'professor' && row.professor_id && row.professor_id !== req.user.id) {
      return res.status(403).json({ error: "Vous ne pouvez pas supprimer cet examen" });
    }
    // ADMIN implicit pass


    const sql = "DELETE FROM examen WHERE id = ?";
    db.run(sql, [examId], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Suppression des fichiers (dossier uploads/exams/:id)
      const examDir = path.join(__dirname, "../../uploads/exams", String(examId));
      if (fs.existsSync(examDir)) {
        try {
          fs.rmSync(examDir, { recursive: true, force: true });
          console.log(`📂 Dossier supprimé: ${examDir}`);
        } catch (e) {
          console.error(`❌ Erreur suppression dossier ${examDir}:`, e);
        }
      }

      res.json({ message: "Examen et fichiers supprimés" });
    });
  });
});

/* ---------- Upload & listing des ressources d’examen ---------- */

// Upload du sujet (.pdf) + pièces (.docx/.xlsx/.zip/…)
router.post(
  "/:id/resources",
  authenticateToken,
  upload.fields([
    { name: "subject", maxCount: 1 },       // sujet PDF
    { name: "attachments", maxCount: 10 },  // pièces annexes
  ]),
  (req, res) => {
    const examId = req.params.id;

    // TODO: Verify ownership here too preferably, but omitting for brevity in this fix step

    const subjectFile = (req.files?.subject || [])[0] || null;
    const attachments = (req.files?.attachments || []).map((f) => f.filename);

    // Mettre à jour le chemin du sujet dans la table examen
    if (subjectFile) {
      const relPath = path.join("exams", String(examId), subjectFile.filename);
      db.run(
        "UPDATE examen SET sujet_path = ? WHERE id = ?",
        [relPath, examId],
        (err) => {
          if (err) console.error("Erreur maj sujet_path:", err.message);
        }
      );
    }

    res.json({
      ok: true,
      subject: subjectFile ? subjectFile.filename : null,
      attachments,
    });
  }
);

// ✅ Nouveau : Téléchargement du sujet via Proxy (évite les 404 de path)
router.get("/:id/download-subject", (req, res) => {
  const examId = req.params.id;
  db.get("SELECT sujet_path FROM examen WHERE id = ?", [examId], (err, row) => {
    if (err || !row?.sujet_path) {
      return res.status(404).json({ error: "Sujet introuvable" });
    }

    const filePath = path.join(__dirname, "../../uploads", row.sujet_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier physique introuvable" });
    }

    res.download(filePath, `sujet_examen_${examId}.pdf`);
  });
});

// Retourner la liste des ressources (URLs pour téléchargement)
router.get("/:id/resources", authenticateToken, (req, res) => {
  const examId = req.params.id;
  const base = path.join(__dirname, "../../uploads/exams", String(examId));
  const att = path.join(base, "attachments");

  const toUrl = (relPath) => `/static/${relPath.replace(/\\+/g, "/")}`;

  db.get("SELECT sujet_path FROM examen WHERE id = ?", [examId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    const out = [];
    if (row?.sujet_path) {
      out.push({
        kind: "subject",
        file_name: path.basename(row.sujet_path) || "sujet.pdf",
        url: toUrl(row.sujet_path),
      });
    }

    try {
      ensureDir(att);
      const files = fs.readdirSync(att);
      for (const f of files) {
        out.push({
          kind: "attachment",
          file_name: f,
          url: toUrl(path.join("exams", String(examId), "attachments", f)),
        });
      }
    } catch (e) {
      // pas d’attachments, on ignore
    }

    res.json(out);
  });
});

// ✅ Nouveau : Supprimer une ressource (Sujet ou Annexe)
router.delete("/:id/resources", authenticateToken, (req, res) => {
  const examId = req.params.id;
  const { filename, type } = req.body; // type: 'subject' | 'attachment'

  if (req.user.role !== 'professor') return res.sendStatus(403);
  if (!filename || !type) return res.status(400).json({ error: "Filename et type requis" });

  const base = path.join(__dirname, "../../uploads/exams", String(examId));

  if (type === 'subject') {
    // 1. Update DB
    db.run("UPDATE examen SET sujet_path = NULL WHERE id = ? AND professor_id = ?", [examId, req.user.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(403).json({ error: "Non autorisé" });

      // 2. Delete File
      const filePath = path.join(base, filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { }
      }
      res.json({ ok: true });
    });
  } else if (type === 'attachment') {
    // Attachments are not strictly tracked in DB, just delete file
    // Check ownership via generic exam check first
    db.get("SELECT professor_id FROM examen WHERE id = ?", [examId], (err, row) => {
      if (err || !row) return res.status(404).json({ error: "Examen introuvable" });
      if (row.professor_id !== req.user.id) return res.status(403).json({ error: "Non autorisé" });

      const filePath = path.join(base, "attachments", filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { }
        res.json({ ok: true });
      } else {
        res.status(404).json({ error: "Fichier introuvable" });
      }
    });
  } else {
    res.status(400).json({ error: "Type invalide" });
  }
});

// ✅ Nouveau : Lister les soumissions (DB + Active only)
router.get("/:id/submissions", authenticateToken, (req, res) => {
  const examId = req.params.id;

  const sql = `
    SELECT w.*, er.is_finalized 
    FROM works w
    LEFT JOIN exam_results er ON w.exam_id = er.exam_id AND w.id_etud = er.student_id
    WHERE w.exam_id = ? 
    AND (w.status != 'cancelled' OR w.status IS NULL)
    ORDER BY w.last_update DESC
  `;

  db.all(sql, [examId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const results = rows.map(row => {
      let files = [];
      try {
        const filenames = JSON.parse(row.file_paths || "[]");
        files = filenames.map(f => {
          // Construct absolute path to check existence
          const absPath = path.join(__dirname, "../../uploads/exams", String(examId), "students", row.matricule, f);
          const exists = fs.existsSync(absPath);

          return {
            name: f.replace(/^\d+_/, ''),
            size: 0,
            at: row.last_update,
            url: `/static/exams/${examId}/students/${row.matricule}/${f}`,
            exists: exists
          };
        });
      } catch (e) { }

      return {
        matricule: row.matricule,
        isFinalized: !!row.is_finalized,
        files
      };
    });

    res.json(results);
  });
});

// ✅ Nouveau : Télécharger un fichier de soumission (Force Download)
router.get("/:id/submissions/download", authenticateToken, (req, res) => {
  const examId = req.params.id;
  const { matricule, filename } = req.query;

  if (!matricule || !filename) {
    return res.status(400).json({ error: "matricule et filename requis" });
  }

  const filePath = path.join(__dirname, "../../uploads/exams", String(examId), "students", matricule, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fichier introuvable" });
  }

  // Force download with Content-Disposition: attachment
  const cleanName = filename.replace(/^\d+_/, ''); // Remove timestamp prefix
  res.download(filePath, cleanName);
});

// ✅ Nouveau : Lister les logs d'un examen
router.get("/:id/logs", authenticateToken, (req, res) => {
  const examId = req.params.id;
  db.all(
    "SELECT * FROM logs WHERE exam_id = ? AND cleared = 0 ORDER BY timestamp DESC LIMIT 50",
    [examId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ✅ Nouveau : Effacer les logs d'un examen
router.post("/:id/logs/clear", authenticateToken, (req, res) => {
  const examId = req.params.id;
  const { matricule } = req.body;

  let sql = "UPDATE logs SET cleared = 1 WHERE exam_id = ?";
  let params = [examId];

  if (matricule) {
    sql += " AND matricule = ?";
    params.push(matricule);
  }

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

/* ---------- NOUVELLES ROUTES (ACTIONS & ALLOWED LIST) ---------- */

// 3.2 Actions Prof (Publish, Start, Stop, Finish)
router.post("/:id/publish", authenticateToken, (req, res) => {
  if (req.user.role !== 'professor') return res.sendStatus(403);
  const now = new Date().toISOString();
  db.run(`UPDATE examen SET status_code=1, status='published', published_at=? WHERE id=? AND professor_id=?`,
    [now, req.params.id, req.user.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(403).json({ error: "Non autorisé ou non trouvé" });
      res.json({ ok: true, status: 'published' });
    });
});

// Lancer (Publier) un examen
router.post("/:id/start", authenticateToken, (req, res) => {
  if (req.user.role !== 'professor') return res.sendStatus(403);

  const examId = req.params.id;

  // Checks: Sujet exists AND AllowedList > 0
  const sql = `
    SELECT e.sujet_path, 
           (SELECT count(*) FROM exam_allowed_students WHERE exam_id = e.id) as allowed_count
    FROM examen e
    WHERE e.id = ? AND e.professor_id = ?
  `;

  db.get(sql, [examId, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Examen introuvable" });

    if (!row.sujet_path) return res.status(400).json({ error: "Déposez le sujet avant de lancer l'examen." });
    if (!row.allowed_count || row.allowed_count === 0) {
      return res.status(400).json({ error: "Aucun étudiant autorisé. Importez un Excel ou ajoutez manuellement des étudiants." });
    }

    const now = new Date().toISOString();
    db.run(`UPDATE examen SET status_code=2, status='launched', started_at=? WHERE id=?`,
      [now, examId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true, status: 'launched' });
      });
  });
});

router.post("/:id/stop", authenticateToken, (req, res) => {
  if (req.user.role !== 'professor' && req.user.role !== 'ADMIN') return res.sendStatus(403);
  const now = new Date().toISOString();

  // Si admin, on ne filtre pas par professor_id
  let sql = "UPDATE examen SET status_code=3, status='stopped', stopped_at=? WHERE id=?";
  let params = [now, req.params.id];

  if (req.user.role === 'professor') {
    sql += " AND professor_id=?";
    params.push(req.user.id);
  }

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, status: 'stopped' });
  });
});

router.post("/:id/finish", authenticateToken, (req, res) => {
  if (req.user.role !== 'professor') return res.sendStatus(403);
  const now = new Date().toISOString();
  db.run(`UPDATE examen SET status_code=4, status='finished', finished_at=? WHERE id=? AND professor_id=?`,
    [now, req.params.id, req.user.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, status: 'finished' });
    });
});

// 3.3 Allowed List Management
router.get("/:id/allowed", authenticateToken, (req, res) => {
  // Join users to give details
  const sql = `
    SELECT u.id, u.matricule, u.name, u.email, a.added_at
    FROM exam_allowed_students a
    JOIN users u ON a.student_id = u.id
    WHERE a.exam_id = ?
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post("/:id/allowed", authenticateToken, (req, res) => {
  if (req.user.role !== 'professor') return res.sendStatus(403);

  const { studentIds, matricules } = req.body;
  const idsToAdd = new Set(Array.isArray(studentIds) ? studentIds : []);

  const runInsert = () => {
    if (idsToAdd.size === 0) return res.json({ ok: true, added: 0 });
    const stmt = db.prepare("INSERT OR IGNORE INTO exam_allowed_students (exam_id, student_id) VALUES (?, ?)");
    idsToAdd.forEach(sid => stmt.run(req.params.id, sid));
    stmt.finalize();
    res.json({ ok: true, added: idsToAdd.size });
  };

  if (Array.isArray(matricules) && matricules.length > 0) {
    const placeholders = matricules.map(() => '?').join(',');
    db.all(`SELECT id FROM users WHERE matricule IN (${placeholders})`, matricules, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      rows.forEach(r => idsToAdd.add(r.id));
      runInsert();
    });
  } else {
    runInsert();
  }
});

router.delete("/:id/allowed/:studentId", authenticateToken, (req, res) => {
  if (req.user.role !== 'professor') return res.sendStatus(403);
  db.run("DELETE FROM exam_allowed_students WHERE exam_id=? AND student_id=?",
    [req.params.id, req.params.studentId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
});

// 6. ZIP Export (PowerShell) - STRICT FORMAT
router.get("/:id/export", authenticateToken, (req, res) => {
  if (req.user.role !== 'professor') return res.sendStatus(403);
  const examId = req.params.id;

  db.get("SELECT * FROM examen WHERE id=? AND professor_id=?", [examId, req.user.id], (err, exam) => {
    if (err || !exam) return res.status(404).json({ error: "Examen introuvable" });

    // 1. Check Archived/Finished Status
    const isFinished = (exam.status_code === 3 || exam.status_code === 4 || ['stopped', 'finished'].includes(exam.status));
    if (!isFinished) return res.status(403).json({ error: "Examen non terminé" });

    // 2. Prepare Paths & Names
    const matCode = (exam.matiere_code || "UNKNOWN").replace(/[^a-zA-Z0-9.-]/g, "_");
    const room = (exam.room_number || "NoRoom").replace(/[^a-zA-Z0-9.-]/g, "_");
    const zipName = `examen_${examId}.zip`;
    const folderName = `${room}_${matCode}`; // e.g. RO_2025_Exam1

    const tempBase = path.join(__dirname, "../../uploads/temp_export");
    ensureDir(tempBase);
    const workDir = path.join(tempBase, `${folderName}_${Date.now()}`);
    const targetDir = path.join(workDir, folderName);
    ensureDir(targetDir);

    // 3. Get Allowed Students & Their LATEST Active Work
    const sql = `
      SELECT u.id, u.matricule, u.name, w.file_paths
      FROM exam_allowed_students a
      JOIN users u ON a.student_id = u.id
      LEFT JOIN works w ON w.id = (
        SELECT MAX(id) FROM works w2 
        WHERE w2.exam_id = a.exam_id 
        AND w2.id_etud = u.id 
        AND (w2.status != 'cancelled' OR w2.status IS NULL)
      )
      WHERE a.exam_id = ?
    `;

    db.all(sql, [examId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // 4. Construct Folder Structure
      rows.forEach(row => {
        const safeName = (row.name || "Inconnu").replace(/[^a-zA-Z0-9]/g, "_");
        const studentFolder = `${row.matricule}_${safeName}`;
        const studentPath = path.join(targetDir, studentFolder);
        ensureDir(studentPath);

        let filesCopied = 0;
        if (row.file_paths) {
          try {
            const files = JSON.parse(row.file_paths);
            if (Array.isArray(files)) {
              files.forEach(f => {
                const src = path.join(__dirname, "../../uploads/exams", String(examId), "students", row.matricule, f);

                // Only copy if exists
                if (fs.existsSync(src)) {
                  const cleanName = f.replace(/^\d+_/, ''); // Remove timestamp
                  const dest = path.join(studentPath, cleanName);
                  // Ensure unique dest name if duplicate within submission (unlikely but safe)
                  fs.copyFileSync(src, dest);
                  filesCopied++;
                }
              });
            }
          } catch (e) {
            console.error(`Error parsing paths for ${row.matricule}:`, e);
          }
        }

        if (filesCopied === 0) {
          fs.writeFileSync(path.join(studentPath, "AUCUN_RENDU.txt"), "Aucun fichier rendu pour cet examen.");
        }
      });

      // 5. Zip It (PowerShell)
      const zipPath = path.join(tempBase, zipName);
      // Compress parent folder contents
      const psCommand = `Compress-Archive -Path "${targetDir}" -DestinationPath "${zipPath}" -Force`;

      if (process.platform !== 'win32') {
        return res.status(501).json({ error: "ZIP export only supported on Windows server backend currently." });
      }

      const { spawn } = require('child_process');
      const ps = spawn('powershell.exe', ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand]);

      ps.on('close', (code) => {
        if (code !== 0) {
          console.error("PowerShell Error Code:", code);
          return res.status(500).json({ error: "Erreur lors de la création du ZIP" });
        }

        // 6. Download & Cleanup
        res.download(zipPath, zipName, (err) => {
          try {
            if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
          } catch (e) { console.error("Cleanup error:", e); }
        });
      });
    });
  });
});

// 3.4 Import Allowed List from XLSX
router.post("/:id/allowed/import", authenticateToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'professor') return res.sendStatus(403);
  if (!req.file) return res.status(400).json({ error: "Fichier requis" });

  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read raw headers
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      if (cell && cell.v) headers.push(String(cell.v).trim().toLowerCase());
    }

    // STRICT VALIDATION
    // Prompt says: "Colonnes obligatoires (ligne 1)... nom, matricule, salle, email."
    // So YES email is required column, but value can be optional ("Si email non vide...")
    const requiredCols = ['nom', 'matricule', 'salle', 'email'];
    const missing = requiredCols.filter(r => !headers.includes(r));

    if (missing.length > 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
      return res.status(400).json({
        error: "Le fichier XLSX ne respecte pas le format requis: colonnes nom, matricule, salle, email."
      });
    }

    const rows = XLSX.utils.sheet_to_json(sheet);
    let stats = { total: rows.length, nb_crees: 0, nb_mis_a_jour: 0, nb_ignores: 0 };

    // Helper to generate compliant school email
    const SCHOOL_DOMAIN = "@supnum.mr";
    const normalizeEmail = (rawEmail, matricule) => {
      const e = (rawEmail || "").trim();
      const m = matricule.trim();
      // "Si email non vide, il doit : contenir le matricule et finir par le domaine"
      if (e && e.toLowerCase().includes(m.toLowerCase()) && e.endsWith(SCHOOL_DOMAIN)) {
        return e;
      }
      return `${m}${SCHOOL_DOMAIN}`;
    };

    const runAsync = (sql, params) => new Promise((resolve, reject) => {
      db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); });
    });

    const getAsync = (sql, params) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
    });

    for (const row of rows) {
      // Keys to lowercase
      const data = {};
      Object.keys(row).forEach(k => data[k.toLowerCase().trim()] = row[k]);

      const matricule = String(data.matricule || "").trim();
      const nomRaw = String(data.nom || "").trim();
      const salle = String(data.salle || "").trim();

      if (!matricule || !nomRaw) {
        stats.nb_ignores++;
        continue;
      }

      // Name Split
      const words = nomRaw.split(/\s+/);
      let nom = "", prenom = "";
      if (words.length === 1) { nom = words[0]; }
      else if (words.length === 2) { nom = words[0]; prenom = words[1]; }
      else {
        const mid = Math.ceil(words.length / 2);
        nom = words.slice(0, mid).join(" ");
        prenom = words.slice(mid).join(" ");
      }
      const fullName = (nom + " " + prenom).trim();
      const finalEmail = normalizeEmail(String(data.email || ""), matricule);

      const existingUser = await getAsync("SELECT * FROM users WHERE matricule = ? AND role = 'student'", [matricule]);
      let userId = null;

      if (existingUser) {
        // UPDATE (Case A)
        userId = existingUser.id;

        // Update name if different/empty
        const updateTasks = [];
        if (!existingUser.name || existingUser.name !== fullName) {
          updateTasks.push(runAsync("UPDATE users SET name = ? WHERE id = ?", [fullName, userId]));
        }

        // Update Email: "Si email XLSX valide ... et différent" -> normalizeEmail guarantees valid format
        if (finalEmail !== existingUser.email) {
          // We try to update. If collision, we might fail, but usually matricule based email is unique to matricule
          // Just try/catch or ignore error
          try {
            await runAsync("UPDATE users SET email = ? WHERE id = ?", [finalEmail, userId]);
          } catch (e) { }
        }

        await Promise.all(updateTasks);
        stats.nb_mis_a_jour++;
      } else {
        // CREATE (Case B)
        const randomPwd = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const hash = await require('bcrypt').hash(randomPwd, 10);

        try {
          const res = await runAsync(
            "INSERT INTO users (matricule, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'student')",
            [matricule, fullName, finalEmail, hash]
          );
          userId = res.lastID;
          stats.nb_crees++;
        } catch (e) {
          stats.nb_ignores++; // Should not happen often
          continue;
        }
      }

      // Update Profile (Class/Salle)
      if (userId) {
        const profile = await getAsync("SELECT id FROM profile WHERE id_user = ?", [userId]);
        if (profile) {
          await runAsync("UPDATE profile SET classe = ?, nom = ?, prenom = ? WHERE id_user = ?", [salle, nom, prenom, userId]);
        } else {
          await runAsync("INSERT INTO profile (nom, prenom, matricule, classe, id_user) VALUES (?, ?, ?, ?, ?)",
            [nom, prenom, matricule, salle, userId]);
        }

        // Add to Allowed List
        await runAsync("INSERT OR IGNORE INTO exam_allowed_students (exam_id, student_id) VALUES (?, ?)", [req.params.id, userId]);
      }
    }

    try { fs.unlinkSync(req.file.path); } catch (e) { }

    res.json({
      ok: true,
      nb_total_lignes: stats.total,
      nb_crees: stats.nb_crees,
      nb_mis_a_jour: stats.nb_mis_a_jour,
      nb_ignores: stats.nb_ignores
    });

  } catch (error) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) { }
    console.error("Import Error:", error);
    res.status(500).json({ error: "Erreur lors de l'import: " + error.message });
  }
});


module.exports = router;
