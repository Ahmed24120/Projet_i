const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('✅ Connected to the SQLite database.');
    }
});

const SALT_ROUNDS = 10;

async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

db.serialize(async () => {
    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON");

    // 1. Professors Table
    db.run(`CREATE TABLE IF NOT EXISTS professors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE CHECK(email LIKE '%@supnum.mr' OR email LIKE '%@supnum.mr'),
        password TEXT CHECK(LENGTH(password) >= 8),
        full_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error("❌ Error creating professors table:", err.message);
        else console.log("✅ Professors table ready.");
    });

    // 2. Students Table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT CHECK(LENGTH(password) >= 8),
        matricule TEXT UNIQUE,
        full_name TEXT,
        class TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error("❌ Error creating students table:", err.message);
        else console.log("✅ Students table ready.");
    });

    // 2.5 Exams Table (Main table used in app)
    db.run(`CREATE TABLE IF NOT EXISTS examen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        description TEXT,
        date_debut TEXT,
        date_fin TEXT,
        sujet_path TEXT,
        professor_id INTEGER,
        room_number TEXT,
        status TEXT DEFAULT 'ready'
    )`, (err) => {
        if (err) console.error("❌ Error creating examen table:", err.message);
        else console.log("✅ Exams table ready.");
    });

    // 3. Exam Sessions Table
    db.run(`CREATE TABLE IF NOT EXISTS exam_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professor_id INTEGER,
        exam_id INTEGER, -- Link to existing exams if any, or just logical ID
        room_code TEXT,
        wifi_ssid TEXT,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        status TEXT CHECK(status IN ('active', 'finished', 'cancelled')),
        FOREIGN KEY (professor_id) REFERENCES professors(id)
    )`, (err) => {
        if (err) console.error("❌ Error creating exam_sessions table:", err.message);
        else console.log("✅ Exam Sessions table ready.");
    });

    // 4. Student Connections Table (For Monitoring)
    db.run(`CREATE TABLE IF NOT EXISTS student_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        session_id INTEGER,
        ip_address TEXT,
        connection_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        disconnection_time TIMESTAMP,
        disconnect_type TEXT CHECK(disconnect_type IN ('normal', 'abnormal', 'cheating')),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (session_id) REFERENCES exam_sessions(id)
    )`, (err) => {
        if (err) console.error("❌ Error creating student_connections table:", err.message);
        else console.log("✅ Student Connections table ready.");
    });

    // SEED INITIAL DATA (If tables empty)

    // Check if professor exists
    const password = await hashPassword("password123");

    db.get("SELECT count(*) as count FROM professors WHERE email = '23120@supnum.mr'", [], (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            db.run(`INSERT INTO professors (email, password, full_name) VALUES (?, ?, ?)`,
                ['23120@supnum.mr', password, 'Professeur Test'], function (err) {
                    if (err) console.error("❌ Error seeding professor:", err.message);
                    else console.log("✅ Seeded Professor: 23120@supnum.mr / password123");
                });
        }
    });

    db.get("SELECT count(*) as count FROM students WHERE matricule = 'E12345'", [], (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            db.run(`INSERT INTO students (email, password, matricule, full_name, class) VALUES (?, ?, ?, ?, ?)`,
                ['23100@supnum.mr', password, 'E12345', 'Etudiant Test', 'L3'], function (err) {
                    if (err) console.error("❌ Error seeding student:", err.message);
                    else console.log("✅ Seeded Student: 23100@supnum.mr / password123");
                });
        }
    });
});

// Close database connection after a short delay to allow queries to finish
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('✅ Connectivity logic initialization complete.');
        }
    });
}, 2000);
