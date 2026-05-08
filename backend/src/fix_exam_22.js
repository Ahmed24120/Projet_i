const db = require('./db');

setTimeout(() => {
    const EXAM_ID = 22;
    console.log(`Fixing Exam ${EXAM_ID}...`);

    // 1. Force Update Status
    db.run("UPDATE examen SET status_code=2, status='launched', finished_at=NULL WHERE id=?", [EXAM_ID], function (err) {
        if (err) console.error("Update Error:", err);
        else console.log(`Update Success. Changes: ${this.changes}`);

        // 2. Check Result
        db.get("SELECT id, status, status_code FROM examen WHERE id=?", [EXAM_ID], (err, row) => {
            console.log("UPDATED EXAM:", JSON.stringify(row));
        });
    });

    // 3. Check Session Constraints (Network Check)
    db.all("SELECT * FROM exam_sessions WHERE exam_id=?", [EXAM_ID], (err, sessions) => {
        console.log("SESSIONS:", JSON.stringify(sessions));
    });

}, 1000);
