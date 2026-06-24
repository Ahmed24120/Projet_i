require('dotenv').config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");
const path = require("path");
const mongoose = require('mongoose');

const app = express();

// MongoDB pour l'IDE (ideWork + sessions)
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pse')
  .then(() => console.log('✅ MongoDB connecté pour l\'IDE'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// DB
require("./db");

// Routes + sockets
const { initSocket } = require("./sockets");
const authRoutes = require("./routes/auth");
const examsRoutes = require("./routes/exams");
const worksRoutes = require("./routes/works");
const ideWorkRoutes = require('./routes/ideWork');
const executeRoutes = require('./routes/execute');

// Middlewares
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(helmet({
  frameguard: false, // Permet l'affichage des PDF dans les iframes (sujet étudiant)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["*"], // Autorise l'embedding dans des iframes
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      connectSrc: ["'self'", "*"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permet les requêtes cross-origin pour les fichiers statiques
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads — Allow cross-origin access and iframe embedding for PDF subject files
app.use("/static", (req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "../uploads")));

// API routes
app.use("/auth", authRoutes);
app.use("/exams", examsRoutes);
app.use("/works", worksRoutes);
app.use('/api/work', ideWorkRoutes);
app.use('/api/execute', executeRoutes);

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
