let io = null;

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*", // TODO: mettre l'URL du frontend en production
    },
  });

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);
    // TODO: Ahmed ajoutera ici les événements student-connected, etc.
  });
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

module.exports = { initSocket, getIO };