const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

console.log("Inspecting", dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) return console.error(err);
    console.log("Tables:", tables.map(t => t.name).join(", "));

    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) return console.error(err);
        console.log("Columns in users:", JSON.stringify(columns, null, 2));
        db.close();
    });
});
