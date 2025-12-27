const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const SALT_ROUNDS = 10;
const EMAIL_TO_ADD = 'professor@supnum.mr';
const PASSWORD = 'password123';

async function addProfessor() {
    const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    db.serialize(() => {
        db.run(`
            INSERT INTO professors (email, password, full_name) 
            VALUES (?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET password = excluded.password
        `, [EMAIL_TO_ADD, hash, 'Professor Demo'], (err) => {
            if (err) {
                console.error("❌ Failed to add:", err.message);
            } else {
                console.log(`✅ Successfully added/updated professor: ${EMAIL_TO_ADD}`);
            }
        });
    });

    setTimeout(() => db.close(), 1000);
}

addProfessor();
