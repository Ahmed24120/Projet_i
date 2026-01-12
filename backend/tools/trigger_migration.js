const db = require('../src/db');

console.log("Triggering DB load...");
setTimeout(() => {
    console.log("Allowing time for migrations...");
    process.exit(0);
}, 2000);
