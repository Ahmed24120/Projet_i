"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import { baseUrl } from "../lib/api";

interface NetworkStatus {
    isLocal: boolean;
    message: string;
    ip?: string;
}

export default function NetworkDetector({ role }: { role: 'student' | 'professor' }) {
    const [status, setStatus] = useState<NetworkStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkNetwork = async () => {
        try {
            const res = await fetch(`${baseUrl}/api/check-network`);
            const data = await res.json();

            setStatus({ isLocal: data.isLocal, message: data.message, ip: data.ip });

            if (!data.isLocal) {
                setError(data.message);
            } else {
                setError(null);
            }
        } catch (err) {
            setError("فشل الاتصال بالخادم. تأكد من أنك متصل بشبكة الامتحان المحلية.");
        }
    };

    useEffect(() => {
        // Initial check
        checkNetwork();

        // Periodic check every 10 seconds
        const interval = setInterval(checkNetwork, 10000);

        // Socket heartbeat for students (Anti-cheat)
        if (role === 'student') {
            const socket = getSocket();

            const heartbeat = setInterval(() => {
                if (socket && socket.connected) {
                    // Send heartbeat to server to check IP consistency
                    socket.emit('network-heartbeat', { timestamp: Date.now() });
                }
            }, 5000);

            return () => {
                clearInterval(interval);
                clearInterval(heartbeat);
            };
        }

        return () => clearInterval(interval);
    }, [role]);

    if (!status && !error) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm">
            {error ? (
                <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center animate-pulse">
                    <svg className="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <div>
                        <p className="font-bold">تنبيه شبكة</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            ) : (
                status?.isLocal && (
                    <div className="bg-green-600 text-white px-3 py-1 rounded-full shadow-lg text-xs flex items-center opacity-75 hover:opacity-100 transition">
                        <span className="w-2 h-2 bg-white rounded-full ml-2 animate-pulse"></span>
                        شبكة محلية آمنة
                    </div>
                )
            )}
        </div>
    );
}
