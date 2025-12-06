const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");

const app = express();
const server = http.createServer(app);

// Ahmed: le WebSocket sera initialisé ici
// const { initSocket } = require("./sockets");
// initSocket(server);

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// ici plus tard :
// const authRoutes = require("./routes/auth");
// app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Backend is running" });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
