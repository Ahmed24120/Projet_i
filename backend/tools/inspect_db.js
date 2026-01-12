const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "database.db");
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

(async () => {
    try {
        const tables = await all(
            "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        console.log("\n=== TABLES ===");
        tables.forEach(t => console.log("-", t.name));

        for (const t of tables.map(x => x.name)) {
            const cols = await all(`PRAGMA table_info(${t})`);
            console.log(`\n=== ${t} ===`);
            cols.forEach(c => console.log(`- ${c.name} (${c.type})`));
        }
    } catch (e) {
        console.error(e);
    } finally {
        db.close();
    }
})();
