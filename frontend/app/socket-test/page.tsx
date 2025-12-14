"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export default function SocketTestPage() {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    // URL du backend (WebSocket)
    const backendUrl = "http://localhost:3001";

    // initialiser le client si pas encore fait
    if (!socket) {
      socket = io(backendUrl, {
        transports: ["websocket"],
      });
    }

    socket.on("connect", () => {
      console.log("✅ Connected to WebSocket server", socket?.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from WebSocket server");
      setConnected(false);
    });

    // recevoir le 'pong' du serveur
    socket.on("pong", (data: any) => {
      console.log("📩 pong reçu :", data);
      setLastMessage(JSON.stringify(data));
    });

    // cleanup quand on quitte la page
    return () => {
      if (socket) {
        socket.off("pong");
        socket.off("connect");
        socket.off("disconnect");
        // on ne ferme pas forcément le socket ici, à toi de voir
      }
    };
  }, []);

  const handleSendPing = () => {
    if (!socket) return;
    socket.emit("ping", { from: "frontend", time: new Date().toISOString() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-indigo-100 to-purple-100">
      <div className="bg-white/80 rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">WebSocket Test</h1>
        <p className="mb-2">
          Statut :{" "}
          <span
            className={
              connected ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
            }
          >
            {connected ? "Connecté" : "Déconnecté"}
          </span>
        </p>

        <button
          onClick={handleSendPing}
          disabled={!connected}
          className="mt-4 px-6 py-2 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition"
        >
          Envoyer un ping
        </button>

        <div className="mt-6 text-left text-sm">
          <h2 className="font-semibold mb-1">Dernier message reçu :</h2>
          <div className="bg-gray-100 rounded-xl p-3 h-24 overflow-auto">
            {lastMessage ? lastMessage : <span className="text-gray-400">Aucun</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
