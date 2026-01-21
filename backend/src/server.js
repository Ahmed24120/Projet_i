const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");
const path = require("path");

const app = express();

// DB
require("./db");

// Routes + sockets
const { initSocket } = require("./sockets");
const authRoutes = require("./routes/auth");
const examsRoutes = require("./routes/exams");
const worksRoutes = require("./routes/works");

// Middlewares
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use("/static", express.static(path.join(__dirname, "../uploads")));

// API routes
app.use("/auth", authRoutes);
app.use("/exams", examsRoutes);
app.use("/works", worksRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "✅ Backend + Socket + DB en marche" });
});

// Server + socket.io
const server = http.createServer(app);
initSocket(server);

// Network Utils
const { isLocalNetwork, hasNetworkChanged } = require("./network");

// Middleware de vérification réseau (Route API)
app.get('/api/check-network', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const isLocal = isLocalNetwork(clientIp);

  if (isLocal) {
    res.json({ isLocal: true, message: '✅ Network OK (Local)' });
  } else {
    // For development, we might allow lenient check or warn
    res.json({ isLocal: false, message: '⚠️ يجب أن تكون متصلاً بشبكة Local WiFi', ip: clientIp });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur Express + Socket.io sur http://localhost:${PORT}`);
});


// Socket.io initialized via initSocket(server) above
