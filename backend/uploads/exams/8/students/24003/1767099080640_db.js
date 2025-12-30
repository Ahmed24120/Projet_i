const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'exam_local.db'), (err) => {
    if (err) console.error('Erreur de connexion SQLite:', err.message);
    else console.log('Connecté à la base de données SQLite locale.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT,
        inActive BOOLEAN DEFAULT 0
    )`);
// db.run(
//   `INSERT INTO users (email, password, role, inActive) VALUES (?, ?, ?, ?)`,
//   ["test@example.com", "$2b$10$h.8Kcubb8/hF2YzMKUu5aeWOsUbSs09K9rOFlxzTfOclFCul5fxHO", "etudiant", 0],
//   function (err) {
//     if (err) {
//       console.error("Error inserting user:", err.message);
//     } else {
//       console.log("User created with ID:", this.lastID);
//     }
//   }
// );
    db.run(`CREATE TABLE IF NOT EXISTS profile (
        id_user INTEGER,
        email TEXT,
        matricule TEXT,
        level TEXT,
        nom TEXT,
        FOREIGN KEY(id_user) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noms TEXT,
        email TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS examen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sujet_path TEXT,
        description TEXT,
        titre TEXT,
        date_fin TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS works (
        id_etud INTEGER,
        nb_files INTEGER,
        file_paths TEXT, 
        nom TEXT,
        matricule TEXT,
        last_update DATETIME
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricule TEXT,
    action TEXT,
    timestamp TEXT
    )`);

});

module.exports = db;