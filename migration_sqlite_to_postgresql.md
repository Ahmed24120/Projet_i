# 🔄 Guide de Migration : SQLite → PostgreSQL (Manuel)

> **Projet analysé** : `Projet_i` — Backend Node.js (Express + sqlite3), sans ORM Prisma actif.
> Toutes les requêtes SQL sont écrites à la main dans `src/db.js` et `src/routes/`.

---

## 📊 État actuel du projet

| Élément | Valeur |
|---|---|
| Base de données actuelle | SQLite (`database.db`) |
| Driver utilisé | `sqlite3` npm package |
| Fichier central DB | `backend/src/db.js` |
| Fichiers qui utilisent `db` | `routes/auth.js`, `routes/exams.js`, `routes/works.js` |
| Fichiers de migration | `database_init.js`, `migrate_*.js` (scripts standalone) |

### Tables identifiées
- `users`
- `profile`
- `ens`
- `examen`
- `exam_allowed_students`
- `works`
- `matieres`
- `exam_matieres`
- `logs`
- `exam_results`
- `exam_sessions`
- `student_connections`

---

## ⚠️ Différences SQLite → PostgreSQL à connaître

| SQLite | PostgreSQL | Action requise |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` ou `GENERATED ALWAYS AS IDENTITY` | Modifier le CREATE TABLE |
| `DATETIME` | `TIMESTAMP` | Modifier les types de colonnes |
| `TEXT` | `TEXT` (compatible ✅) | Rien à faire |
| `db.run()`, `db.get()`, `db.all()` | `client.query()` | Réécrire le fichier `db.js` |
| `?` (placeholder) | `$1, $2, $3...` (paramètres numérotés) | Modifier TOUTES les requêtes |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | Modifier quelques requêtes |
| `this.lastID` | `RETURNING id` dans le SQL | Modifier les INSERT |
| `db.prepare()` | Pas d'équivalent direct, utiliser loop | Modifier `routes/exams.js` |
| `CURRENT_TIMESTAMP` | `NOW()` ou `CURRENT_TIMESTAMP` (compatible ✅) | Rien à faire |
| `sqlite_master` | `information_schema.tables` | Supprimer les vérifications de migration |
| `PRAGMA foreign_keys = ON` | Clés étrangères activées par défaut | Supprimer |

---

## 🚀 Plan de migration en 6 étapes

---

### ÉTAPE 1 — Installer PostgreSQL et `pg`

#### 1a. Installer le driver Node.js

```bash
cd /home/abdy/ahmed/Projet_i/backend
npm install pg
npm uninstall sqlite3
```

#### 1b. Installer PostgreSQL localement (si pas déjà installé)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 1c. Créer la base de données et l'utilisateur

```bash
sudo -u postgres psql
```

Dans la console psql :
```sql
CREATE USER projet_user WITH PASSWORD 'mot_de_passe_securise';
CREATE DATABASE projet_i_db OWNER projet_user;
GRANT ALL PRIVILEGES ON DATABASE projet_i_db TO projet_user;
\q
```

---

### ÉTAPE 2 — Configurer les variables d'environnement

Modifier le fichier `backend/.env.example` (et créer `.env`) :

```env
PORT=3001
JWT_SECRET=votre_secret_jwt_tres_securise_changez_moi
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Remplacer DATABASE_URL SQLite par PostgreSQL :
DATABASE_URL=postgresql://projet_user:mot_de_passe_securise@localhost:5432/projet_i_db
```

---

### ÉTAPE 3 — Réécrire `backend/src/db.js`

C'est la modification la plus importante. Voici le nouveau fichier complet :

```javascript
// backend/src/db.js - VERSION POSTGRESQL
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Connexion via DATABASE_URL ou paramètres séparés
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://projet_user:mot_de_passe_securise@localhost:5432/projet_i_db',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur connexion PostgreSQL:', err.message);
  } else {
    release();
    console.log('✅ Base de données PostgreSQL connectée');
  }
});

// Fonction helper pour compatibilité avec l'API sqlite3
// sqlite3 utilisait db.get(), db.all(), db.run() avec callbacks
// pg utilise pool.query() avec Promises — on crée des wrappers

