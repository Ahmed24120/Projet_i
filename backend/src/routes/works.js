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

// ✅ Récupération des travaux
router.get("/", (_req, res) => {
  db.all("SELECT * FROM works ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ✅ Envoi d’un brouillon ou travail final
router.post("/upload", upload.array("files", 100), (req, res) => {
  const { id_etud, nom, matricule, examId } = req.body;
  if (!id_etud || !examId)
    return res.status(400).json({ error: "id_etud et examId requis" });

  const fileNames = req.files.map((f) => f.filename);
  const filePaths = JSON.stringify(fileNames);
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO works (exam_id, id_etud, nb_files, file_paths, nom, matricule, last_update)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(sql, [examId, id_etud, fileNames.length, filePaths, nom, matricule, now], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // Notification temps réel au prof
    try {
      const io = getIO();
      io.to(`exam:${examId}`).emit("file-submitted", {
        examId,
        studentId: id_etud,
        files: fileNames,
        at: now,
      });
    } catch (_) { }

    res.json({ ok: true, files: fileNames });
  });
});

module.exports = router;
