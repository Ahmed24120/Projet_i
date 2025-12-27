// backend/src/routes/exams.js
const express = require("express");
const db = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

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

// Liste des examens
router.get("/", (_req, res) => {
  db.all("SELECT * FROM examen ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Détail d’un examen
router.get("/:id", (req, res) => {
  db.get("SELECT * FROM examen WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Examen non trouvé" });
    res.json(row);
  });
});

// Création d’un examen
router.post("/", (req, res) => {
  const { titre, description, date_debut, date_fin, sujet_path } = req.body;
  if (!titre) return res.status(400).json({ error: "Titre requis" });

  const sql = `
    INSERT INTO examen (titre, description, date_debut, date_fin, sujet_path)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [titre, description || "", date_debut || "", date_fin || "", sujet_path || ""],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, titre, description });
    }
  );
});

// Suppression d’un examen
router.delete("/:id", (req, res) => {
  const examId = req.params.id;
  const sql = "DELETE FROM examen WHERE id = ?";

  db.run(sql, [examId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Examen non trouvé" });

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

/* ---------- Upload & listing des ressources d’examen ---------- */

// Upload du sujet (.pdf) + pièces (.docx/.xlsx/.zip/…)
router.post(
  "/:id/resources",
  upload.fields([
    { name: "subject", maxCount: 1 },       // sujet PDF
    { name: "attachments", maxCount: 10 },  // pièces annexes
  ]),
  (req, res) => {
    const examId = req.params.id;
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
router.get("/:id/resources", (req, res) => {
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

// ✅ Nouveau : Lister les soumissions (fichiers physiques + records DB)
router.get("/:id/submissions", (req, res) => {
  const examId = req.params.id;
  const studentsDir = path.join(__dirname, "../../uploads/exams", String(examId), "students");

  if (!fs.existsSync(studentsDir)) {
    return res.json([]);
  }

  try {
    const folders = fs.readdirSync(studentsDir);
    const results = folders.map(matricule => {
      const folderPath = path.join(studentsDir, matricule);
      if (fs.statSync(folderPath).isDirectory()) {
        const files = fs.readdirSync(folderPath).map(f => {
          const stats = fs.statSync(path.join(folderPath, f));
          return {
            name: f,
            size: stats.size,
            at: stats.mtime,
            url: `/static/exams/${examId}/students/${matricule}/${f}`
          };
        });
        return { matricule, files };
      }
      return null;
    }).filter(Boolean);

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: "Erreur lors du scan des dossiers" });
  }
});

// ✅ Nouveau : Lister les logs d'un examen
router.get("/:id/logs", (req, res) => {
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
router.post("/:id/logs/clear", (req, res) => {
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

module.exports = router;
