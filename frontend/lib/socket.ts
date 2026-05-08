"use client";
import { io, Socket } from "socket.io-client";

declare global {
  // eslint-disable-next-line no-var
  var __socket: Socket | undefined;
}

export function getSocket() {
  if (!globalThis.__socket) {
    // Dynamic URL for local network usage
    const url = typeof window !== "undefined"
      ? `http://${window.location.hostname}:3001`
      : (process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001");

    globalThis.__socket = io(url, {
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
    });
  }
  return globalThis.__socket;
}
