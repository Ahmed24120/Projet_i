// backend/src/sockets/index.js
let io = null;

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*", // TODO: en prod, mets l'URL du frontend
      methods: ["GET", "POST"],
    },
  });

  console.log("✅ Socket.io initialisé");

  io.on("connection", (socket) => {
    console.log("🟢 New client connected:", socket.id);

    // === TEST SIMPLE : ping -> pong ===
    socket.on("ping", (data) => {
      console.log("📩 ping reçu :", data);
      // répondre juste à l’émetteur
      socket.emit("pong", {
        ok: true,
        echo: data,
        serverTime: new Date().toISOString(),
      });
    });

    // === ROOMS D’EXAMEN (optionnel, prêt à l’emploi) ===
    // rejoindre une room d’examen
    socket.on("join-exam", ({ examId, userId, role }) => {
      if (!examId) return;
      const room = `exam:${examId}`;
      socket.join(room);
      console.log(`👥 ${userId || socket.id} a rejoint ${room} (${role || "unknown"})`);
      // notifier toute la room (professeur inclus)
      io.to(room).emit("student-connected", {
        examId,
        userId: userId || socket.id,
        role: role || "unknown",
        at: Date.now(),
      });
    });

    // quitter une room d’examen
    socket.on("leave-exam", ({ examId, userId }) => {
      if (!examId) return;
      const room = `exam:${examId}`;
      socket.leave(room);
      io.to(room).emit("student-disconnected", {
        examId,
        userId: userId || socket.id,
        at: Date.now(),
      });
    });

    // notifier un fichier soumis (si tu l’appelles depuis l’API HTTP après upload)
    socket.on("file-submitted", ({ examId, studentId, fileName }) => {
      if (!examId) return;
      const room = `exam:${examId}`;
      io.to(room).emit("file-submitted", {
        examId,
        studentId,
        fileName,
        at: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

module.exports = { initSocket, getIO };
