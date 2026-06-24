const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const Log = require('../../models/Log');
const Work = require('../../models/Work');
const { authenticateToken } = require('../middleware/auth');

const { getIO } = require('../sockets');
const os = require('os');

const docker = new Docker();

// ── Concurrency Configuration (Double Pool) ─────────────────────────────────
//
// Formule de calcul dynamique du pool lourd tenant compte de la charge du pool léger :
// 1. On estime la RAM totale du serveur
const totalRAM_MB = os.totalmem() / (1024 * 1024);

// 2. On définit la RAM consommée par le pool léger s'il était plein (256 Mo par tâche légère)
const MAX_CONCURRENT_LIGHT = parseInt(process.env.MAX_CONCURRENT_LIGHT || process.env.MAX_CONCURRENT_EXECUTIONS || '15', 10);
const maxLightMemory_MB = MAX_CONCURRENT_LIGHT * 256;

// 3. On calcule la RAM libre sécurisée restante sur le serveur (marge globale de 30% pour l'OS, MongoDB, SQLite, etc.)
const safeRemainingRAM_MB = (totalRAM_MB * 0.7) - maxLightMemory_MB;

// 4. Chaque slot lourd consomme 256 Mo (RAM conteneur) + 128 Mo (tmpfs MariaDB) = 384 Mo
const calculatedHeavyLimit = Math.max(2, Math.floor(safeRemainingRAM_MB / 384));

const MAX_CONCURRENT_HEAVY = parseInt(process.env.MAX_CONCURRENT_HEAVY || String(calculatedHeavyLimit), 10);

// Taille max de la file d'attente (au-delà, on répond 503 immédiatement)
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '50', 10);

// Compteurs exposés pour le monitoring (GET /api/execute/stats)
let activeContainers = 0;
let queuedRequests = 0;

// Custom concurrency limiter supporting queue position WebSocket updates
const createLimit = (concurrency, queueType) => {
  let active = 0;
  const queue = [];

  const notifyQueuePositions = () => {
    const io = getIO();
    if (!io) return;
    queue.forEach((item, index) => {
      const position = index + 1;
      io.to(`student:${item.studentId}`).emit('queue-update', {
        queueType,
        position,
        total: queue.length
      });
    });
  };

  const next = () => {
    active--;
    activeContainers = limitLight.getStats().active + limitHeavy.getStats().active;
    queuedRequests = limitLight.getStats().queued + limitHeavy.getStats().queued;
    if (queue.length > 0) {
      const item = queue.shift();
      item.resolve();
      notifyQueuePositions();
    }
  };

  const limitFn = async (studentId, fn) => {
    if (active >= concurrency) {
      if (queue.length >= MAX_QUEUE_SIZE) {
        throw new Error('QUEUE_FULL');
      }
      let resolvePromise;
      const p = new Promise(resolve => { resolvePromise = resolve; });
      queue.push({ resolve: resolvePromise, studentId });
      notifyQueuePositions();
      queuedRequests = limitLight.getStats().queued + limitHeavy.getStats().queued;
      await p;
    }
    active++;
    activeContainers = limitLight.getStats().active + limitHeavy.getStats().active;
    queuedRequests = limitLight.getStats().queued + limitHeavy.getStats().queued;
    try {
      return await fn();
    } finally {
      next();
    }
  };

  limitFn.getStats = () => ({ active, queued: queue.length, concurrency, maxQueue: MAX_QUEUE_SIZE });
  return limitFn;
};

const limitLight = createLimit(MAX_CONCURRENT_LIGHT, 'light');
const limitHeavy = createLimit(MAX_CONCURRENT_HEAVY, 'heavy');

const MAX_OUTPUT_SIZE = 500 * 1024;  // 500 Ko
const MAX_CODE_SIZE = 100 * 1024;    // 100 Ko
const TIMEOUT_MS = 20000;            // 20 secondes (C++, Python, PHP classique)
const TIMEOUT_PHP_DB_MS = 35000;     // 35 secondes (PHP + MariaDB)

const extMap = {
  cpp: 'cpp',
  php: 'php',
  python: 'py',
  sql: 'sql',
};

const SQL_UPLOADS = path.join(__dirname, '../../uploads/sql');

