const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.resolve(__dirname, "./database.db");
const db = new sqlite3.Database(dbPath);

const SALT_ROUNDS = 10;

async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

db.serialize(async () => {
    const password = await hashPassword("password123");

    // 1. Create Professor
    db.run(`
        INSERT INTO users (email, password_hash, role, name) 
        VALUES ('professor@supnum.mr', ?, 'professor', 'Professeur Principal')
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
    `, [password], function (err) {
        if (err) return console.error("❌ Error adding professor:", err.message);
        console.log("✅ Professor added/updated: professor@supnum.mr / password123");
    });

    // 2. Create Student User
    db.run(`
        INSERT INTO users (email, password_hash, role, matricule, name) 
        VALUES ('student@supnum.mr', ?, 'student', '24001', 'Etudiant Test')
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
    `, [password], function (err) {
        if (err) {
            return console.error("❌ Error adding student user:", err.message);
        }
        console.log("✅ Student added/updated: student@supnum.mr / 24001 / password123");
    });
});

function createProfile(userId) {
    db.run(`
        INSERT INTO profile (matricule, nom, prenom, id_user, classe, specialite)
        VALUES ('123456789', 'Talb', 'Moujid', ?, 'Master 2', 'Informatique')
        ON CONFLICT(matricule) DO UPDATE SET id_user = excluded.id_user
    `, [userId], (err) => {
        if (err) console.error("❌ Error adding student profile:", err.message);
        else console.log("✅ Student added/updated: student@university.dz / password123");
    });
}
