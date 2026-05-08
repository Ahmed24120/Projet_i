const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log("Starting migration: Adding professor_id to examen table...");

db.serialize(() => {
    // Add column
    db.run("ALTER TABLE examen ADD COLUMN professor_id INTEGER", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column professor_id already exists.");
            } else {
                console.error("Error adding column:", err.message);
            }
        } else {
            console.log("Column professor_id added successfully.");
        }
    });

    // Optional: Assign existing exams to the first professor found (to avoid stranding them)
    // We'll find a professor ID first
    db.get("SELECT id FROM users WHERE role = 'professor' LIMIT 1", (err, row) => {
        if (err || !row) {
            console.log("No professor found to assign existing exams to.");
            return;
        }
        const profId = row.id;
        console.log(`Assigning existing valid exams to professor ID ${profId}...`);

        db.run("UPDATE examen SET professor_id = ? WHERE professor_id IS NULL", [profId], function (err) {
            if (err) console.error("Error updating exams:", err);
            else console.log(`Updated ${this.changes} exams.`);
        });
    });
});