// ── Helper: find a free port on loopback ────────────────────────────────────
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = require('net').createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// ── Helper: wait until PHP server is ready (max 5s) ─────────────────────────
function waitForPhpServer(port, retries = 20, delayMs = 250) {
  return new Promise((resolve, reject) => {
    const tryConnect = (n) => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (n <= 0) return reject(new Error('PHP server did not start in time'));
        setTimeout(() => tryConnect(n - 1), delayMs);
      });
      req.setTimeout(200, () => { req.destroy(); });
    };
    tryConnect(retries);
  });
}

// ── Detect if a PHP file contains HTML (web-server mode needed) ──────────────
function isPhpWebApp(files) {
  return files.some(f =>
    f.filename && (
      f.filename.endsWith('.html') || (
        f.filename.endsWith('.php') &&
        typeof f.content === 'string' &&
        /<(html|form|input|head|body|!DOCTYPE)/i.test(f.content)
      )
    )
  );
}

// ── Active PHP-web containers (containerId → { port, tempDir, timer, studentId, examId, usesDatabase }) ───
const phpWebContainers = new Map();

// ── Helper: dump database state from a running container ─────────────────────
async function dumpWebContainerDatabase(containerId, studentId, examId, tempDir) {
  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['/usr/local/bin/dump-db.sh'],
      AttachStdout: true,
      AttachStderr: true
    });
    const stream = await exec.start({});
    await new Promise((resolve, reject) => {
      stream.on('data', () => {});
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const exportPath = path.join(tempDir, 'db_dump_export.sql');
    if (fs.existsSync(exportPath)) {
      const stats = fs.statSync(exportPath);
      let dumpContent = '';
      if (stats.size > 2 * 1024 * 1024) {
        const fd = fs.openSync(exportPath, 'r');
        const buffer = Buffer.alloc(2 * 1024 * 1024);
        const bytesRead = fs.readSync(fd, buffer, 0, 2 * 1024 * 1024, 0);
        fs.closeSync(fd);
        
        let rawStr = buffer.toString('utf8', 0, bytesRead);
        let lastSemiColonIndex = Math.max(rawStr.lastIndexOf(';\n'), rawStr.lastIndexOf(';\r\n'));
        if (lastSemiColonIndex !== -1) {
          dumpContent = rawStr.substring(0, lastSemiColonIndex + 1);
        } else {
          let lastLineEnd = Math.max(rawStr.lastIndexOf('\n'), rawStr.lastIndexOf('\r'));
          if (lastLineEnd !== -1) {
            dumpContent = rawStr.substring(0, lastLineEnd);
          } else {
            dumpContent = rawStr;
          }
        }
      } else {
        dumpContent = fs.readFileSync(exportPath, 'utf8');
      }

      await Work.findOneAndUpdate(
        { studentId, examId },
        { $set: { "databaseDump.content": dumpContent, "databaseDump.updatedAt": new Date() } }
      );
    }
  } catch (err) {
    console.error('Error in dumpWebContainerDatabase:', err);
  }
}

// ── Helper: clean up any existing PHP Web container for this student & exam ───
async function cleanExistingWebContainer(studentId, examId) {
  for (const [containerId, entry] of phpWebContainers.entries()) {
    if (entry.studentId === studentId && entry.examId === examId) {
      clearTimeout(entry.timer);
      if (entry.usesDatabase) {
        await dumpWebContainerDatabase(containerId, studentId, examId, entry.tempDir);
      }
      try {
        const container = docker.getContainer(containerId);
        await container.kill();
        await container.remove();
      } catch (e) {
        // ignore if already dead/removed
      }
      if (entry.tempDir && fs.existsSync(entry.tempDir)) {
        try { fs.rmSync(entry.tempDir, { recursive: true, force: true }); } catch (e) {}
      }
      phpWebContainers.delete(containerId);
    }
  }
}

