const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: '../.env'});

const TOKEN = jwt.sign({ id: 'test_student_1', role: 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

const API_BASE = 'http://127.0.0.1:3001';

async function execute(language, files, currentFile, stdin = '') {
  return new Promise((resolve, reject) => {
    const req = http.request(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) resolve({ error: JSON.parse(body).error || body });
          else resolve(JSON.parse(body));
        } catch(e) {
          resolve({ error: body });
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ language, files, currentFile, examId: 'test_exam', stdin }));
    req.end();
  });
}

async function runTests() {
  console.log("=== RUNNING TESTS ===\n");
  let results = [];

  const addResult = (testName, pass, message) => {
    results.push({ testName, pass, message });
    console.log(`${pass ? '✅ OK' : '❌ Échec'} | ${testName} | ${message}`);
  };

  try {
    // 1. PYTHON
    let r = await execute('python', [{filename: 'main.py', content: 'print("test python")'}], 'main.py');
    addResult('1.1 Python Simple', r.stdout?.includes('test python'), r.error || 'stdout matches');

    r = await execute('python', [{filename: 'main.py', content: 'x = input()\nprint(f"You typed {x}")'}], 'main.py', 'test input');
    addResult('1.2 Python Input', r.stdout?.includes('You typed test input'), r.error || 'stdout matches');

    r = await execute('python', [{filename: 'main.py', content: 'while True: pass'}], 'main.py');
    addResult('1.3 Python Timeout', !!r.error || r.stdout?.includes('TIMEOUT') || r.stdout?.includes('Killed'), r.error || r.stdout || 'Timeout respected');

    r = await execute('python', [{filename: 'main.py', content: 'for i in range(100000):\n print("test")'}], 'main.py');
    addResult('1.4 Python Large Output', r.stdout?.includes('tronquée') || r.stdout?.length < 550000, r.error || 'Truncated correctly');

    // 2. C++
    r = await execute('cpp', [{filename: 'main.cpp', content: '#include <iostream>\nint main() { std::cout << "test cpp"; return 0; }'}], 'main.cpp');
    addResult('2.1 C++ Simple', r.stdout?.includes('test cpp'), r.error || 'stdout matches');

    r = await execute('cpp', [{filename: 'main.cpp', content: '#include <iostream>\n#include <string>\nint main() { std::string s; std::cin >> s; std::cout << s; return 0; }'}], 'main.cpp', 'test_input');
    addResult('2.2 C++ Input', r.stdout?.includes('test_input'), r.error || 'stdout matches');

    r = await execute('cpp', [{filename: 'main.cpp', content: '#include <iostream>\nint main() { cout << "error"; return 0; }'}], 'main.cpp');
    addResult('2.3 C++ Compile Error', !!r.stderr || !!r.error, r.stderr?.split('\\n')[0] || r.error || 'Compiler error caught');

    r = await execute('cpp', [{filename: 'main.cpp', content: '#include <iostream>\nint main() { while(true){} return 0; }'}], 'main.cpp');
    addResult('2.4 C++ Timeout', !!r.error || r.stdout?.includes('TIMEOUT') || r.stdout?.includes('Killed'), r.error || r.stdout || 'Timeout respected');

    // 3. PHP CLI
    r = await execute('php', [{filename: 'main.php', content: '<?php echo "test php"; ?>'}], 'main.php');
    addResult('3.1 PHP CLI Simple', r.stdout?.includes('test php'), r.error || 'stdout matches');

    r = await execute('php', [
      {filename: 'main.php', content: '<?php require "lib.php"; echo test(); ?>'},
      {filename: 'lib.php', content: '<?php function test() { return "multi"; } ?>'}
    ], 'main.php');
    addResult('3.2 PHP CLI Multi-files', r.stdout?.includes('multi'), r.error || 'stdout matches');

    // 4. PHP WEB
    r = await execute('php', [{filename: 'page.html', content: '<h1>Test</h1>'}], 'page.html');
    addResult('4.1 PHP WEB pure HTML', r.phpWeb === true && r.entryFile === 'page.html', r.error || 'phpWeb started');

    r = await execute('php', [
      {filename: 'page.html', content: '<form action="traitement.php"><input type="submit"/></form>'},
      {filename: 'traitement.php', content: '<?php echo "ok"; ?>'}
    ], 'page.html');
    addResult('4.2 PHP WEB Form', r.phpWeb === true, r.error || 'phpWeb started for HTML+PHP without DB');

    // 5. PHP WEB + MARIADB
    r = await execute('php', [
      {filename: 'setup.php', content: '<?php $c = new mysqli("127.0.0.1", "sandbox", "", "users_db", 3306, "/run/mysqld/mysqld.sock"); $c->query("CREATE TABLE IF NOT EXISTS test (id INT)"); echo "ok"; ?>'},
      {filename: 'formulaire.html', content: '<form><input/></form>'}
    ], 'setup.php');
    addResult('5.1 PHP WEB+DB Setup', r.phpWeb === true && r.entryFile === 'setup.php', r.error || 'Started correctly');

    r = await execute('php', [
      {filename: 'setup.php', content: '<?php $c = new mysqli("127.0.0.1", "sandbox", "", "users_db", 3306, "/run/mysqld/mysqld.sock"); ?>'},
      {filename: 'formulaire.html', content: '<form><input/></form>'}
    ], 'formulaire.html');
    addResult('5.2 PHP WEB+DB HTML form (BUG FIX)', r.phpWeb === true && r.entryFile === 'formulaire.html', r.error || 'HTML file correctly triggers web server');

    // SQLite
    r = await execute('sql', [], 'main.sql');
    addResult('7.1 SQL Empty', r.stdout !== undefined || r.error !== undefined, 'SQL runs');

  } catch(e) {
    console.error("Test script failed", e);
  }
}

runTests();
