const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: '../.env'});
const TOKEN = jwt.sign({ id: 'test_student_1', role: 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
const API_BASE = 'http://127.0.0.1:3001';

const postData = JSON.stringify({
  language: 'php',
  currentFile: 'formulaire.html',
  files: [
    {filename: 'setup.php', content: '<?php $c = new mysqli("127.0.0.1", "sandbox", "", "users_db", 3306, "/run/mysqld/mysqld.sock"); ?>'},
    {filename: 'formulaire.html', content: '<form><input/></form>'}
  ],
  examId: 'test_exam'
});

const req = http.request(API_BASE + '/api/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + TOKEN
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    console.log('Execution result:', data);
    
    if (data.containerId) {
      console.log('--- FETCHING PROXY URL ---');
      const proxyUrl = API_BASE + '/api/execute/php-preview/' + data.containerId + '/formulaire.html?token=' + TOKEN;
      console.log('URL:', proxyUrl);
      
      require('child_process').execSync('curl -i "' + proxyUrl + '"', {stdio: 'inherit'});
    }
  });
});
req.write(postData);
req.end();
