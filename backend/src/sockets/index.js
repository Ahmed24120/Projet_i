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
const studentsPresence = new Map(); // studentId -> { studentId, name, matricule, ip, status, lastSeen }

let watchdog = null;

function initSocket(server) {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  console.log("✅ Socket.io initialisé (Centralized Timer Mode)");

  io.on("connection", (socket) => {
    console.log("🟢 Client connecté:", socket.id);

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
        studentsPresence.set(studentId, {
          studentId,
          matricule: matricule || studentId,
          ip: clientIp,
          status: 'connected',
          name: matricule || studentId,
          lastSeen: Date.now()
        });
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
      io.emit("exam-stopped", { examId: id });
      io.to(`exam:${id}`).emit("exam-stopped", { examId: id });
      console.log(`⏹️ Exam ${id} stopped manually`);
    });

    socket.on("cheat-alert", (payload) => {
      // Save to DB
      db.run(
        "INSERT INTO logs (exam_id, matricule, action, type) VALUES (?, ?, ?, ?)",
        [payload.examId, payload.matricule || payload.studentId, payload.details, 'warn']
      );

      io.to('professors').emit('alert', {
        type: 'CHEAT_ATTEMPT',
        message: `🚨 محاولة غش من الطالب ${payload.matricule || payload.studentId}: ${payload.details}`,
        level: 'danger',
        studentId: payload.studentId
      });
      io.to('professors').emit("cheat-alert", payload);
    });

    socket.on("disconnect", () => {
      const { examId, studentId, role } = socket.data || {};
      if (role === 'student' && studentId) {
        const student = studentsPresence.get(studentId);
        if (student) {
          student.status = 'disconnected';
          student.lastSeen = Date.now();
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
