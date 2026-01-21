const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

db.get("SELECT * FROM users WHERE email = 'professor@supnum.mr'", [], (err, row) => {
    if (err) {
        console.error("❌ Error:", err.message);
    } else if (row) {
        console.log("✅ Professor found:", row.email);
        console.log("✅ Role:", row.role);
    } else {
        console.log("❌ Professor NOT found in database.");
    }
    db.close();
});