// ── PHP WEB SERVER MODE ──────────────────────────────────────────────────────
async function runPhpWebServer(files, currentFile, studentId, examId, usesDatabase = false, dbDumpContent = null) {
  const tempDirName = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempDir = path.join(__dirname, '../../uploads/temp_export', tempDirName);
  fs.mkdirSync(tempDir, { recursive: true });

  for (const file of files) {
    if (file.filename && typeof file.content === 'string') {
      fs.writeFileSync(path.join(tempDir, file.filename), file.content);
    }
  }

  if (usesDatabase && dbDumpContent) {
    fs.writeFileSync(path.join(tempDir, 'db_dump_import.sql'), dbDumpContent, 'utf8');
  }

  const hostPort = await getFreePort();

  let cmd;
  let bindMode = 'ro';
  let tmpfsOptions = {};
  let memoryLimit = 128 * 1024 * 1024;
  let pidsLimit = 30;

  if (usesDatabase) {
    cmd = ['/usr/local/bin/run-php-web-db.sh'];
    bindMode = 'rw';
    tmpfsOptions = { '/var/lib/mysql': 'rw,noexec,nosuid,size=128m,uid=1000,gid=1000' };
    memoryLimit = 256 * 1024 * 1024;
    pidsLimit = 50;
  } else {
    cmd = ['php', '-S', '0.0.0.0:8000', '-t', '/workspace'];
  }

  const container = await docker.createContainer({
    Image: 'pse-sandbox',
    Cmd: cmd,
    HostConfig: {
      NetworkMode: 'bridge',
      Memory: memoryLimit,
      PidsLimit: pidsLimit,
      AutoRemove: false,
      Binds: [`${tempDir}:/workspace:${bindMode}`],
      PortBindings: { '8000/tcp': [{ HostIp: '127.0.0.1', HostPort: String(hostPort) }] },
      Tmpfs: tmpfsOptions
    },
    ExposedPorts: { '8000/tcp': {} },
  });

  await container.start();

  try {
    const retries = usesDatabase ? 40 : 20;
    await waitForPhpServer(hostPort, retries);
  } catch (e) {
    try { await container.kill(); } catch (_) {}
    try { await container.remove(); } catch (_) {}
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error(usesDatabase ? 'Le serveur PHP et la base de données n\'ont pas pu démarrer.' : 'Le serveur PHP n\'a pas pu démarrer.');
  }

  const containerId = container.id;

  // Auto-kill after 5 minutes of inactivity
  const timer = setTimeout(async () => {
    if (usesDatabase) {
      try {
        await dumpWebContainerDatabase(containerId, studentId, examId, tempDir);
      } catch (e) {
        console.error(`Failed to dump database on timeout for web container ${containerId}:`, e);
      }
    }
    try { await container.kill(); } catch (_) {}
    try { await container.remove(); } catch (_) {}
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    phpWebContainers.delete(containerId);
  }, 5 * 60 * 1000);

  phpWebContainers.set(containerId, {
    port: hostPort,
    tempDir,
    timer,
    studentId,
    examId,
    usesDatabase
  });

  return { containerId, hostPort, entryFile: currentFile };
}

