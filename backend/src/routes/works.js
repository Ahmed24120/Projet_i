const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { getIO } = require("../sockets");

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
  const { examId, studentId } = req.query;

  db.get("SELECT * FROM works WHERE id = ?", [id_work], (err, work) => {
    if (err || !work) return res.status(404).json({ error: "Travail non trouvé" });

    // UPDATE status to cancelled instead of DELETE
    db.run("UPDATE works SET status = 'cancelled' WHERE id = ?", [id_work], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      try {
        const io = getIO();
        // Broadcast legacy removal event (optional, for backward compat)
        io.to(`exam:${examId}`).emit("file-removed", { examId, studentId, workId: id_work });

        // Broadcast NEW global event for professor dashboard
        io.to('professors').emit('professor:submission-update', {
          type: 'CANCELLED',
          examId,
          studentId: studentId,
          workId: id_work,
          matricule: work.matricule
        });
      } catch (_) { }

      res.json({ ok: true });
    });
  });
});

// ✅ Envoi d’un brouillon ou travail final
router.post("/upload", upload.array("files", 100), (req, res) => {
  const { id_etud, nom, matricule, examId } = req.body;
  if (!id_etud || !examId)
    return res.status(400).json({ error: "id_etud et examId requis" });

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Veuillez sélectionner au moins un fichier" });
  }

  const fileDetails = req.files.map((f) => ({
    name: f.originalname,
    filename: f.filename,
    size: f.size,
    path: f.path
  }));

  const filePaths = JSON.stringify(fileDetails.map(f => f.filename));
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO works (exam_id, id_etud, nb_files, file_paths, nom, matricule, last_update)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(sql, [examId, id_etud, req.files.length, filePaths, nom, matricule, now], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const workId = this.lastID;

    // Notification temps réel au prof
    try {
      const io = getIO();
      io.to('professors').emit('alert', {
        type: 'SUBMISSION',
        message: `📤 الطالب ${matricule || nom} قام بتسليم ملف جديد`,
        level: 'info',
        studentId: id_etud
      });

      io.to(`exam:${examId}`).emit("file-submitted", {
        workId,
        examId,
        studentId: id_etud,
        files: fileDetails,
        at: now,
      });
    } catch (_) { }

    res.json({ ok: true, workId, files: fileDetails });
  });
});

module.exports = router;
