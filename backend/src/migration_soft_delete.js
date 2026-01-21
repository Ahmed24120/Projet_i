const db = require('./db');

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN deleted_at DATETIME", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'deleted_at' already exists.");
            } else {
                console.error("Error adding column:", err.message);
            }
        } else {
            console.log("Column 'deleted_at' added successfully.");
        }
    });
});