// ── CLI SANDBOX (C++, Python, PHP CLI, SQL) ──────────────────────────────────
async function runInSandbox(files, currentFile, language, dbFilePath, stdinContent, isPhpDb = false, dbDumpContent = null, examId = null, studentId = null) {
  return new Promise(async (resolve, reject) => {
    let container;
    let tempDir;
    try {
      const tempDirName = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      tempDir = path.join(__dirname, '../../uploads/temp_export', tempDirName);
      fs.mkdirSync(tempDir, { recursive: true });

      // Write all files to the temporary directory
      for (const file of files) {
        if (file.filename && typeof file.content === 'string') {
          fs.writeFileSync(path.join(tempDir, file.filename), file.content);
        }
      }

      // ── Write stdin to input.txt for reliable injection ───────────────────
      const hasStdin = typeof stdinContent === 'string' && stdinContent.length > 0;
      if (hasStdin) {
        fs.writeFileSync(path.join(tempDir, 'input.txt'), stdinContent);
      }

      // If SQL language and a DB file exists, copy it into the temp dir (SQLite)
      if (language === 'sql' && dbFilePath && fs.existsSync(dbFilePath)) {
        fs.copyFileSync(dbFilePath, path.join(tempDir, 'uploaded_db'));
      }

      // If PHP DB is enabled, write the imported database dump to temp dir
      if (isPhpDb && dbDumpContent) {
        fs.writeFileSync(path.join(tempDir, 'db_dump_import.sql'), dbDumpContent, 'utf8');
      }

      let cmd;
      let bindMode = 'ro';
      let tmpfsOptions = {};

      if (language === 'sql') {
        const dbExt = dbFilePath ? path.extname(dbFilePath).toLowerCase() : null;
        if (dbFilePath && dbExt === '.sql') {
          cmd = ['sh', '-c', `sqlite3 /tmp/exam.db < /workspace/uploaded_db && sqlite3 -header -column /tmp/exam.db < /workspace/${currentFile}`];
        } else if (dbFilePath && dbExt === '.db') {
          cmd = ['sh', '-c', `cp /workspace/uploaded_db /tmp/exam.db && sqlite3 -header -column /tmp/exam.db < /workspace/${currentFile}`];
        } else {
          cmd = ['sh', '-c', `sqlite3 -header -column /tmp/exam.db < /workspace/${currentFile}`];
        }
      } else if (isPhpDb) {
        cmd = ['/usr/local/bin/run-php-db.sh', currentFile];
        bindMode = 'rw'; // Lecture/Écriture requise pour sauvegarder le dump de sortie db_dump_export.sql
        tmpfsOptions = { '/var/lib/mysql': 'rw,noexec,nosuid,size=128m,uid=1000,gid=1000' };
      } else {
        const stdinRedirect = hasStdin ? '< /workspace/input.txt' : '';
        const commandMap = {
          cpp:    ['sh', '-c', `g++ -o /tmp/prog /workspace/${currentFile} && /tmp/prog ${stdinRedirect}`],
          php:    ['sh', '-c', `php /workspace/${currentFile} ${stdinRedirect}`],
          python: ['sh', '-c', `python3 /workspace/${currentFile} ${stdinRedirect}`],
        };
        cmd = commandMap[language];
      }

      container = await docker.createContainer({
        Image: 'pse-sandbox',
        Cmd: cmd,
        HostConfig: {
          NetworkMode: 'none',
          Memory: 256 * 1024 * 1024, // 256 Mo
          PidsLimit: 50,
          AutoRemove: true,
          Binds: [`${tempDir}:/workspace:${bindMode}`],
          Tmpfs: tmpfsOptions
        },
      });

      const stream = await container.attach({ stream: true, stdout: true, stderr: true });
      await container.start();

      let stdout = '';
      let stderr = '';
      let outputSize = 0;
      let timedOut = false;
      let outputLimitExceeded = false;

      // Timeout kill
      const currentTimeoutMs = isPhpDb ? TIMEOUT_PHP_DB_MS : TIMEOUT_MS;
      const timeoutHandle = setTimeout(async () => {
        timedOut = true;
        try { await container.kill(); } catch (_) { }
        stream.destroy();
        reject(new Error(`Timeout: exécution dépassée (${currentTimeoutMs / 1000}s)`));
      }, currentTimeoutMs);

      container.modem.demuxStream(
        stream,
        {
          write(data) {
            outputSize += data.length;
            if (outputSize > MAX_OUTPUT_SIZE) {
              outputLimitExceeded = true;
              try { container.kill().catch(() => { }); } catch (_) { }
              stream.destroy();
              return;
            }
            stdout += data.toString('utf8');
          }
        },
        {
          write(data) {
            outputSize += data.length;
            if (outputSize > MAX_OUTPUT_SIZE) {
              outputLimitExceeded = true;
              try { container.kill().catch(() => { }); } catch (_) { }
              stream.destroy();
              return;
            }
            stderr += data.toString('utf8');
          }
        }
      );

      stream.on('end', async () => {
        if (timedOut) return;
        clearTimeout(timeoutHandle);

        let databaseUpdated = false;
        let dbWarning = '';

        if (isPhpDb && examId && studentId) {
          const exportPath = path.join(tempDir, 'db_dump_export.sql');
          if (fs.existsSync(exportPath)) {
            try {
              const stats = fs.statSync(exportPath);
              let dumpContent = '';
              if (stats.size > 2 * 1024 * 1024) {
                dbWarning = "\n⚠️ La base de données est trop volumineuse (max 2 Mo). Le dump a été tronqué pour préserver l'espace.";
                
                const fd = fs.openSync(exportPath, 'r');
                const buffer = Buffer.alloc(2 * 1024 * 1024);
                const bytesRead = fs.readSync(fd, buffer, 0, 2 * 1024 * 1024, 0);
                fs.closeSync(fd);
                
                let rawStr = buffer.toString('utf8', 0, bytesRead);
                
                // Troncature intelligente : trouver le dernier point-virgule complet suivi d'un saut de ligne
                let lastSemiColonIndex = Math.max(rawStr.lastIndexOf(';\n'), rawStr.lastIndexOf(';\r\n'));
                if (lastSemiColonIndex !== -1) {
                  dumpContent = rawStr.substring(0, lastSemiColonIndex + 1);
                } else {
                  // Fallback : couper à la dernière ligne complète avant la limite des 2 Mo
                  let lastLineEnd = Math.max(rawStr.lastIndexOf('\n'), rawStr.lastIndexOf('\r'));
                  if (lastLineEnd !== -1) {
                    dumpContent = rawStr.substring(0, lastLineEnd);
                  } else {
                    dumpContent = rawStr;
                  }
                }
              } else {
                dumpContent = fs.readFileSync(exportPath, 'utf8');
              }

              // Mettre à jour l'état de la base de données dans MongoDB
              await Work.findOneAndUpdate(
                { studentId, examId },
                { $set: { "databaseDump.content": dumpContent, "databaseDump.updatedAt": new Date() } }
              );
              databaseUpdated = true;
            } catch (err) {
              console.error('Error saving exported database dump:', err);
            }
          }
        }

        if (tempDir && fs.existsSync(tempDir)) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
        }

        if (outputLimitExceeded) {
          reject(new Error('Output limit exceeded (500 Ko)'));
        } else {
          resolve({ stdout, stderr: stderr + dbWarning, databaseUpdated });
        }
      });

      stream.on('error', (err) => {
        clearTimeout(timeoutHandle);
        if (tempDir && fs.existsSync(tempDir)) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
        }
        if (!timedOut && !outputLimitExceeded) reject(err);
      });

    } catch (err) {
      if (tempDir && fs.existsSync(tempDir)) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
      }
      if (container) {
        try { await container.kill(); } catch (_) { }
      }
      reject(err);
    }
  });
}

