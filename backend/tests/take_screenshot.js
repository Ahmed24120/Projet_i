const puppeteer = require('puppeteer');
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: '../.env'});
const fs = require('fs');

const TOKEN = jwt.sign({ id: 'puppeteer_test', role: 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
const API_BASE = 'http://127.0.0.1:3001';

const reqOpts = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }
};

function apiCall(path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${API_BASE}${path}`, reqOpts, (res) => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body)); req.end();
  });
}

(async () => {
  try {
    console.log("1. Setup workspace...");
    await apiCall('/api/work/init', { examId: '30' });
    await apiCall('/api/work/changeLanguage', { examId: '30', language: 'php' });
    
    await apiCall('/api/work/file/save', { examId: '30', oldFilename: 'main.php', filename: 'setup.php', content: '<?php $c = new mysqli("127.0.0.1", "sandbox", "", "users_db", 3306, "/run/mysqld/mysqld.sock"); $c->query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255))"); ?>' });
    await apiCall('/api/work/file/save', { examId: '30', oldFilename: '', filename: 'formulaire.html', content: `
<!DOCTYPE html>
<html>
<head><title>Ajouter Utilisateur</title></head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2>Ajouter un nouvel utilisateur</h2>
  <form action="create.php" method="POST">
    <div><label>Nom:</label> <input type="text" name="nom" id="nom_input" /></div>
    <div style="margin-top: 10px;"><label>Email:</label> <input type="email" name="email" id="email_input" /></div>
    <button type="submit" id="submit_btn" style="margin-top: 15px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px;">Ajouter</button>
  </form>
</body>
</html>` });
    await apiCall('/api/work/file/save', { examId: '30', oldFilename: '', filename: 'create.php', content: '<?php $c = new mysqli("127.0.0.1", "sandbox", "", "users_db", 3306, "/run/mysqld/mysqld.sock"); $c->query("INSERT INTO users (name, email) VALUES (\'".$_POST[\'nom\']."\', \'".$_POST[\'email\']."\')"); echo "<h3>Utilisateur ".$_POST[\'nom\']." ajouté avec succès!</h3>"; ?>' });

    console.log("2. Launching Puppeteer...");
    const browser = await puppeteer.launch({ 
      headless: 'new', 
      executablePath: 'C:\\Users\\hp\\.cache\\puppeteer\\chrome\\win64-150.0.7871.24\\chrome-win64\\chrome.exe',
      args: ['--no-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    let iframeContentType = null;
    let iframeStatus = null;

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/execute/php-preview/')) {
        iframeContentType = response.headers()['content-type'];
        iframeStatus = response.status();
        console.log(`[Network] iframe loaded: ${url}`);
        console.log(`[Network] Status: ${iframeStatus}, Content-Type: ${iframeContentType}`);
      }
    });

    await page.evaluateOnNewDocument((token) => {
      localStorage.setItem('token', token);
    }, TOKEN);

    console.log("3. Navigating to IDE...");
    await page.goto('http://localhost:3000/student/exams/30/ide', { waitUntil: 'networkidle0' });

    console.log("4. Selecting formulaire.html...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const htmlTab = tabs.find(t => t.textContent.includes('formulaire.html'));
      if (htmlTab) htmlTab.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    console.log("5. Clicking Exécuter...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const execBtn = buttons.find(b => b.textContent.includes('Exécuter'));
      if (execBtn) execBtn.click();
    });

    console.log("6. Waiting for iframe to render...");
    await new Promise(r => setTimeout(r, 6000)); // wait for container and iframe to load

    const frameElement = await page.$('iframe[title="Prévisualisation PHP"]');
    if (frameElement) {
      console.log("Iframe found!");
      const frame = await frameElement.contentFrame();
      if (frame) {
        console.log("Inside iframe: waiting for form...");
        await frame.waitForSelector('form', {timeout: 5000}).catch(() => console.log("Form not found in iframe"));
      }
    } else {
      console.log("WARNING: Iframe not found in DOM");
    }

    console.log("7. Taking Screenshot 1 (Formulaire)...");
    const outPath1 = 'C:/Users/hp/.gemini/antigravity/brain/8401b16f-0cb3-4b1d-9729-27f3265d8817/formulaire_rendu.png';
    await page.screenshot({ path: outPath1 });
    console.log(`Saved screenshot to ${outPath1}`);

    // Try to fill the form and submit
    if (frameElement) {
        const frame = await frameElement.contentFrame();
        if (frame) {
            console.log("8. Filling form and submitting...");
            await frame.type('#nom_input', 'Test User');
            await frame.type('#email_input', 'test@example.com');
            await frame.click('#submit_btn');
            await new Promise(r => setTimeout(r, 3000));
            
            console.log("9. Taking Screenshot 2 (Résultat)...");
            const outPath2 = 'C:/Users/hp/.gemini/antigravity/brain/8401b16f-0cb3-4b1d-9729-27f3265d8817/formulaire_soumis.png';
            await page.screenshot({ path: outPath2 });
            console.log(`Saved screenshot to ${outPath2}`);
        }
    }

    await browser.close();
    console.log("Done.");

  } catch (e) {
    console.error("Error:", e);
  }
})();
