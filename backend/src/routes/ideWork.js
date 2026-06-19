const express = require('express');
const router = express.Router();
const multer = require('multer');
const Work = require('../../models/Work');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { getIO } = require('../sockets');
const UPLOADS_BASE = path.join(__dirname, "../../uploads");
const SQL_UPLOADS = path.join(UPLOADS_BASE, 'sql');

// Ensure SQL uploads directory exists
if (!fs.existsSync(SQL_UPLOADS)) fs.mkdirSync(SQL_UPLOADS, { recursive: true });

// Multer config for SQL database file uploads (10 MB max, .sql and .db only)
const sqlUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, SQL_UPLOADS),
    filename: (req, file, cb) => {
      const uniqueName = `${req.user.id}_${req.body.examId || 'unknown'}_${Date.now()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.sql' || ext === '.db') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers .sql et .db sont autorisés'));
    }
  }
});

// GET /api/work?examId=xxx
// Récupère le brouillon de l'étudiant connecté pour un examen
router.get('/', authenticateToken, async (req, res) => {
  const { examId } = req.query;
  if (!examId) return res.status(400).json({ error: 'examId requis' });

  try {
    const work = await Work.findOne({ studentId: req.user.id, examId });
    res.json(work || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/work/init
// Initialise le langage et le fichier par défaut
router.post('/init', authenticateToken, async (req, res) => {
  const { examId, language } = req.body;
  if (!examId || !language) return res.status(400).json({ error: 'examId et language requis' });
  
  const validLanguages = ['cpp', 'php', 'python', 'html', 'sql'];
  if (!validLanguages.includes(language)) return res.status(400).json({ error: 'Langage invalide' });

  const extMap = { cpp: 'main.cpp', php: 'index.php', python: 'main.py', html: 'index.html', sql: 'requetes.sql' };

  try {
    let work = await Work.findOne({ studentId: req.user.id, examId });
    if (!work) {
      work = new Work({
        studentId: req.user.id,
        examId,
        selectedLanguage: language,
        files: [{ filename: extMap[language], content: '' }]
      });
      await work.save();
    } else if (!work.selectedLanguage) {
      work.selectedLanguage = language;
      if (work.files.length === 0) work.files.push({ filename: extMap[language], content: '' });
      await work.save();
    }
    res.json({ ok: true, work });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work/file/save
// Sauvegarde un fichier spécifique
router.post('/file/save', authenticateToken, async (req, res) => {
  const { examId, filename, content } = req.body;
  if (!examId || !filename) return res.status(400).json({ error: 'examId et filename requis' });

  try {
    const work = await Work.findOneAndUpdate(
      { studentId: req.user.id, examId, "files.filename": filename },
      { 
        $set: { 
          "files.$.content": content || '',
          "files.$.lastModified": new Date(),
          lastSavedAt: new Date()
        } 
      },
      { new: true }
    );
    if (!work) return res.status(404).json({ error: 'Fichier non trouvé ou non sélectionné' });
    res.json({ ok: true, lastSavedAt: work.lastSavedAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work/file/add
router.post('/file/add', authenticateToken, async (req, res) => {
  const { examId, filename } = req.body;
  if (!examId || !filename) return res.status(400).json({ error: 'Requis' });

  try {
    const work = await Work.findOneAndUpdate(
      { studentId: req.user.id, examId, "files.filename": { $ne: filename } },
      { $push: { files: { filename, content: '' } } },
      { new: true }
    );
    if (!work) return res.status(400).json({ error: 'Fichier existant ou travail introuvable' });
    res.json({ ok: true, files: work.files });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work/file/rename
router.post('/file/rename', authenticateToken, async (req, res) => {
  const { examId, oldFilename, newFilename } = req.body;
  if (!examId || !oldFilename || !newFilename) return res.status(400).json({ error: 'Données manquantes' });

  // 1. Sanitisation & Longueur
  const nameRegex = /^[a-zA-Z0-9._\-\s\(\)àâçéèêëîïôûùüÿñÀÂÇÉÈÊËÎÏÔÛÙÜŸÑ]+$/;
  if (!nameRegex.test(newFilename)) return res.status(400).json({ error: 'Nom de fichier invalide (caractères non autorisés)' });
  if (newFilename.length > 100) return res.status(400).json({ error: 'Nom trop long (max 100 caractères)' });

  if (oldFilename === newFilename) return res.json({ ok: true, message: 'Identique' });

  try {
    // 2. Vérifier si le nouveau nom existe déjà
    const existing = await Work.findOne({ 
      studentId: req.user.id, 
      examId, 
      "files.filename": newFilename 
    });
    if (existing) return res.status(400).json({ error: 'Un fichier avec ce nom existe déjà' });

    // 3. Renommage atomique
    const work = await Work.findOneAndUpdate(
      { studentId: req.user.id, examId, "files.filename": oldFilename },
      { $set: { "files.$.filename": newFilename } },
      { new: true }
    );

    if (!work) return res.status(404).json({ error: 'Fichier source introuvable' });
    res.json({ ok: true, files: work.files });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// POST /api/work/file/delete
router.post('/file/delete', authenticateToken, async (req, res) => {
  const { examId, filename } = req.body;
  if (!examId || !filename) return res.status(400).json({ error: 'Requis' });
  try {
    const work = await Work.findOneAndUpdate(
      { studentId: req.user.id, examId },
      { $pull: { files: { filename } } },
      { new: true }
    );
    if (!work) return res.status(404).json({ error: 'Travail introuvable' });
    res.json({ ok: true, files: work.files });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work/changeLanguage
// Permet de réinitialiser le langage choisi et vide les fichiers
router.post('/changeLanguage', authenticateToken, async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ error: 'examId requis' });

  try {
    // Clean up any uploaded SQL database file first
    const existingWork = await Work.findOne({ studentId: req.user.id, examId });
    if (existingWork?.sqlDatabaseFile?.diskFilename) {
      const oldPath = path.join(SQL_UPLOADS, existingWork.sqlDatabaseFile.diskFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Suppression physique de tout fichier de dump précédent de l'étudiant pour cet examen
    const matricule = req.user.matricule || "unknown";
    const destDir = path.join(UPLOADS_BASE, "exams", String(examId), "students", String(matricule));
    if (fs.existsSync(destDir)) {
      try {
        const filesInDir = fs.readdirSync(destDir);
        filesInDir.forEach(f => {
          if (f.endsWith('_database.sql') || f === 'database.sql') {
            fs.unlinkSync(path.join(destDir, f));
          }
        });
      } catch (e) {
        console.error("Error cleaning up database files during changeLanguage:", e);
      }
    }

    const work = await Work.findOneAndUpdate(
      { studentId: req.user.id, examId },
      { 
        $set: { 
          selectedLanguage: null, 
          files: [], 
          sqlDatabaseFile: { originalName: null, diskFilename: null, ext: null, uploadedAt: null },
          databaseDump: { content: null, updatedAt: null }
        } 
      },
      { new: true }
    );
    res.json({ ok: true, work });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SQL Database Upload Routes ─────────────────────────────────────────────

// POST /api/work/sql/upload
// Upload a .sql or .db file to use as the student's database
router.post('/sql/upload', authenticateToken, (req, res) => {
  sqlUpload.single('database')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Le fichier est trop volumineux (max 10 Mo)' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });

    const { examId } = req.body;
    if (!examId) return res.status(400).json({ error: 'examId requis' });

    try {
      // Delete old file if exists
      const existingWork = await Work.findOne({ studentId: req.user.id, examId });
      if (existingWork?.sqlDatabaseFile?.diskFilename) {
        const oldPath = path.join(SQL_UPLOADS, existingWork.sqlDatabaseFile.diskFilename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const work = await Work.findOneAndUpdate(
        { studentId: req.user.id, examId },
        {
          $set: {
            'sqlDatabaseFile.originalName': req.file.originalname,
            'sqlDatabaseFile.diskFilename': req.file.filename,
            'sqlDatabaseFile.ext': ext,
            'sqlDatabaseFile.uploadedAt': new Date()
          }
        },
        { new: true }
      );
      if (!work) {
        // Clean up uploaded file if work not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Travail introuvable. Initialisez le langage SQL d\'abord.' });
      }
      res.json({ ok: true, sqlDatabaseFile: work.sqlDatabaseFile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// POST /api/work/sql/remove
// Remove the uploaded SQL database file
router.post('/sql/remove', authenticateToken, async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ error: 'examId requis' });

  try {
    const work = await Work.findOne({ studentId: req.user.id, examId });
    if (!work) return res.status(404).json({ error: 'Travail introuvable' });

    // Delete physical file from disk
    if (work.sqlDatabaseFile?.diskFilename) {
      const filePath = path.join(SQL_UPLOADS, work.sqlDatabaseFile.diskFilename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Clear the field in MongoDB
    work.sqlDatabaseFile = { originalName: null, diskFilename: null, ext: null, uploadedAt: null };
    await work.save();

    res.json({ ok: true, message: 'Base de données supprimée' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work/submit
// Finalise la soumission de l'étudiant
router.post('/submit', authenticateToken, async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ error: 'examId requis' });

  const studentId = req.user.id;
  const matricule = req.user.matricule || "unknown";
  const studentName = req.user.name || "Student";
  const nowRaw = new Date();
  const now = nowRaw.toISOString();

  try {
    // 1. Marquer côté MongoDB
    const work = await Work.findOneAndUpdate(
      { studentId: studentId, examId },
      { $set: { submitted: true, submittedAt: nowRaw } },
      { new: true }
    );

    if (!work || !work.files || work.files.length === 0) {
      return res.status(404).json({ error: 'Aucun travail trouvé pour cet examen' });
    }

    // 2. Exporter les fichiers sur le disque (format attendu par le prof)
    const destDir = path.join(UPLOADS_BASE, "exams", String(examId), "students", String(matricule));
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const fileDetails = [];
    const filePaths = [];

    work.files.forEach(f => {
      const safeName = f.filename.replace(/\s+/g, "_");
      const diskFilename = `${Date.now()}_${safeName}`;
      const fullPath = path.join(destDir, diskFilename);
      
      fs.writeFileSync(fullPath, f.content, 'utf8');

      fileDetails.push({
        name: f.filename,
        filename: diskFilename,
        size: Buffer.byteLength(f.content, 'utf8'),
        path: fullPath
      });
      filePaths.push(diskFilename);
    });

    // Exporter le dump de base de données MySQL/MariaDB s'il existe
    if (work.databaseDump && work.databaseDump.content) {
      const diskFilename = `${Date.now()}_database.sql`;
      const fullPath = path.join(destDir, diskFilename);
      fs.writeFileSync(fullPath, work.databaseDump.content, 'utf8');
      fileDetails.push({
        name: 'database.sql',
        filename: diskFilename,
        size: Buffer.byteLength(work.databaseDump.content, 'utf8'),
        path: fullPath
      });
      filePaths.push(diskFilename);
    }

    const filePathsJson = JSON.stringify(filePaths);

    // 3. Insérer la soumission dans SQLite
    const sql = `
      INSERT INTO works (exam_id, id_etud, nb_files, file_paths, nom, matricule, last_update, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    db.run(sql, [examId, studentId, fileDetails.length, filePathsJson, studentName, matricule, now], function (err) {
      if (err) {
        console.error("SQLite insert error:", err);
        return res.status(500).json({ error: "Erreur SQLite " + err.message });
      }

      const sqliteWorkId = this.lastID;

      // 4. Notifications WebSockets
      try {
        const io = getIO();
        io.to('professors').emit('alert', {
          type: 'SUBMISSION',
          message: `📤 Rendu IDE reçu de ${matricule} (${fileDetails.length} fichiers)`,
          level: 'info',
          studentId: studentId
        });

        io.to(`exam:${examId}`).emit("file-submitted", {
          workId: sqliteWorkId,
          examId,
          studentId: studentId,
          files: fileDetails,
          at: now,
        });
      } catch (wsErr) {
        console.error("WS Emit error:", wsErr);
      }

      res.json({ ok: true, message: 'Travail soumis et synchronisé avec succès', submittedAt: work.submittedAt });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