// ── GET /api/execute/stats  (monitoring — pas besoin d'auth)
router.get('/stats', (req, res) => {
  res.json({
    light: limitLight.getStats(),
    heavy: limitHeavy.getStats(),
  });
});

// ── GET /api/execute/php-preview/:containerId/* ──────────────────────────────
// Transparent reverse-proxy to the ephemeral PHP built-in server (loopback only).
// Handles both GET (page load) and POST (form submission).
router.use('/php-preview/:containerId', (req, res, next) => {
  const token = req.query.token || (req.headers.cookie && req.headers.cookie.split(';').find(c => c.trim().startsWith('ide_token='))?.split('=')[1]);
  if (!token) return res.status(401).send('Non autorisé. Authentification requise.');
  
  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET || "secret", (err, user) => {
    if (err) return res.status(403).send('Session expirée ou invalide.');
    req.user = user;
    // Set a short-lived cookie so subsequent POST form submissions work seamlessly
    if (req.query.token) {
      res.setHeader('Set-Cookie', `ide_token=${req.query.token}; Path=/; Max-Age=300; SameSite=Lax`);
    }
    next();
  });
});

router.use('/php-preview/:containerId', (req, res) => {
  const { containerId } = req.params;
  const entry = phpWebContainers.get(containerId);
  if (!entry) {
    return res.status(404).send('Serveur PHP expiré ou introuvable. Relancez l\'exécution.');
  }

  const upstream = req.url || '/';
  const options = {
    hostname: '127.0.0.1',
    port: entry.port,
    path: upstream,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${entry.port}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    // Allow display in iframe
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.status(502).send(`Erreur proxy PHP: ${e.message}`);
  });

  if (req.method === 'POST') {
    // Re-serialize body if it was parsed by express urlencoded/json middlewares
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded') && req.body) {
      const qs = require('querystring');
      const bodyStr = qs.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyStr));
      proxyReq.write(bodyStr);
      proxyReq.end();
    } else if (req.headers['content-type']?.includes('application/json') && req.body) {
      const bodyStr = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyStr));
      proxyReq.write(bodyStr);
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  } else {
    proxyReq.end();
  }
});

