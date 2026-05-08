const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log("Checking schema for table 'users'...");

db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Columns:", rows);
});

db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", (err, rows) => {
    if (err) console.error(err);
    console.log("CREATE statement:", rows);
});
