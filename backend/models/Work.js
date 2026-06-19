const mongoose = require('mongoose');

const workSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  examId: { type: String, required: true },
  selectedLanguage: { type: String, default: null },
  files: [{
    filename: String,
    content: { type: String, default: '' },
    lastModified: { type: Date, default: Date.now }
  }],
  // SQL: fichier de base de données importé par l'étudiant
  sqlDatabaseFile: {
    originalName: { type: String, default: null },
    diskFilename: { type: String, default: null },
    ext: { type: String, default: null }, // '.sql' or '.db'
    uploadedAt: { type: Date, default: null }
  },
  // MySQL/MariaDB: Dump de l'état de la base de données pour PHP
  databaseDump: {
    content: { type: String, default: null },
    updatedAt: { type: Date, default: null }
  },
  lastSavedAt: { type: Date, default: Date.now },
  submitted: { type: Boolean, default: false },
  submittedAt: Date
});

workSchema.index({ studentId: 1, examId: 1 }, { unique: true });

module.exports = mongoose.model('Work', workSchema);
