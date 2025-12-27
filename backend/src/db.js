const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// __dirname = backend/src → on remonte d'un niveau vers backend/
const dbPath = path.resolve(__dirname, "../database.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Erreur ouverture DB:", err.message);
  else console.log("✅ Base de données connectée :", dbPath);
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT,
      role TEXT CHECK(role IN ('student','professor')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT,
      prenom TEXT,
      matricule TEXT UNIQUE,
      classe TEXT,
      specialite TEXT,
      id_user INTEGER,
      FOREIGN KEY (id_user) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT,
      prenom TEXT,
      specialite TEXT,
      email TEXT UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS examen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT,
      description TEXT,
      date_debut TEXT,
      date_fin TEXT,
      sujet_path TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER,
      id_etud INTEGER,
      nb_files INTEGER,
      file_paths TEXT,
      nom TEXT,
      matricule TEXT,
      last_update TEXT
    )
  `);

  // Migration: Ajouter exam_id si la table existe déjà sans
  db.run("ALTER TABLE works ADD COLUMN exam_id INTEGER", (err) => {
    if (!err) console.log("✅ Migration: Colonne exam_id ajoutée à works");
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE,
      code TEXT UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exam_matieres (
      exam_id INTEGER,
      matiere_id INTEGER,
      PRIMARY KEY (exam_id, matiere_id),
      FOREIGN KEY (exam_id) REFERENCES examen(id),
      FOREIGN KEY (matiere_id) REFERENCES matieres(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER,
      matricule TEXT,
      action TEXT,
      type TEXT DEFAULT 'info',
      cleared INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Ajouter les colonnes nécessaires si inexistantes
  db.run("ALTER TABLE logs ADD COLUMN exam_id INTEGER", () => { });
  db.run("ALTER TABLE logs ADD COLUMN type TEXT DEFAULT 'info'", () => { });
  db.run("ALTER TABLE logs ADD COLUMN cleared INTEGER DEFAULT 0", () => { });

  // SEED INITIAL DATA
  (async () => {
    const defaultPassword = await hashPassword("password123");

    // Seed Professor
    db.get("SELECT count(*) as count FROM users WHERE email = 'professor@supnum.mr'", [], (err, row) => {
      if (!err && row && row.count === 0) {
        db.run("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'professor', 'Professeur Principal')",
          ['professor@supnum.mr', defaultPassword], (e) => {
            if (!e) console.log("✅ Seed: Compte professeur créé (professor@supnum.mr / password123)");
          });
      }
    });

    // Seed Student
    db.get("SELECT count(*) as count FROM users WHERE email = 'student@supnum.mr'", [], (err, row) => {
      if (!err && row && row.count === 0) {
        db.run("INSERT INTO users (email, password_hash, role, matricule, name) VALUES (?, ?, 'student', '24001', 'Etudiant Test')",
          ['student@supnum.mr', defaultPassword], function (e) {
            if (!e) {
              console.log("✅ Seed: Compte étudiant créé (student@supnum.mr / 24001 / password123)");
            }
          });
      }
    });
  })();
});

module.exports = db;
