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

const fs = require('fs');

// 🛡️ SAFE MIGRATION : Backup auto avant modif structurelle
const backupDir = path.resolve(__dirname, "../backups");
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// Check rudimentaire pour savoir si on doit backup (si allowed_list n'existe pas encore)
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='exam_allowed_students'", [], (err, row) => {
  if (!row) {
    // La table n'existe pas => c'est une migration majeure => BACKUP
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const backupPath = path.join(backupDir, `database_${timestamp}.db`);
    try {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`📦 Backup de sécurité créé : ${backupPath}`);
    } catch (e) {
      console.error("⚠️ Echec du backup:", e.message);
    }
  }
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
        sujet_path TEXT,
        professor_id INTEGER,
        room_number TEXT,
        status TEXT DEFAULT 'ready',
        status_code INTEGER DEFAULT 0,
        duration_min INTEGER DEFAULT 0,
        published_at DATETIME,
        started_at DATETIME,
        stopped_at DATETIME,
        finished_at DATETIME,
        matiere_code TEXT
      )
    `);

  // Migration: Ajouter room_number à examen (SAFE)
  db.run("ALTER TABLE examen ADD COLUMN room_number TEXT", () => { });

  // ✅ MIGRATIONS IDEMPOTENTES POUR EXAMEN (Nouvelles colonnes)
  const safeAlter = (table, col, type) => {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`, () => { });
  };

  safeAlter("examen", "status_code", "INTEGER DEFAULT 0");
  safeAlter("examen", "duration_min", "INTEGER DEFAULT 0");
  safeAlter("examen", "published_at", "DATETIME");
  safeAlter("examen", "started_at", "DATETIME");
  safeAlter("examen", "stopped_at", "DATETIME");
  safeAlter("examen", "finished_at", "DATETIME");
  safeAlter("examen", "matiere_code", "TEXT");
  safeAlter("examen", "validated_by_admin_id", "INTEGER"); // ✅ Support validation Workflow
  safeAlter("examen", "created_by_user_id", "INTEGER");    // ✅ Traceability
  safeAlter("examen", "last_modified_by_user_id", "INTEGER"); // ✅ Traceability

  // ✅ MIGRATION USERS : Support Role ADMIN (Remove CHECK constraint if exists)
  // On vérifie si on peut insérer un role 'ADMIN'. Si erreur, on migre.
  // Note: C'est une opération délicate, à faire avec prudence.
  // Pour ce contexte, on va recréer la table users si le schéma contient la contrainte bloquante.
  db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", [], (err, row) => {
    if (!err && row && row.sql && row.sql.includes("CHECK(role IN ('student','professor'))")) {
      console.log("🔄 Migration Users : Suppression de la contrainte CHECK pour supporter ADMIN...");
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("ALTER TABLE users RENAME TO users_old");
        db.run(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matricule TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            name TEXT,
            role TEXT, -- Plus de CHECK strict ici
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        db.run("INSERT INTO users(id, matricule, email, password_hash, name, role, created_at) SELECT id, matricule, email, password_hash, name, role, created_at FROM users_old");
        db.run("DROP TABLE users_old");
        db.run("COMMIT", (err) => {
          if (!err) console.log("✅ Migration Users terminée.");
          else console.error("❌ Erreur Migration Users:", err.message);
        });
      });
    }
  });

  // ✅ Table ALLOWED LIST (Idempotent)
  db.run(`
    CREATE TABLE IF NOT EXISTS exam_allowed_students (
      exam_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(exam_id, student_id)
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_allowed_exam ON exam_allowed_students(exam_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_allowed_student ON exam_allowed_students(student_id)");

  // index utile sur examen
  db.run("CREATE INDEX IF NOT EXISTS idx_examen_status_room ON examen(status_code, room_number)");

  // ✅ DATA MIGRATION : Map status TEXT -> status_code INT
  db.run(`
    UPDATE examen SET status_code = CASE status
      WHEN 'ready' THEN 0
      WHEN 'published' THEN 1
      WHEN 'launched' THEN 2
      WHEN 'stopped' THEN 3
      WHEN 'finished' THEN 4
      ELSE 0
    END
    WHERE status_code IS NULL OR status_code = 0
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

  // Migration: Ajouter status si la table existe déjà sans
  db.run("ALTER TABLE works ADD COLUMN status TEXT DEFAULT 'active'", (err) => {
    if (!err) console.log("✅ Migration: Colonne status ajoutée à works");
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

  db.run(`
    CREATE TABLE IF NOT EXISTS exam_results (
      exam_id INTEGER,
      student_id INTEGER,
      is_finalized INTEGER DEFAULT 0,
      finalized_at DATETIME,
      has_exited INTEGER DEFAULT 0,
      exited_at DATETIME,
      PRIMARY KEY (exam_id, student_id)
    )
  `);

  // Migration: Ajouter les colonnes nécessaires si inexistantes
  db.run("ALTER TABLE logs ADD COLUMN exam_id INTEGER", () => { });
  db.run("ALTER TABLE logs ADD COLUMN type TEXT DEFAULT 'info'", () => { });
  db.run("ALTER TABLE logs ADD COLUMN cleared INTEGER DEFAULT 0", () => { });

  db.run(`
    CREATE TABLE IF NOT EXISTS exam_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER,
      room_code TEXT,
      wifi_ssid TEXT,
      status TEXT,
      start_time DATETIME,
      end_time DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS student_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      session_id INTEGER,
      ip_address TEXT,
      connection_time DATETIME,
      disconnection_time DATETIME,
      disconnect_type TEXT
    )
  `);

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
