// backend/tests/test-single-run.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

// Token valide
const token = jwt.sign(
  { id: 999, role: 'student', name: 'Test Student', matricule: '99999' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const payload = {
  files: [
    {
      filename: 'index.php',
      content: `<?php
$conn = new mysqli("localhost", "root", "", "users_db");
if ($conn->connect_error) {
    die("Échec connexion : " . $conn->connect_error);
}
echo "Connexion réussie !\\n";
$conn->query("CREATE TABLE IF NOT EXISTS test_table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50))");
$conn->query("INSERT INTO test_table (name) VALUES ('Bonjour Anti-Gravity')");
$res = $conn->query("SELECT name FROM test_table LIMIT 1");
if ($res) {
    $row = $res->fetch_assoc();
    echo "Donnée lue : " . $row['name'] . "\\n";
} else {
    echo "Erreur SELECT\\n";
}
?>`
    }
  ],
  currentFile: 'index.php',
  language: 'php',
  examId: 'test-exam-123'
};

async function test() {
  console.log('📡 Envoi de la requête d\'exécution PHP+DB...');
  try {
    const res = await fetch('http://localhost:3001/api/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log('Status Code:', res.status);
    console.log('Stdout:', JSON.stringify(data.stdout));
    console.log('Stderr:', JSON.stringify(data.stderr));
    console.log('DB Updated:', data.databaseUpdated);
  } catch (err) {
    console.error('Erreur réseau :', err);
  }
}

test();