// POST /api/execute
router.post('/', authenticateToken, async (req, res) => {
  const { files, currentFile, language, examId, stdin } = req.body;

  if (!files || !currentFile || !language) return res.status(400).json({ error: 'files, currentFile et language requis' });
  if (!extMap[language]) return res.status(400).json({ error: `Langage non supporté: ${language}. Utilisez cpp, php ou python` });

  // Détection de l'usage MySQL/MariaDB sur l'ensemble des fichiers PHP du workspace
  const allPhpCode = files.filter(f => f.filename.endsWith('.php')).map(f => f.content).join('\n');
  const usesDatabase = language === 'php' && /mysqli_connect|new\s+mysqli|PDO\s*\(\s*['"]mysql:/i.test(allPhpCode);

  const activeLimit = usesDatabase ? limitHeavy : limitLight;
  const stats = activeLimit.getStats();

  // Vérification taille de la file avant d'entrer dans le limiter
  if (stats.queued >= MAX_QUEUE_SIZE) {
    return res.status(503).json({
      error: 'Serveur surchargé : trop de demandes simultanées. Réessayez dans quelques secondes.',
      queued: stats.queued,
      active: stats.active,
    });
  }

  // Calcul approximatif de la taille totale
  let totalSize = 0;
  for (const f of files) totalSize += Buffer.byteLength(f.content || '', 'utf8');
  if (totalSize > MAX_CODE_SIZE) {
    return res.status(413).json({ error: 'Code global trop volumineux (max 100 Ko)' });
  }

  let result;
  let success = false;
  let dbFilePath = null;
  let dbDumpContent = null;

  // Pour SQL (SQLite) : récupérer le fichier DB de l'étudiant
  if (language === 'sql' && examId) {
    try {
      const work = await Work.findOne({ studentId: req.user.id, examId });
      if (work?.sqlDatabaseFile?.diskFilename) {
        dbFilePath = path.join(SQL_UPLOADS, work.sqlDatabaseFile.diskFilename);
      }
    } catch (e) {
      console.error('Error fetching SQL DB file:', e);
    }
  }

  // Pour PHP + DB (MySQL/MariaDB) : récupérer le dump de base de données existant
  if (usesDatabase && examId) {
    try {
      const work = await Work.findOne({ studentId: req.user.id, examId });
      if (work?.databaseDump?.content) {
        dbDumpContent = work.databaseDump.content;
      }
    } catch (e) {
      console.error('Error fetching PHP database dump:', e);
    }
  }

  try {
    // ── PHP Web App mode (HTML + form detected, avec ou sans database) ───────
    if (language === 'php' && isPhpWebApp(files)) {
      await cleanExistingWebContainer(req.user.id, examId);
      const { containerId, entryFile } = await runPhpWebServer(files, currentFile, req.user.id, examId, usesDatabase, dbDumpContent);
      result = { stdout: '', stderr: '', phpWeb: true, containerId, entryFile };
      success = true;
      return res.json(result);
    }

    // ── CLI / Sandbox mode (C++, Python, PHP CLI, PHP+DB, SQL) ───────────────
    result = await activeLimit(req.user.id, () => 
      runInSandbox(files, currentFile, language, dbFilePath, stdin, usesDatabase, dbDumpContent, examId, req.user.id)
    );
    success = true;
    res.json({ 
      stdout: result.stdout, 
      stderr: result.stderr, 
      databaseUpdated: result.databaseUpdated || false 
    });
  } catch (err) {
    result = { error: err.message };
    if (err.message === 'QUEUE_FULL') {
      res.status(503).json({ error: 'Serveur surchargé : file d\'exécution pleine. Réessayez dans quelques secondes.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }

  // Log de l'exécution
  try {
    await Log.create({
      userId: req.user?.id || null,
      action: 'execute',
      details: {
        language,
        examId: examId || null,
        success,
        outputPreview: result?.stdout?.substring(0, 200) || result?.error?.substring(0, 200)
      }
    });
  } catch (_) { /* ne pas bloquer si le log échoue */ }
});

module.exports = router;
