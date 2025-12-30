"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/Toast";
import { baseUrl, apiFetch } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type Exam = {
  id: number;
  titre?: string;
  description?: string;
  date_debut?: string | null;
  date_fin?: string | null;
  sujet_path?: string | null;
};

export default function ProfessorDashboard() {
  const socket = useMemo(() => getSocket(), []);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time Monitoring
  const [students, setStudents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<any>(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit('professor-join');

    const onUpdateStudents = (list: any[]) => setStudents(list);
    const onAlert = (alert: any) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50)); // Keep last 50
      // Play sound if critical
      if (alert.level === 'danger') {
        const audio = new Audio('/alert.mp3');
        audio.play().catch(() => { });
        toast(alert.message);
      } else if (alert.type === 'CANCELLED') {
        toast(alert.message || `Submission cancelled by ${alert.matricule}`);
      } else {
        toast(alert.message);
      }
    };

    const onSubmissionUpdate = (data: any) => {
      if (data.type === 'CANCELLED') {
        toast(`⚠️ Submission cancelled: ${data.matricule} (Work #${data.workId})`);
        // Optionally update alerts list
        setAlerts(prev => [{
          type: 'CANCELLED',
          message: `⚠️ Submission cancelled by ${data.matricule}`,
          level: 'warning',
          time: new Date().toLocaleTimeString()
        }, ...prev]);
      }
    };

    socket.on('update-student-list', onUpdateStudents);
    socket.on('alert', onAlert);
    socket.on('professor:submission-update', onSubmissionUpdate);

    // Track connection status
    setIsConnected(socket.connected);
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.off('update-student-list', onUpdateStudents);
      socket.off('alert', onAlert);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket]);

  // création
  const [creating, setCreating] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number>(90);
  const [startNow, setStartNow] = useState<boolean>(true);

  // timers reçus du serveur
  const [endMap, setEndMap] = useState<Record<number, number>>({});
  const [tickMap, setTickMap] = useState<Record<number, string>>({});
  const [msMap, setMsMap] = useState<Record<number, number>>({});
  const tick = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [expandedImports, setExpandedImports] = useState<Record<number, boolean>>({});
  const [examToDelete, setExamToDelete] = useState<number | null>(null);
  const [resourcesMap, setResourcesMap] = useState<Record<number, any[]>>({});

  async function fetchResources(id: number) {
    try {
      const data = await apiFetch<any[]>(`/exams/${id}/resources`);
      setResourcesMap(prev => ({ ...prev, [id]: data || [] }));
    } catch (e) {
      console.error("Error fetching resources:", e);
    }
  }

  const toggleImport = (id: number) => {
    const isOpen = !expandedImports[id];
    setExpandedImports(prev => ({ ...prev, [id]: isOpen }));
    if (isOpen) {
      fetchResources(id);
    }
  };

  // Référence pour l'animation
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Effet d'animation sur le titre
  useEffect(() => {
    if (!titleRef.current) return;

    const title = titleRef.current;
    let animationFrameId: number;
    let hue = 0;

    const animateTitle = () => {
      hue = (hue + 0.5) % 360;
      title.style.background = `linear-gradient(45deg, 
        hsl(${hue}, 100%, 40%), 
        hsl(${(hue + 60) % 360}, 100%, 40%), 
        hsl(${(hue + 120) % 360}, 100%, 40%)
      )`;
      title.style.backgroundSize = "200% 200%";
      title.style.backgroundClip = "text";
      title.style.webkitBackgroundClip = "text";
      title.style.webkitTextFillColor = "transparent";
      title.style.animation = "gradientFlow 3s ease infinite";

      animationFrameId = requestAnimationFrame(animateTitle);
    };

    animateTitle();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Styles CSS pour les animations
  const styles = `
    @keyframes gradientFlow {
      0%, 100% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
    }
    
    @keyframes pulseGlow {
      0%, 100% {
        box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
      }
      50% {
        box-shadow: 0 0 40px rgba(99, 102, 241, 0.6);
      }
    }
    
    @keyframes shimmer {
      0% {
        background-position: -200% center;
      }
      100% {
        background-position: 200% center;
      }
    }
    
    @keyframes float {
      0%, 100% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-5px);
      }
    }
    
    @keyframes colorCycle {
      0% {
        border-color: #6366f1;
      }
      33% {
        border-color: #8b5cf6;
      }
      66% {
        border-color: #3b82f6;
      }
      100% {
        border-color: #6366f1;
      }
    }
    
    .animated-timer {
      animation: pulseGlow 2s ease-in-out infinite;
      background: linear-gradient(45deg, #6366f1, #8b5cf6, #3b82f6);
      background-size: 200% 200%;
      animation: gradientFlow 3s ease infinite;
    }
    
    .shimmer-button {
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.4),
        transparent
      );
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
    }
    
    .floating-card {
      animation: float 3s ease-in-out infinite;
      border: 2px solid;
      animation: colorCycle 6s linear infinite;
    }
    
    .gradient-border {
      position: relative;
      border-radius: 1rem;
    }
    
    .gradient-border::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background: linear-gradient(45deg, 
        #6366f1, #8b5cf6, #3b82f6, #6366f1);
      background-size: 300% 300%;
      border-radius: 1rem;
      z-index: -1;
      animation: gradientFlow 3s ease infinite;
      opacity: 0.7;
    }
  `;




  // charge examens
  async function loadExams() {
    try {
      setLoading(true);
      const data = await apiFetch<Exam[]>("/exams");
      setExams(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("❌ loadExams error:", error);
      toast("Impossible de charger les examens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExams();

    // Sync initial (si déjà démarré)
    socket.on("initial-sync", ({ activeExams }) => {
      const map: Record<number, number> = {};
      activeExams.forEach((ae: any) => map[Number(ae.examId)] = Number(ae.endAt));
      setEndMap(map);
    });

    // timers via socket
    socket.on("exam-tick", (p: any) => {
      const ms = Math.max(p.timeLeft, 0);
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const str = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

      setTickMap(prev => ({ ...prev, [Number(p.examId)]: str }));
      setMsMap(prev => ({ ...prev, [Number(p.examId)]: ms }));
      setEndMap(prev => ({ ...prev, [Number(p.examId)]: p.endAt }));
    });

    socket.on("exam-started", (p: any) => {
      setEndMap((m) => ({ ...m, [Number(p.examId)]: Number(p.endAt) }));
    });

    socket.on("exam-ended", (p: any) => {
      setEndMap((m) => {
        const copy = { ...m };
        delete copy[Number(p.examId)];
        return copy;
      });
      setTickMap((tm) => {
        const copy = { ...tm };
        delete copy[Number(p.examId)];
        return copy;
      });
    });

    socket.on("exam-stopped", (p: any) => {
      setEndMap((m) => {
        const copy = { ...m };
        delete copy[Number(p.examId)];
        return copy;
      });
      setTickMap((tm) => {
        const copy = { ...tm };
        delete copy[Number(p.examId)];
        return copy;
      });
    });

    socket.on("exam-warning", () => toast("⏰ Il reste 5 minutes"));

    return () => {
      socket.off("initial-sync");
      socket.off("exam-tick");
      socket.off("exam-started");
      socket.off("exam-ended");
      socket.off("exam-stopped");
      socket.off("exam-warning");
    };
  }, [socket]);

  // helper
  const getTimeStr = (examId: number) => {
    return tickMap[examId] || null;
  };

  async function createExam(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return toast("Le titre est requis");
    setCreating(true);
    try {
      const end = new Date(Date.now() + duration * 60000).toISOString();
      const created = await apiFetch<any>("/exams", {
        method: "POST",
        body: JSON.stringify({ titre, description, date_fin: end }),
      });
      toast("Examen créé ✅");
      setTitre("");
      setDescription("");
      await loadExams();
      if (startNow && created?.id) {
        socket.emit("start-exam", { examId: created.id, durationMin: duration });
        toast("Examen démarré ⏱️");
      }
    } catch {
      toast("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  }

  async function deleteExam(id: number) {
    setExamToDelete(id);
  }

  async function confirmDelete() {
    if (!examToDelete) return;
    try {
      await apiFetch(`/exams/${examToDelete}`, { method: 'DELETE' });
      toast("Examen supprimé 🗑️");
      loadExams();
    } catch {
      toast("Impossible de supprimer");
    } finally {
      setExamToDelete(null);
    }
  }

  function startExam(id: number) {
    if (!socket || !socket.connected) {
      toast("⚠️ الاتصال بالخادم غير مستقر، يرجى المحاولة لاحقاً");
      return;
    }
    socket.emit("start-exam", { examId: id, durationMin: duration });
    toast("⏳ جاري بدء الامتحان...");
  }
  function stopExam(id: number) {
    if (!socket || !socket.connected) {
      toast("⚠️ الاتصال بالخادم غير مستقر");
      return;
    }
    socket.emit("stop-exam", { examId: id });
    toast("🛑 جاري إيقاف الامتحان...");
  }

  // upload (sujet + pièces)
  async function uploadResources(examId: number, form: HTMLFormElement) {
    const fd = new FormData(form);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${baseUrl}/exams/${examId}/resources`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: fd,
      });
      if (!res.ok) return toast("Upload échoué");
      toast("Fichiers importés ✅");
      (form as any).reset();
      fetchResources(examId); // Refresh the list
    } catch (e) {
      toast("Upload erreur");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50">
      {/* Styles d'animation */}
      <style>{styles}</style>

      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* HEADER avec animation */}
        <header className="flex items-center justify-between">
          <div>
            <h1
              ref={titleRef}
              className="text-4xl font-extrabold tracking-tight"
              style={{
                background: "linear-gradient(45deg, #6366f1, #8b5cf6, #3b82f6)",
                backgroundSize: "200% 200%",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "gradientFlow 3s ease infinite"
              }}
            >
              Tableau de bord professeur
            </h1>
            <p className="text-sm font-medium text-gray-800 mt-2 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-gradient-to-r from-indigo-500 to-purple-500"></span>
              </span>
              Créez, lancez et suivez vos examens en temps réel.
              <span className={`ml-4 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isConnected ? 'Serveur Connecté' : 'Serveur Déconnecté'}
              </span>
            </p>
          </div>
          <Link
            href="/professor/login"
            className="relative px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-200 transition-all duration-300 overflow-hidden group font-semibold"
          >
            <span className="relative z-10">Se déconnecter</span>
            <span className="shimmer-button absolute inset-0"></span>
          </Link>
        </header>

        <ConfirmModal
          isOpen={!!examToDelete}
          type="danger"
          title="حذف الامتحان"
          message="هل أنت متأكد من رغبتك في حذف هذا الامتحان نهائياً؟ سيتم مسح كافة البيانات المرتبطة به."
          confirmText="نعم، احذف"
          cancelText="إلغاء"
          onConfirm={confirmDelete}
          onCancel={() => setExamToDelete(null)}
        />

        {/* ALERTS & MONITORING SECTION */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* ALERTS PANEL */}
          <div className="md:col-span-1 bg-white/90 backdrop-blur rounded-3xl shadow-lg border border-red-50 p-4 h-80 overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              📢 التنبيهات المباشرة
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse">Live</span>
            </h3>
            <div className="space-y-2">
              {alerts.length === 0 && <p className="text-center text-gray-400 text-sm mt-10">لا توجد تنبيهات حالياً</p>}
              {alerts.map((alert, i) => (
                <div key={i} className={`p-3 rounded-lg border-r-4 text-right text-sm ${alert.level === 'danger' ? 'bg-red-50 border-red-500 text-red-800' :
                  alert.level === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                    'bg-blue-50 border-blue-500 text-blue-800'
                  }`}>
                  <div className="font-bold">{alert.type}</div>
                  <div className={alert.type === 'NETWORK_CHANGE' || alert.type === 'WIFI_OFF' ? 'font-black' : ''}>{alert.message}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CONNECTED STUDENTS PANEL */}
          <div className="md:col-span-2 bg-white/90 backdrop-blur rounded-3xl shadow-lg border border-indigo-50 p-6 h-96 overflow-y-auto flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                👨‍🎓 Students Live Monitoring
                <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{students.length}</span>
              </span>
              <div className="flex gap-2 text-[10px] font-bold">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Connected</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Cheat/Error</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Finalized</span>
              </div>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((s, i) => {
                const isCheating = s.status === 'cheating'; // Or derive from alerts
                const isOffline = s.status === 'offline' || s.status?.includes('disconnected');
                const isFinalized = s.status === 'finalized';

                return (
                  <div key={i} className={`relative p-4 rounded-2xl border transition-all duration-300 group overflow-hidden ${isCheating ? 'bg-red-50 border-red-500 shadow-lg shadow-red-100 animate-pulse' :
                    isFinalized ? 'bg-blue-50 border-blue-500' :
                      isOffline ? 'bg-slate-50 border-slate-200 opacity-70' :
                        'bg-white border-indigo-100 hover:border-indigo-400 hover:shadow-md'
                    }`}>
                    {/* Visual Indicator Layer for Cheating */}
                    {isCheating && <div className="absolute inset-0 border-4 border-red-500/50 rounded-2xl animate-ping opacity-20 pointer-events-none"></div>}

                    <div className="flex items-start justify-between mb-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${isCheating ? 'bg-red-100 text-red-600' :
                        isFinalized ? 'bg-blue-100 text-blue-600' :
                          isOffline ? 'bg-slate-200 text-slate-500' :
                            'bg-indigo-100 text-indigo-600'
                        }`}>
                        {isCheating ? '🚨' : isFinalized ? '🎓' : isOffline ? '🔌' : '👨‍🎓'}
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isCheating ? 'bg-red-500 text-white' :
                        isFinalized ? 'bg-blue-500 text-white' :
                          isOffline ? 'bg-slate-500 text-white' :
                            'bg-emerald-500 text-white'
                        }`}>
                        {s.status}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm truncate" title={s.name}>{s.name}</h4>
                      <p className="font-mono text-xs text-slate-500">{s.matricule}</p>

                      {s.ip && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                          <span className="truncate">{s.ip.replace('::ffff:', '')}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedStudentLogs(s)}
                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        View Logs
                      </button>
                      {isFinalized && <span className="text-xs text-blue-500">✔️ Done</span>}
                    </div>
                  </div>
                );
              })}

              {students.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                  <span className="text-4xl mb-2 opacity-30">👥</span>
                  <p>Waiting for students to join...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CRÉATION avec bordure animée */}
        <section className="relative gradient-border">
          <div className="absolute inset-0 -z-10 blur-3xl opacity-40 bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 rounded-3xl animate-pulse" />
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-6 ring-1 ring-black/5 floating-card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-r from-indigo-500 to-purple-500"></span>
              </span>
              Créer un examen
            </h2>
            <form onSubmit={createExam} className="grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <label className="block text-sm font-bold mb-1 text-gray-900">Titre</label>
                <input
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300 text-gray-900 font-medium"
                  placeholder="Ex: Réseaux – Session 1"
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-bold mb-1 text-gray-900">Durée (min)</label>
                <input
                  type="number"
                  min={10}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value || "0"))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300 text-gray-900 font-medium"
                />
              </div>
              <div className="sm:col-span-2 relative">
                <label className="block text-sm font-bold mb-1 text-gray-900">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300 text-gray-900 font-medium"
                  placeholder="Consignes, matériel autorisé, etc."
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={startNow}
                      onChange={(e) => setStartNow(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${startNow ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 transform ${startNow ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">Démarrer automatiquement après création</span>
                </label>
                <button
                  type="submit"
                  disabled={creating}
                  className="ml-auto relative px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl hover:shadow-indigo-200 disabled:opacity-50 transition-all duration-300 overflow-hidden group font-semibold"
                >
                  <span className="relative z-10">
                    {creating ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Création...
                      </span>
                    ) : "Créer l'examen"}
                  </span>
                  <span className="shimmer-button absolute inset-0"></span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* LISTE + ACTIONS + IMPORT */}
        <section className="bg-white rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/5 floating-card">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                Examens
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 font-bold">
                {exams.length} total
              </span>
            </h2>
            <button
              onClick={loadExams}
              className="relative px-4 py-2 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:shadow-lg transition-all duration-300 overflow-hidden group font-semibold"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rafraîchir
              </span>
              <span className="shimmer-button absolute inset-0"></span>
            </button>
          </div>

          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <div className="text-sm font-medium text-gray-700">Chargement des examens...</div>
            </div>
          ) : exams.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-5xl mb-4">📚</div>
              <div className="text-sm font-medium text-gray-700">Aucun examen pour le moment</div>
              <div className="text-xs text-gray-600 mt-2">Créez votre premier examen ci-dessus</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 bg-gray-50/50">
              {exams.map((ex) => {
                const tl = getTimeStr(ex.id);
                const running = !!endMap[ex.id];
                const isImportOpen = !!expandedImports[ex.id];

                return (
                  <div key={ex.id} className="p-6 transition-all duration-300 hover:bg-white hover:shadow-md group">
                    <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">

                      {/* 1. INFO PRINCIPALE */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200">
                            #{ex.id}
                          </span>
                          <h3 className="text-xl font-bold text-gray-900 truncate leading-tight">
                            {ex.titre || "Sans titre"}
                          </h3>
                        </div>
                        <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">
                          {ex.description || "Aucune description fournie pour cet examen."}
                        </p>
                      </div>

                      {/* 2. ACTIONS & TIMER */}
                      <div className="flex flex-wrap items-center gap-3 justify-end shrink-0">
                        {/* Timer Widget */}
                        <div className={`px-4 py-2 rounded-xl font-mono text-sm font-bold shadow-sm border transition-all ${running
                          ? msMap[ex.id] <= 60000
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-transparent shadow-red-200 animate-pulse'
                            : msMap[ex.id] <= 300000
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-orange-200 animate-pulse'
                              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-indigo-200 animate-pulse'
                          : 'bg-white text-gray-400 border-gray-200'
                          }`}>
                          {running ? (
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                              {tl}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-gray-300 rounded-full" />
                              Inactif
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                          <button
                            onClick={() => startExam(ex.id)}
                            title="Démarrer"
                            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                          <div className="w-px h-6 bg-gray-200 mx-1" />
                          <button
                            onClick={() => stopExam(ex.id)}
                            title="Arrêter"
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                          </button>
                        </div>

                        {/* Secondary Actions */}
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/professor/exams/${ex.id}`}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 transition-all font-bold text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            <span>Accéder</span>
                          </Link>

                          <button
                            onClick={() => toggleImport(ex.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isImportOpen
                              ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            Fichiers
                            <svg className={`w-3 h-3 transition-transform ${isImportOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>

                          <button
                            onClick={() => deleteExam(ex.id)}
                            title="Supprimer"
                            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* COLLAPSIBLE IMPORT SECTION */}
                    <div className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isImportOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                      <div className="min-h-0">
                        <form
                          className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl border border-indigo-100/50 p-5"
                          onSubmit={(e) => { e.preventDefault(); uploadResources(ex.id, e.currentTarget); }}
                        >
                          <div className="grid sm:grid-cols-2 gap-8">
                            {/* Sujet */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-300"></span>
                                  Sujet d'examen
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(resourcesMap[ex.id] || []).filter(r => r.kind === 'subject').map((r, i) => (
                                    <a
                                      key={i}
                                      href={`${baseUrl}${r.url}`}
                                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded-md shadow-sm border border-indigo-100"
                                      target="_blank"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                      {r.file_name.length > 20 ? r.file_name.substring(14) : r.file_name}
                                    </a>
                                  ))}
                                  {!(resourcesMap[ex.id] || []).some(r => r.kind === 'subject') && ex.sujet_path && (
                                    <a
                                      href={`${baseUrl}/static/${ex.sujet_path}`}
                                      className="text-xs font-bold text-indigo-400 hover:text-indigo-600 hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded-md shadow-sm border border-indigo-100 opacity-50"
                                      target="_blank"
                                    >
                                      Sujet actuel
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="relative group/input">
                                <input
                                  name="subject"
                                  type="file"
                                  accept=".pdf"
                                  className="w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-xl file:border-0
                                                file:text-xs file:font-bold
                                                file:bg-indigo-600 file:text-white
                                                hover:file:bg-indigo-700
                                                file:cursor-pointer cursor-pointer
                                                bg-white border-2 border-dashed border-indigo-200 rounded-xl p-2
                                                hover:border-indigo-400 focus:outline-none transition-colors"
                                />
                              </div>
                            </div>

                            {/* Pièces */}
                            <div className="space-y-3">
                              <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-300"></span>
                                Pièces jointes
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(resourcesMap[ex.id] || []).filter(r => r.kind === 'attachment').map((r, i) => (
                                  <a
                                    key={i}
                                    href={`${baseUrl}${r.url}`}
                                    className="text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded-md shadow-sm border border-purple-100"
                                    target="_blank"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2-8H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
                                    {r.file_name.length > 20 ? r.file_name.substring(14) : r.file_name}
                                  </a>
                                ))}
                              </div>
                              <div className="relative group/input">
                                <input
                                  name="attachments"
                                  type="file"
                                  multiple
                                  accept=".xlsx,.xls,.doc,.docx,.zip,.txt,.csv,.ppt,.pptx"
                                  className="w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-xl file:border-0
                                                file:text-xs file:font-bold
                                                file:bg-purple-600 file:text-white
                                                hover:file:bg-purple-700
                                                file:cursor-pointer cursor-pointer
                                                bg-white border-2 border-dashed border-purple-200 rounded-xl p-2
                                                hover:border-purple-400 focus:outline-none transition-colors"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="mt-6 flex justify-end">
                            <button
                              type="submit"
                              className="px-6 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black hover:shadow-lg transition-all flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                              Envoyer les fichiers
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>


        <p className="text-xs font-medium text-gray-700 text-center p-4 border-t border-gray-200">
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Astuce : "Surveiller" ouvre le suivi temps réel (connectés/déconnectés, envois).
          </span>
        </p>

        {/* STUDENT LOGS MODAL */}
        {selectedStudentLogs && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-xl font-bold text-gray-900 border-r-4 border-indigo-500 pr-3">
                  سجلات الطالب: {selectedStudentLogs.name}
                </h3>
                <button
                  onClick={() => setSelectedStudentLogs(null)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {selectedStudentLogs.history && selectedStudentLogs.history.length > 0 ? (
                  [...selectedStudentLogs.history].reverse().map((log: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded-xl border-r-4 text-right ${log.type === 'RESEAU_SUSPECT' ? 'bg-orange-50 border-orange-500' :
                      log.type === 'FRAUDE' ? 'bg-red-50 border-red-500 font-bold' :
                        log.type === 'WIFI_PERDU' ? 'bg-yellow-50 border-yellow-500' :
                          'bg-slate-50 border-slate-300'
                      }`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-mono text-slate-500">{log.at}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${log.type === 'RESEAU_SUSPECT' ? 'bg-orange-200 text-orange-800' :
                          log.type === 'FRAUDE' ? 'bg-red-200 text-red-800' :
                            log.type === 'WIFI_PERDU' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-slate-200 text-slate-700'
                          }`}>
                          {log.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800">{log.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-400 py-10">لا توجد سجلات حالياً</p>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setSelectedStudentLogs(null)}
                  className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold hover:bg-black transition-all"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM DELETE MODAL */}
        <ConfirmModal
          isOpen={!!examToDelete}
          type="danger"
          title="حذف الامتحان"
          message="هل أنت متأكد من رغبتك في حذف هذا الامتحان نهائياً؟ سيتم مسح كافة البيانات المرتبطة به."
          confirmText="نعم، احذف"
          cancelText="إلغاء"
          onConfirm={confirmDelete}
          onCancel={() => setExamToDelete(null)}
        />
      </div>
    </div >
  );
}