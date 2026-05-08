"use client";
import { useEffect, useState } from "react";

type Toast = { id: string; text: string };
let pushToastExternal: ((t: string) => void) | null = null;

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    pushToastExternal = (text: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setItems((prev) => [...prev, { id, text }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    return () => { pushToastExternal = null; };
  }, []);
  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {items.map((t) => (
        <div key={t.id} className="px-4 py-2 bg-black/80 text-white rounded-xl shadow-lg animate-[fadeIn_.2s_ease]">
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function toast(text: string) {
  pushToastExternal?.(text);
}

/* tailwind animation (ajoute dans globals.css si tu veux)
@keyframes fadeIn { from{opacity:0; transform:translateY(-4px)} to{opacity:1; transform:translateY(0)} }
*/
