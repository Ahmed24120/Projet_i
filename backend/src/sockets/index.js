// backend/src/sockets/index.js
const { hasNetworkChanged } = require("../network");
const db = require("../db");

let io = null;

// Présence réseau (heartbeat)
const lastSeen = new Map(); // `${examId}:${studentId}` -> timestamp ms
const key = (examId, studentId) => `${examId}:${studentId}`;

// Timers d’examen centralisés
const activeExams = new Map(); // examId -> { endTime, intervalId }

// Global Connected Students (Monitoring)
const studentsPresence = new Map(); // studentId -> { studentId, name, matricule, ip, status, lastSeen, history: [] }

function addStudentLog(studentId, type, message) {
  const student = studentsPresence.get(studentId);
  if (student) {
    if (!student.history) student.history = [];
    student.history.push({
      type,
      message,
      at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: Date.now()
    });
    // Keep last 50 logs
    if (student.history.length > 50) student.history.shift();
  }
}

let watchdog = null;

function initSocket(server) {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  console.log("✅ Socket.io initialisé (Centralized Timer Mode)");

  io.on("connection", (socket) => {
    console.log("🟢 Client connecté:", socket.id);
    if (socket.userId) {
      socket.join(`student:${socket.userId}`);
    }

    // Initial Sync for new clients
    const activeList = Array.from(activeExams.entries()).map(([id, data]) => ({
      examId: id,
      endAt: data.endTime
    }));
    socket.emit('initial-sync', { activeExams: activeList });

    socket.on("professor-join", () => {
      socket.join('professors');
      socket.emit('update-student-list', Array.from(studentsPresence.values()));
    });

    socket.on("join-exam", ({ examId, studentId, matricule, role }) => {
      if (!examId) return;
      const room = `exam:${examId}`;
      socket.join(room);
      socket.data = { examId, studentId, matricule, role };

      if (studentId) lastSeen.set(key(examId, studentId), Date.now());

      if (role === 'student') {
        const clientIp = socket.handshake.address;
        const existing = studentsPresence.get(studentId);

        if (!existing) {
          studentsPresence.set(studentId, {
            studentId,
            examId,
            matricule: matricule || studentId,
            ip: clientIp,
            status: 'connected',
            name: matricule || studentId,
            lastSeen: Date.now(),
            history: []
          });
          addStudentLog(studentId, 'CONNEXION', 'L\'étudiant s\'est connecté');
        } else {
          // Reconnection or multiple tabs?
          const oldIp = existing.ip;
          existing.examId = examId; // Track current exam
          existing.ip = clientIp;
          existing.status = 'connected';
          existing.lastSeen = Date.now();

          if (oldIp && oldIp !== clientIp && existing.history.length > 0) {
            addStudentLog(studentId, 'RESEAU_SUSPECT', `Changement d'IP détecté : ${oldIp} -> ${clientIp} (Données mobiles ?)`);
            io.to('professors').emit('alert', {
              type: 'NETWORK_CHANGE',
              message: `⚠️ Changement de réseau suspect pour l'étudiant ${matricule || studentId} (de ${oldIp} à ${clientIp})`,
              level: 'warning',
              studentId
            });
          } else {
            addStudentLog(studentId, 'RECONNEXION', 'L\'étudiant s\'est reconnecté');
          }
        }
        io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));
      }

      io.to(room).emit("student-connected", {
        examId,
        studentId,
        matricule,
        role,
        at: Date.now(),
      });
    });

    socket.on("start-exam", ({ examId, durationMin }) => {
      console.log(`📡 Event: start-exam | examId: ${examId}, duration: ${durationMin}`);
      if (!examId) return;
      const id = Number(examId);

      // Stop existing if any
      if (activeExams.has(id)) {
        clearInterval(activeExams.get(id).intervalId);
      }

      const endTime = Date.now() + (Number(durationMin) || 90) * 60 * 1000;

      const intervalId = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTime - now;

        if (timeLeft <= 0) {
          clearInterval(intervalId);
          activeExams.delete(id);

          // UPDATE DB STATUS
          const nowISO = new Date().toISOString();
          db.run("UPDATE examen SET status_code=4, status='finished', finished_at=? WHERE id=?", [nowISO, id]);

          io.emit("exam-ended", { examId: id });
          io.to(`exam:${id}`).emit("exam-ended", { examId: id });
          console.log(`🏁 Exam ${id} finished`);
          return;
        }

        // Broadcast tick every second
        const payload = { examId: id, timeLeft, endAt: endTime };
        io.emit("exam-tick", payload); // Global for list updates
        io.to(`exam:${id}`).emit("exam-tick", payload); // specific room

        // Special warning at 5 mins
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        if (minutes === 5 && seconds === 0) {
          io.emit("exam-warning", { examId: id, minutesLeft: 5 });
        }
      }, 1000);

      activeExams.set(id, { endTime, intervalId });

      // UPDATE DB STATUS
      const nowISO = new Date().toISOString();
      db.run("UPDATE examen SET status_code=2, status='launched', started_at=? WHERE id=?", [nowISO, id]);

      const startedPayload = { examId: id, endAt: endTime };
      io.emit("exam-started", startedPayload);
      console.log(`⏱️ Exam ${id} started via server timer -> ends at ${new Date(endTime).toLocaleTimeString()}`);
    });

    socket.on("stop-exam", ({ examId }) => {
      console.log(`📡 Event: stop-exam | examId: ${examId}`);
      const id = Number(examId);
      const data = activeExams.get(id);
      if (data) {
        clearInterval(data.intervalId);
        activeExams.delete(id);
      }

      // UPDATE DB STATUS
      const nowISO = new Date().toISOString();
      db.run("UPDATE examen SET status_code=3, status='stopped', stopped_at=? WHERE id=?", [nowISO, id]);

      io.emit("exam-stopped", { examId: id });
      io.to(`exam:${id}`).emit("exam-stopped", { examId: id });
      console.log(`⏹️ Exam ${id} stopped manually`);
    });

    socket.on("finish-exam-manual", ({ examId }) => {
      console.log(`📡 Event: finish-exam-manual | examId: ${examId}`);
      const id = Number(examId);
      const data = activeExams.get(id);
      if (data) {
        clearInterval(data.intervalId);
        activeExams.delete(id);
      }

      // UPDATE DB STATUS (4 = Finished)
      const nowISO = new Date().toISOString();
      db.run("UPDATE examen SET status_code=4, status='finished', finished_at=? WHERE id=?", [nowISO, id]);

      io.emit("exam-ended", { examId: id });
      io.to(`exam:${id}`).emit("exam-ended", { examId: id });
      console.log(`🏁 Exam ${id} finished manually`);
    });

    socket.on("cheat-alert", (payload) => {
      // User request: ONLY network-related alerts are kept.
      // We skip TAB_SWITCH and FOCUS_LOST if they arrive, but ideally the frontend stops sending them.
      if (payload.type === 'TAB_SWITCH' || payload.type === 'FOCUS_LOST') return;

      // Save to DB
      db.run(
        "INSERT INTO logs (exam_id, matricule, action, type) VALUES (?, ?, ?, ?)",
        [payload.examId, payload.matricule || payload.studentId, payload.details, 'warn']
      );

      // Add to internal history
      addStudentLog(payload.studentId, 'FRAUDE', payload.details);

      io.to('professors').emit('alert', {
        type: 'CHEAT_ATTEMPT',
        message: `🚨 محاولة غش من الطالب ${payload.matricule || payload.studentId}: ${payload.details}`,
        level: 'danger',
        studentId: payload.studentId
      });
      io.to('professors').emit("cheat-alert", payload);
      io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));
    });

    socket.on("network-status", ({ studentId, online }) => {
      if (!studentId) return;
      const student = studentsPresence.get(studentId);
      if (student) {
        student.status = online ? 'connected' : 'no-wifi';
        student.lastSeen = Date.now();
        const msg = online ? 'Wi-Fi rétabli' : 'Wi-Fi déconnecté';
        addStudentLog(studentId, online ? 'WIFI_RETOUR' : 'WIFI_PERDU', msg);

        if (!online) {
          io.to('professors').emit('alert', {
            type: 'WIFI_OFF',
            message: `📡 الطالب ${student.matricule} فقد الاتصال بالـ Wi-Fi`,
            level: 'warning',
            studentId
          });
        }
        io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));
      }
    });

    socket.on("submission:cancelled", ({ examId, workId }) => {
      const { studentId, matricule } = socket.data;
      if (!examId || !workId) return;

      console.log(`📡 Event: submission:cancelled | workId: ${workId} by ${matricule}`);

      // Mettre à jour la DB
      db.run("UPDATE works SET status = 'cancelled' WHERE id = ?", [workId], function (err) {
        if (err) {
          console.error("❌ Erreur annulation soumission:", err.message);
          return;
        }

        // Notifier le prof
        io.to('professors').emit('professor:submission-update', {
          type: 'CANCELLED',
          examId,
          studentId,
          workId,
          matricule
        });

        // Log
        addStudentLog(studentId, 'ANNULATION', `Annulation du fichier #${workId}`);
        io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));
      });
    });

    socket.on("finalize-exam", ({ examId, studentId }) => {
      if (!studentId) return;

      const sql = `INSERT INTO exam_results (exam_id, student_id, is_finalized, finalized_at) 
                   VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                   ON CONFLICT(exam_id, student_id) DO UPDATE SET is_finalized=1`;

      db.run(sql, [examId, studentId], (err) => {
        if (err) console.error("Error saving finalization:", err);
      });

      const student = studentsPresence.get(String(studentId));
      if (student) {
        student.status = 'finalized';
        // Force update status in memory map for immediate UI reflect
        student.isFinalized = true;

        addStudentLog(studentId, 'FINALISATION', 'L\'étudiant a terminé son examen');

        io.to('professors').emit('alert', {
          type: 'EXAM_FINISHED',
          message: `🏁 الطالب ${student.matricule} انتهى من الامتحان نهائياً`,
          level: 'success',
          studentId
        });
        io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));
      }
    });

    socket.on("student-exit", ({ examId, studentId, matricule }) => {
      console.log(`📡 Event: student-exit | examId: ${examId}, studentId: ${studentId}, matricule: ${matricule}`);

      const nowISO = new Date().toISOString();

      // 1. Marquer la sortie dans exam_results
      const exitSql = `
        INSERT INTO exam_results (exam_id, student_id, has_exited, exited_at, is_finalized) 
        VALUES (?, ?, 1, ?, 0)
        ON CONFLICT(exam_id, student_id) 
        DO UPDATE SET has_exited=1, exited_at=?
      `;

      db.run(exitSql, [examId, studentId, nowISO, nowISO], (err) => {
        if (err) console.error("❌ Error marking student exit:", err);
        else console.log(`✅ Student ${matricule} marked as exited from exam ${examId}`);
      });

      // 2. Logger l'événement
      db.run(`
        INSERT INTO logs (exam_id, student_id, matricule, type, message, timestamp)
        VALUES (?, ?, ?, 'exit', 'Étudiant sorti de l''examen', ?)
      `, [examId, studentId, matricule, nowISO]);

      // 3. Mettre à jour le statut dans studentsPresence
      const student = studentsPresence.get(String(studentId));
      if (student) {
        student.status = 'exited';
        student.hasExited = true;
        student.exitedAt = nowISO;
      }

      // 4. Notifier le professeur
      io.to('professors').emit('student-exited', {
        examId,
        studentId,
        matricule,
        timestamp: nowISO
      });

      io.to('professors').emit('alert', {
        type: 'STUDENT_EXIT',
        message: `🚪 L'étudiant ${matricule} est sorti de l'examen`,
        level: 'warning',
        studentId,
        examId
      });

      io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));

      console.log(`🚪 Student ${matricule} exited exam ${examId}`);
    });

    socket.on("disconnect", () => {
      const { examId, studentId, role } = socket.data || {};
      if (role === 'student' && studentId) {
        const student = studentsPresence.get(studentId);
        if (student) {
          student.status = 'disconnected';
          student.lastSeen = Date.now();
          addStudentLog(studentId, 'DECONNEXION', 'L\'étudiant s\'est déconnecté (Socket close)');
          io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));
          if (examId) {
            io.to(`exam:${examId}`).emit("student-disconnected", { studentId, at: Date.now() });
          }
        }
      }
    });

    socket.on("heartbeat", ({ examId, studentId }) => {
      if (examId && studentId) lastSeen.set(key(examId, studentId), Date.now());
    });
  });

  // Watchdog offline (unique)
  if (watchdog) clearInterval(watchdog);
  watchdog = setInterval(() => {
    const now = Date.now();
    for (const [sid, student] of studentsPresence.entries()) {
      if (student.status === 'connected' && now - (student.lastSeen || 0) > 40000) {
        student.status = 'offline';
        addStudentLog(sid, 'TIMEOUT', 'Inactivité prolongée (offline)');
        io.to('professors').emit('update-student-list', Array.from(studentsPresence.values()));
        // Optional: emit to specific exam rooms if we track examId in presence
      }
    }
    // and cleanup for the legacy lastSeen map
    for (const [k, ts] of lastSeen.entries()) {
      if (now - ts > 45000) {
        const [examId, studentId] = k.split(":");
        io.to(`exam:${examId}`).emit("student-offline", { examId: Number(examId), studentId });
        lastSeen.delete(k);
      }
    }
  }, 10000);
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

module.exports = { initSocket, getIO };
