const db = require('./db');
const bcrypt = require('bcrypt');

console.log("⏳ Starting Admin Seed...");

const seed = async () => {
    const email = 'admin@supnum.mr';
    const password = 'admin';
    const hash = await bcrypt.hash(password, 10);

    // Check for existing Admin
    db.get("SELECT * FROM users WHERE role = 'ADMIN'", (err, row) => {
        if (err) {
            console.error("❌ Error checking users:", err.message);
            return;
        }

        if (row) {
            console.log("✅ Admin exists:", row.email);
        } else {
            console.log("Creating Admin User...");
            db.run("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                ['Super Admin', email, hash, 'ADMIN'],
                function (err) {
                    if (err) {
                        console.error("❌ Error creating admin:", err.message);
                        if (err.message.includes("CHECK constraint failed")) {
                            console.error("⚠️ CHECK constraint on 'role' is still active. DB Migration needed.");
                        }
                    } else {
                        console.log(`✅ Admin created successfully (ID: ${this.lastID})`);
                        console.log(`   Email: ${email}`);
                        console.log(`   Pass:  ${password}`);
                    }
                }
            );
        }
    });
};

// Wait for DB init/migrations in db.js
setTimeout(seed, 2000);