const db = {
  // Équivalent de db.get() — retourne une seule ligne
  get: (sql, params, callback) => {
    // Convertir les ? en $1, $2, $3...
    const pgSql = convertPlaceholders(sql);
    pool.query(pgSql, params, (err, result) => {
      if (err) return callback(err, null);
      callback(null, result.rows[0] || null);
    });
  },

  // Équivalent de db.all() — retourne toutes les lignes
  all: (sql, params, callback) => {
    const pgSql = convertPlaceholders(sql);
    pool.query(pgSql, params, (err, result) => {
      if (err) return callback(err, null);
      callback(null, result.rows);
    });
  },

  // Équivalent de db.run() — INSERT, UPDATE, DELETE
  // Pour les INSERT qui utilisent this.lastID, utiliser db.runReturning()
  run: (sql, params, callback) => {
    const pgSql = convertPlaceholders(sql);
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(pgSql, params || [], (err, result) => {
      if (typeof callback === 'function') {
        if (err) return callback(err);
        // Simuler l'objet sqlite3 avec .changes
        callback.call({ changes: result.rowCount }, null);
      }
    });
  },

  // Nouveau : pour les INSERT qui ont besoin du lastID
  // Utiliser RETURNING id dans le SQL
  runReturning: (sql, params, callback) => {
    const pgSql = convertPlaceholders(sql);
    pool.query(pgSql, params || [], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result.rows[0]);
    });
  },

  // Équivalent de db.serialize() — juste exécuter directement
  serialize: (fn) => fn(),

  // Pool direct pour les cas avancés
  pool,
};

