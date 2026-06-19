// backend/tests/simulate-load.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

// 1. Générer un token d'authentification valide pour un étudiant de test
const token = jwt.sign(
  { id: 999, role: 'student', name: 'Charge Test Student', matricule: '99999' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔑 Token généré avec succès.');

const payload = {
  files: [
    {
      filename: 'index.php',
      content: `<?php
$conn = new mysqli("localhost", "root", "", "users_db");
if ($conn->connect_error) {
    die("Échec : " . $conn->connect_error);
}
$conn->query("CREATE TABLE IF NOT EXISTS test_load (id INT AUTO_INCREMENT PRIMARY KEY, val VARCHAR(50))");
$conn->query("INSERT INTO test_load (val) VALUES ('load')");
$res = $conn->query("SELECT COUNT(*) as total FROM test_load");
$row = $res->fetch_assoc();
echo "Total rows: " . $row['total'];
?>`
    }
  ],
  currentFile: 'index.php',
  language: 'php',
  examId: '9999' // Exam ID de test
};

async function sendRequest(id) {
  const start = Date.now();
  try {
    const response = await fetch('http://localhost:3001/api/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    if (response.ok) {
      console.log(`[Req #${id}] ✅ Succès (${duration}s) | Output: ${data.stdout.trim()} | DB Updated: ${data.databaseUpdated}`);
      return 'success';
    } else {
      console.log(`[Req #${id}] ⚠️ Erreur ${response.status} (${duration}s) | Msg: ${data.error}`);
      return response.status === 503 ? '503_queue_full' : 'error';
    }
  } catch (err) {
    console.error(`[Req #${id}] ❌ Erreur réseau :`, err.message);
    return 'network_error';
  }
}

async function run() {
  console.log('🚀 Démarrage de la simulation de charge : Envoi de 50 requêtes PHP+DB parallèles...');
  
  const promises = [];
  for (let i = 1; i <= 50; i++) {
    promises.push(sendRequest(i));
  }
  
  const results = await Promise.all(promises);
  
  const summary = results.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📊 Résumé des résultats :');
  console.log(` - Succès : ${summary['success'] || 0}`);
  console.log(` - File d'attente pleine (503) : ${summary['503_queue_full'] || 0}`);
  console.log(` - Autres erreurs : ${summary['error'] || 0}`);
  console.log(` - Erreurs réseau : ${summary['network_error'] || 0}`);
}

run();
