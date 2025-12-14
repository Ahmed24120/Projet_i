// backend/src/sockets/index.js
let io = null;

// Présence réseau (heartbeat)
const lastSeen = new Map(); // key: `${examId}:${studentId}` -> timestamp ms
const key = (examId, studentId) => `${examId}:${studentId}`;

// Timers d’examen (démarrage/prof → warning -5min → fin)
const examTimers = new Map(); // examId -> { endAt, toWarn, toEnd }

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  console.log("✅ Socket.io initialisé");

  io.on("connection", (socket) => {
    console.log("🟢 Client connecté:", socket.id);

    // --- Ping/Pong simple (pour ta page /socket-test)
    socket.on("ping", (data) => {
      socket.emit("pong", { ok: true, echo: data, serverTime: new Date().toISOString() });
    });

    // --- Rejoindre/quitter une room d’examen
    socket.on("join-exam", ({ examId, studentId, matricule, role }) => {
      if (!examId) return;
      const room = `exam:${examId}`;
      socket.join(room);
      socket.data = { examId, studentId, matricule, role };
      if (studentId) lastSeen.set(key(examId, studentId), Date.now());
      io.to(room).emit("student-connected", {
        examId,
        studentId: studentId || socket.id,
        matricule,
        role,
        at: Date.now(),
      });
    });

    socket.on("leave-exam", ({ examId, studentId }) => {
      if (!examId) return;
      const room = `exam:${examId}`;
      socket.leave(room);
      io.to(room).emit("student-disconnected", {
        examId,
        studentId: studentId || socket.id,
        at: Date.now(),
      });
    });

    // --- Heartbeat pour présence réseau (Wi-Fi)
    socket.on("heartbeat", ({ examId, studentId }) => {
      if (examId && studentId) lastSeen.set(key(examId, studentId), Date.now());
    });

    // --- Notification d’upload (si tu veux pousser depuis client)
    socket.on("file-submitted", ({ examId, studentId, fileName, is_final }) => {
      if (!examId) return;
      io.to(`exam:${examId}`).emit("submission-upserted", {
        examId,
        studentId,
        fileName,
        is_final: !!is_final,
        at: Date.now(),
      });
    });

    // --- ⏱️ Démarrer/Stopper l’examen (émis par la page professeur)
    socket.on("start-exam", ({ examId, durationMin, endAt }) => {
      if (!examId) return;
      const room = `exam:${examId}`;

      // calcule fin si non fournie
      const end = endAt ? new Date(endAt).getTime()
                        : Date.now() + (Number(durationMin) || 90) * 60 * 1000;

      // clear anciens timers
      const old = examTimers.get(examId);
      if (old) { clearTimeout(old.toWarn); clearTimeout(old.toEnd); }

      const msLeft = Math.max(end - Date.now(), 0);
      const warnIn = Math.max(msLeft - 5 * 60 * 1000, 0);

      const toWarn = setTimeout(() => {
        io.to(room).emit("exam-warning", { examId, minutesLeft: 5, endAt: end });
      }, warnIn);

      const toEnd = setTimeout(() => {
        io.to(room).emit("exam-ended", { examId, endAt: end });
      }, msLeft);

      examTimers.set(examId, { endAt: end, toWarn, toEnd });

      io.to(room).emit("exam-started", { examId, endAt: end });
      console.log(`⏱️ Exam ${examId} started → endAt=${new Date(end).toISOString()}`);
    });

    socket.on("stop-exam", ({ examId }) => {
      const t = examTimers.get(examId);
      if (t) { clearTimeout(t.toWarn); clearTimeout(t.toEnd); examTimers.delete(examId); }
      io.to(`exam:${examId}`).emit("exam-stopped", { examId });
      console.log(`⏹️ Exam ${examId} stopped`);
    });

    // --- Déconnexion
    socket.on("disconnect", () => {
      const { examId, studentId } = socket.data || {};
      if (!examId) return;
      io.to(`exam:${examId}`).emit("student-disconnected", {
        examId,
        studentId: studentId || socket.id,
        at: Date.now(),
      });
    });
  });

  // Watchdog: si plus de heartbeat >20s → offline
  setInterval(() => {
    const now = Date.now();
    for (const [k, ts] of lastSeen.entries()) {
      if (now - ts > 20000) {
        const [examId, studentId] = k.split(":");
        io.to(`exam:${examId}`).emit("student-offline", {
          examId: Number(examId),
          studentId,
          at: now,
        });
        lastSeen.delete(k);
      }
    }
  }, 15000);
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

module.exports = { initSocket, getIO };
