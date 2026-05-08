// backend/src/db.js — VERSION POSTGRESQL
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// ============================================================
// CONNEXION AU POOL POSTGRESQL
// ============================================================
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://projet_user:mot_de_passe_securise@localhost:5432/projet_i_db',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur connexion PostgreSQL:', err.message);
  } else {
    release();
    console.log('✅ Base de données PostgreSQL connectée');
  }
});

// ============================================================
// CONVERSION DES PLACEHOLDERS ? → $1, $2, $3...
// ============================================================
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ============================================================
// WRAPPERS DE COMPATIBILITÉ (API sqlite3 → pg)
// Permettent de ne PAS modifier routes/auth.js et routes/exams.js
// ============================================================
const db = {
  // Équivalent db.get() — retourne UNE seule ligne
  get: (sql, params, callback) => {
    const pgSql = convertPlaceholders(sql);
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(pgSql, params || [], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result.rows[0] || null);
    });
  },

  // Équivalent db.all() — retourne TOUTES les lignes
  all: (sql, params, callback) => {
    const pgSql = convertPlaceholders(sql);
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(pgSql, params || [], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result.rows);
    });
  },

  // Équivalent db.run() — INSERT / UPDATE / DELETE sans retour d'ID
  // Pour les INSERT qui ont besoin de lastID, utiliser db.runReturning()
  run: (sql, params, callback) => {
    const pgSql = convertPlaceholders(sql);
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(pgSql, params || [], (err, result) => {
      if (typeof callback === 'function') {
        if (err) return callback(err);
        // Simuler l'objet sqlite3 : this.changes
        callback.call({ changes: result.rowCount }, null);
      }
    });
  },

  // Nouveau helper pour INSERT ... RETURNING id
  runReturning: (sql, params, callback) => {
    const pgSql = convertPlaceholders(sql);
    pool.query(pgSql, params || [], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result.rows[0]);
    });
  },

  // Équivalent db.serialize() — en PG tout est async, on appelle directement
  serialize: (fn) => fn(),

  // Accès direct au pool pour les cas avancés
  pool,
};

// ============================================================
// INITIALISATION DES TABLES (CREATE TABLE IF NOT EXISTS)
// ============================================================
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Table users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        matricule TEXT,
        email TEXT UNIQUE,
        password_hash TEXT,
        name TEXT,
        role TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table profile
    await client.query(`
      CREATE TABLE IF NOT EXISTS profile (
        id SERIAL PRIMARY KEY,
        nom TEXT,
        prenom TEXT,
        matricule TEXT UNIQUE,
        classe TEXT,
        specialite TEXT,
        id_user INTEGER REFERENCES users(id)
      )
    `);

    // Table ens
    await client.query(`
      CREATE TABLE IF NOT EXISTS ens (
        id SERIAL PRIMARY KEY,
        nom TEXT,
        prenom TEXT,
        specialite TEXT,
        email TEXT UNIQUE
      )
    `);

    // Table examen
    await client.query(`
      CREATE TABLE IF NOT EXISTS examen (
        id SERIAL PRIMARY KEY,
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
        published_at TIMESTAMP,
        started_at TIMESTAMP,
        stopped_at TIMESTAMP,
        finished_at TIMESTAMP,
        matiere_code TEXT,
        validated_by_admin_id INTEGER,
        created_by_user_id INTEGER,
        last_modified_by_user_id INTEGER
      )
    `);

    // Table exam_allowed_students
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_allowed_students (
        exam_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(exam_id, student_id)
      )
    `);

    // Index exam_allowed_students
    await client.query(`CREATE INDEX IF NOT EXISTS idx_allowed_exam ON exam_allowed_students(exam_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_allowed_student ON exam_allowed_students(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_examen_status_room ON examen(status_code, room_number)`);

    // Table works
    await client.query(`
      CREATE TABLE IF NOT EXISTS works (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER,
        id_etud INTEGER,
        nb_files INTEGER,
        file_paths TEXT,
        nom TEXT,
        matricule TEXT,
        last_update TEXT,
        status TEXT DEFAULT 'active'
      )
    `);

    // Table matieres
    await client.query(`
      CREATE TABLE IF NOT EXISTS matieres (
        id SERIAL PRIMARY KEY,
        nom TEXT UNIQUE,
        code TEXT UNIQUE
      )
    `);

    // Table exam_matieres
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_matieres (
        exam_id INTEGER,
        matiere_id INTEGER,
        PRIMARY KEY (exam_id, matiere_id),
        FOREIGN KEY (exam_id) REFERENCES examen(id),
        FOREIGN KEY (matiere_id) REFERENCES matieres(id)
      )
    `);

    // Table logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER,
        matricule TEXT,
        action TEXT,
        type TEXT DEFAULT 'info',
        cleared INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table exam_results
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_results (
        exam_id INTEGER,
        student_id INTEGER,
        is_finalized INTEGER DEFAULT 0,
        finalized_at TIMESTAMP,
        has_exited INTEGER DEFAULT 0,
        exited_at TIMESTAMP,
        PRIMARY KEY (exam_id, student_id)
      )
    `);

    // Table exam_sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_sessions (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER,
        room_code TEXT,
        wifi_ssid TEXT,
        status TEXT,
        start_time TIMESTAMP,
        end_time TIMESTAMP
      )
    `);

    // Table student_connections
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_connections (
        id SERIAL PRIMARY KEY,
        student_id INTEGER,
        session_id INTEGER,
        ip_address TEXT,
        connection_time TIMESTAMP,
        disconnection_time TIMESTAMP,
        disconnect_type TEXT
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Toutes les tables PostgreSQL initialisées');

    // ──────────────────────────────────────
    // SEED INITIAL (comptes par défaut)
    // ──────────────────────────────────────
    const defaultPassword = await hashPassword('password123');

    // Admin
    const adminCheck = await pool.query(
      "SELECT count(*) AS count FROM users WHERE email = 'admin@supnum.mr'"
    );
    if (parseInt(adminCheck.rows[0].count) === 0) {
      const adminPassword = await hashPassword('admin');
      await pool.query(
        "INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, 'ADMIN', 'Administrateur Principal')",
        ['admin@supnum.mr', adminPassword]
      );
      console.log('✅ Seed: Compte admin créé (admin@supnum.mr / admin)');
    }

    const profCheck = await pool.query(
      "SELECT count(*) AS count FROM users WHERE email = 'professor@supnum.mr'"
    );
    if (parseInt(profCheck.rows[0].count) === 0) {
      await pool.query(
        "INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, 'professor', 'Professeur Principal')",
        ['professor@supnum.mr', defaultPassword]
      );
      console.log('✅ Seed: Compte professeur créé (professor@supnum.mr / password123)');
    }

    const studCheck = await pool.query(
      "SELECT count(*) AS count FROM users WHERE email = 'student@supnum.mr'"
    );
    if (parseInt(studCheck.rows[0].count) === 0) {
      await pool.query(
        "INSERT INTO users (email, password_hash, role, matricule, name) VALUES ($1, $2, 'student', '24001', 'Etudiant Test')",
        ['student@supnum.mr', defaultPassword]
      );
      console.log('✅ Seed: Compte étudiant créé (student@supnum.mr / 24001 / password123)');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur initialisation DB:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

initDatabase().catch((err) => {
  console.error('❌ Impossible d\'initialiser la base de données:', err.message);
  process.exit(1);
});

module.exports = db;
