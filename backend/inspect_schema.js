const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(users)", [], (err, rows) => {
    if (err) {
        console.error("❌ Error:", err.message);
    } else {
        console.log("Columns in 'users' table:");
        rows.forEach(row => {
            console.log(`- ${row.name} (${row.type})`);
        });
    }
    db.close();
});
