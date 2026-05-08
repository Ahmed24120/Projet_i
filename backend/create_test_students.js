const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log("Création de 4 étudiants de test...\n");

const students = [
    { matricule: '24001', name: 'Etudiant 1' },
    { matricule: '24002', name: 'Etudiant 2' },
    { matricule: '24003', name: 'Etudiant 3' },
    { matricule: '24004', name: 'Etudiant 4' }
];

students.forEach(student => {
    const email = `${student.matricule}@supnum.mr`;
    const password = 'password123'; // Mot de passe en clair pour le test

    // Vérifier si l'étudiant existe déjà
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (err) {
            console.error(`❌ Erreur DB pour ${email}:`, err.message);
            return;
        }

        if (row) {
            console.log(`ℹ️  ${email} existe déjà (ID: ${row.id})`);
        } else {
            // Insérer avec le schéma actuel: password_hash, matricule, email, name, role
            db.run(
                `INSERT INTO users (matricule, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`,
                [student.matricule, email, password, student.name, 'student'],
                function (err) {
                    if (err) {
                        console.error(`❌ Erreur insertion ${email}:`, err.message);
                    } else {
                        console.log(`✅ Créé: ${email} | Matricule: ${student.matricule} | Pass: password123`);
                    }
                }
            );
        }
    });
});

// Attendre que toutes les opérations async se terminent
setTimeout(() => {
    console.log("\n✅ Terminé!");
    db.close();
}, 2000);
