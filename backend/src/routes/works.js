const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { getIO } = require("../sockets");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const UPLOADS_BASE = path.join(__dirname, "../../uploads");

const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

// 📁 Config Multer Dynamique
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { examId, matricule } = req.body;
    if (!examId || !matricule) {
      return cb(new Error("examId ou matricule manquant dans le body"), null);
    }

    const dest = path.join(UPLOADS_BASE, "exams", String(examId), "students", String(matricule));
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
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ✅ Récupération des travaux (Actifs uniquement)
router.get("/", (_req, res) => {
  db.all("SELECT * FROM works WHERE status != 'cancelled' OR status IS NULL ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ✅ Suppression d'un fichier (Annulation)
// ✅ Suppression d'un fichier (Annulation) - SOFT DELETE
router.delete("/:id_work", (req, res) => {
  const { id_work } = req.params;
  const { examId, studentId } = req.query; // Optional query params for context

  db.get("SELECT * FROM works WHERE id = ?", [id_work], (err, work) => {
    if (err || !work) return res.status(404).json({ error: "Travail non trouvé" });

    // Physical deletion
    if (work.file_paths) {
      try {
        const files = JSON.parse(work.file_paths);
        if (Array.isArray(files)) {
          files.forEach(filename => {
            const p = path.join(UPLOADS_BASE, "exams", String(work.exam_id), "students", String(work.matricule), filename);
            if (fs.existsSync(p)) {
              try { fs.unlinkSync(p); } catch (e) { console.error("File deletion error:", e); }
            }
          });
        }
      } catch (e) {
        console.error("Error parsing file_paths for deletion:", e);
      }
    }

    // UPDATE status to cancelled
    db.run("UPDATE works SET status = 'cancelled' WHERE id = ?", [id_work], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      try {
        const io = getIO();
        // Broadcast legacy removal event
        io.to(`exam:${work.exam_id}`).emit("file-removed", { examId: work.exam_id, studentId: work.id_etud, workId: id_work });

        // Broadcast NEW global event for professor dashboard
        io.to('professors').emit('professor:submission-update', {
          type: 'CANCELLED',
          examId: work.exam_id,
          studentId: work.id_etud,
          workId: id_work,
          matricule: work.matricule
        });
      } catch (_) { }

      res.json({ ok: true });
    });
  });
});

// ✅ Envoi d’un brouillon ou travail final
// ✅ Envoi d’un brouillon ou travail final (SÉCURISÉ)
router.post("/upload", authenticateToken, upload.array("files", 100), (req, res) => {
  const { examId } = req.body; // id_etud est ignoré, on utilise req.user.id
  const studentId = req.user.id;

  if (!examId) return res.status(400).json({ error: "examId requis" });
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Veuillez sélectionner au moins un fichier" });
  }

  // 1. Check Fichiers Vides
  const emptyFiles = req.files.filter(f => f.size === 0);
  if (emptyFiles.length > 0) {
    // Cleanup
    req.files.forEach(f => {
      try { fs.unlinkSync(f.path); } catch (e) { }
    });
    return res.status(400).json({ error: "Fichier vide détecté (0 octet). Upload refusé." });
  }

  // 2. Verifications DB (Statut, Allowed, Finalized)
  db.get(`
    SELECT e.status_code, e.status,
           (SELECT count(*) FROM exam_allowed_students WHERE exam_id=e.id AND student_id=?) as is_allowed,
           (SELECT count(*) FROM exam_results WHERE exam_id=e.id AND student_id=? AND is_finalized=1) as is_finalized,
           (SELECT matricule FROM users WHERE id=?) as student_matricule
    FROM examen e
    WHERE e.id = ?
  `, [studentId, studentId, studentId, examId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Examen non trouvé" });

    // Check Status (2 or launched)
    const isRunning = (row.status_code === 2 || row.status === 'launched');
    if (!isRunning) return res.status(403).json({ error: "L'examen n'est pas en cours (code=" + row.status_code + ")" });

    // Check Allowed
    if (row.is_allowed === 0) return res.status(403).json({ error: "Vous n'êtes pas autorisé à composer cet examen" });

    // Check Finalized
    if (row.is_finalized > 0) return res.status(403).json({ error: "Vous avez déjà finalisé votre rendu" });

    // OK -> Proceed
    const matricule = row.student_matricule || "unknown";

    // Save info
    const fileDetails = req.files.map((f) => ({
      name: f.originalname,
      filename: f.filename,
      size: f.size,
      path: f.path
    }));

    const filePaths = JSON.stringify(fileDetails.map(f => f.filename));
    const now = new Date().toISOString();

    // Insert or Update Work
    // Note: old endpoint used insert always, here we keep insert but add strict checks.
    // Ideally we should UPSERT if one entry per student/exam, but current DB allows multiple rows?
    // Table 'works' has id PK. We just INSERT new version (history preserved).

    const sql = `
      INSERT INTO works (exam_id, id_etud, nb_files, file_paths, nom, matricule, last_update, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    // Fallback nom ? req.body.nom is trusted blindly currently, maybe safer to query users table?
    // For now we keep req.body.nom to not break too much, but we enforce matricule from DB
    const studentName = req.body.nom || "Student";

    db.run(sql, [examId, studentId, req.files.length, filePaths, studentName, matricule, now], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const workId = this.lastID;

      // Notification temps réel
      try {
        const io = getIO();
        io.to('professors').emit('alert', {
          type: 'SUBMISSION',
          message: `📤 Rendu reçu de ${matricule} (${req.files.length} fichiers)`,
          level: 'info',
          studentId: studentId
        });

        io.to(`exam:${examId}`).emit("file-submitted", {
          workId,
          examId,
          studentId: studentId,
          files: fileDetails,
          at: now,
        });
      } catch (_) { }

      res.json({ ok: true, workId, files: fileDetails });
    });
  });
});

// ✅ Finaliser (Rendre)
router.post("/finalize", authenticateToken, (req, res) => {
  const { examId } = req.body;
  const studentId = req.user.id;

  if (!examId) return res.status(400).json({ error: "examId requis" });

  db.serialize(() => {
    // 1. Mark as finalized
    const now = new Date().toISOString();
    db.run(`
      INSERT OR REPLACE INTO exam_results (exam_id, student_id, is_finalized, finalized_at)
      VALUES (?, ?, 1, ?)
    `, [examId, studentId, now], (err) => {
      if (err) return res.status(500).json({ error: "Erreur finalize: " + err.message });

      // 2. Mark works as SUBMITTED
      db.run(`
        UPDATE works SET status='SUBMITTED', last_update=? 
        WHERE exam_id=? AND id_etud=?
      `, [now, examId, studentId], function (err2) {
        // Notification
        try {
          const io = getIO();
          io.to('professors').emit('alert', {
            type: 'SUBMISSION_FINAL',
            message: `✅ RENDU FINAL de l'étudiant ID ${studentId}`,
            level: 'success'
          });
          io.to(`exam:${examId}`).emit("student-finalized", { studentId });
        } catch (_) { }

        res.json({ ok: true, message: "Examen finalisé avec succès" });
      });
    });
  });
});

module.exports = router;
