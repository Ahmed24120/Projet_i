const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log("Starting migration...");

db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // Rename existing table
    db.run("ALTER TABLE users RENAME TO users_old", (err) => {
        if (err) {
            console.error("Rename failed:", err);
            return;
        }
    });

    // Create new table without Email Check Constraint and without NOT NULL on matricule
    db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT,
      role TEXT CHECK(role IN ('student','professor')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
        if (err) console.error("Create table failed:", err);
    });

    // Copy data
    db.run(`
    INSERT INTO users (id, matricule, email, password_hash, name, role, created_at)
    SELECT id, matricule, email, password_hash, name, role, created_at FROM users_old
  `, function (err) {
        if (err) {
            console.error("Data copy failed:", err);
            db.run("ROLLBACK");
        } else {
            db.run("DROP TABLE users_old");
            db.run("COMMIT", () => {
                console.log("Migration successful: Constraints removed.");
            });
        }
    });
});