// Convertit les ? SQLite en $1, $2, $3... PostgreSQL
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ============================================================
// INITIALISATION DES TABLES (remplace le db.serialize() de l'ancien db.js)
// ============================================================
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS ens (
        id SERIAL PRIMARY KEY,
        nom TEXT,
        prenom TEXT,
        specialite TEXT,
        email TEXT UNIQUE
      )
    `);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_allowed_students (
        exam_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(exam_id, student_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_allowed_exam ON exam_allowed_students(exam_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_allowed_student ON exam_allowed_students(student_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_examen_status_room ON examen(status_code, room_number)
    `);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS matieres (
        id SERIAL PRIMARY KEY,
        nom TEXT UNIQUE,
        code TEXT UNIQUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_matieres (
        exam_id INTEGER,
        matiere_id INTEGER,
        PRIMARY KEY (exam_id, matiere_id),
        FOREIGN KEY (exam_id) REFERENCES examen(id),
        FOREIGN KEY (matiere_id) REFERENCES matieres(id)
      )
    `);

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
    console.log('✅ Toutes les tables initialisées');

    // Seed initial
    const defaultPassword = await hashPassword('password123');

    const profExists = await client.query(
      "SELECT count(*) as count FROM users WHERE email = 'professor@supnum.mr'"
    );
    if (parseInt(profExists.rows[0].count) === 0) {
      await client.query(
        "INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, 'professor', 'Professeur Principal')",
        ['professor@supnum.mr', defaultPassword]
      );
      console.log('✅ Seed: Compte professeur créé');
    }

    const studExists = await client.query(
      "SELECT count(*) as count FROM users WHERE email = 'student@supnum.mr'"
    );
    if (parseInt(studExists.rows[0].count) === 0) {
      await client.query(
        "INSERT INTO users (email, password_hash, role, matricule, name) VALUES ($1, $2, 'student', '24001', 'Etudiant Test')",
        ['student@supnum.mr', defaultPassword]
      );
      console.log('✅ Seed: Compte étudiant créé');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur initialisation DB:', err.message);
  } finally {
    client.release();
  }
}

initDatabase();

module.exports = db;
```

---

### ÉTAPE 4 — Modifier les requêtes qui utilisent `this.lastID`

Chercher dans tous les fichiers les patterns `this.lastID` et les remplacer.

#### Dans `routes/auth.js` :

**Avant (SQLite) :**
```javascript
db.run("INSERT INTO users ...", [...params], function (err) {
  const userId = this.lastID;  // ← à changer
  // ...
});
```

**Après (PostgreSQL) :**
```javascript
// Option 1 : Utiliser db.runReturning (wrapper créé)
db.runReturning("INSERT INTO users (...) VALUES (...) RETURNING id", params, (err, row) => {
  const userId = row.id;
  // ...
});

// Option 2 : Utiliser pool.query directement
pool.query("INSERT INTO users (...) VALUES (...) RETURNING id", params, (err, result) => {
  const userId = result.rows[0].id;
  // ...
});
```

**Fichiers à modifier pour `this.lastID` :**
- `backend/src/routes/auth.js` (lignes ~189, ~269)
- `backend/src/routes/works.js` (probablement)

---

### ÉTAPE 5 — Modifier `INSERT OR IGNORE` et `db.prepare()`

#### Dans `routes/exams.js` (ligne ~629) :

**Avant (SQLite) :**
```javascript
const stmt = db.prepare("INSERT OR IGNORE INTO exam_allowed_students (exam_id, student_id) VALUES (?, ?)");
idsToAdd.forEach(sid => stmt.run(req.params.id, sid));
stmt.finalize();
```

**Après (PostgreSQL) :**
```javascript
// Pas de prepare() en pg avec callbacks — utiliser un Promise.all
const insertPromises = [...idsToAdd].map(sid =>
  pool.query(
    "INSERT INTO exam_allowed_students (exam_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [req.params.id, sid]
  )
);
Promise.all(insertPromises)
  .then(() => res.json({ ok: true, added: idsToAdd.size }))
  .catch(err => res.status(500).json({ error: err.message }));
```

---

### ÉTAPE 6 — Migrer les données existantes (optionnel)

Si tu veux conserver les données du `database.db` actuel :

```bash
# Installer sqlite3 et pg-copy-streams pour migration
npm install -g db-migrate db-migrate-pg

# Ou utiliser pgloader (outil dédié)
sudo apt install pgloader

# Migrer avec pgloader
pgloader sqlite:///home/abdy/ahmed/Projet_i/backend/database.db \
         postgresql://projet_user:mot_de_passe_securise@localhost/projet_i_db
```

---

## 🐳 Modifier docker-compose.yml

Ajouter le service PostgreSQL et supprimer le volume `database.db` :

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: projet-i-postgres
    environment:
      POSTGRES_USER: projet_user
      POSTGRES_PASSWORD: mot_de_passe_securise
      POSTGRES_DB: projet_i_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U projet_user -d projet_i_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: 
      context: ./backend
    container_name: projet-i-backend
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - JWT_SECRET=votre_secret_jwt_tres_securise
      - NODE_ENV=production
      - FRONTEND_URL=http://localhost:3000
      - DATABASE_URL=postgresql://projet_user:mot_de_passe_securise@postgres:5432/projet_i_db
    volumes:
      - ./backend/uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    restart: always

  frontend:
    build:
      context: ./frontend
    container_name: projet-i-frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
```

---

## 📋 Checklist récapitulatif

- [ ] **ÉTAPE 1** : `npm install pg` + `npm uninstall sqlite3`
- [ ] **ÉTAPE 2** : Mettre à jour `.env` avec `DATABASE_URL` PostgreSQL
- [ ] **ÉTAPE 3** : Réécrire `backend/src/db.js` (code fourni ci-dessus)
- [ ] **ÉTAPE 4** : Remplacer `this.lastID` par `RETURNING id` dans `auth.js` et `works.js`
- [ ] **ÉTAPE 5** : Remplacer `INSERT OR IGNORE` + `db.prepare()` dans `exams.js`
- [ ] **ÉTAPE 6** : (Optionnel) Migrer les données avec `pgloader`
- [ ] **ÉTAPE 7** : Mettre à jour `docker-compose.yml`
- [ ] **ÉTAPE 8** : Tester la connexion et les routes principales

---

> [!TIP]
> La conversion des `?` en `$1, $2...` est gérée automatiquement par la fonction `convertPlaceholders()` dans le nouveau `db.js`. Tu n'as PAS besoin de modifier toutes les requêtes SQL existantes dans `auth.js` et `exams.js` — seuls les `this.lastID`, `INSERT OR IGNORE` et `db.prepare()` nécessitent une modification manuelle.

> [!WARNING]
> Ne modifie JAMAIS les fichiers de migration standalone (`migrate_*.js`, `database_init.js`) — ils ne sont plus utilisés en production et utilisent encore l'ancienne API sqlite3. Tu peux les laisser tels quels ou les archiver.
