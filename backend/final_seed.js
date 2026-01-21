const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.resolve(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

const SALT_ROUNDS = 10;

async function seed() {
    console.log("Seeding database at", dbPath);
    const password = await bcrypt.hash("password123", SALT_ROUNDS);

    db.serialize(() => {
        // Professor
        db.run(`
            INSERT INTO users (email, password_hash, role, name, matricule) 
            VALUES ('professor@supnum.mr', ?, 'professor', 'Professeur Principal', 'professor')
            ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
        `, [password], (err) => {
            if (err) console.error("❌ Error seeding professor:", err.message);
            else console.log("✅ Seed Professor success");
        });

        // Student
        db.run(`
            INSERT INTO users (email, password_hash, role, matricule, name) 
            VALUES ('24001@supnum.mr', ?, 'student', '24001', 'Etudiant Test')
            ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
        `, [password], (err) => {
            if (err) console.error("❌ Error seeding student:", err.message);
            else console.log("✅ Seed Student success");
        });
    });

    setTimeout(() => db.close(), 2000);
}

seed();
