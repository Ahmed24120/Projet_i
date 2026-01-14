"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/Toast";
import { baseUrl, apiFetch } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  FolderUp,
  LayoutDashboard,
  Lock,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Square,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  Activity,
  X
} from "lucide-react";

type Exam = {
  id: number;
  titre?: string;
  description?: string;
  date_debut?: string | null;
  date_fin?: string | null;
  sujet_path?: string | null;
  status?: 'ready' | 'launched' | 'finished';
  status_code?: number;
};

export default function ProfessorDashboard() {
  const socket = useMemo(() => getSocket(), []);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [userRoom, setUserRoom] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // NEW: Drawer state for exam creation form
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Monitoring
  const [students, setStudents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<any>(null);

  // States for Exam Creation & Action
  const [creating, setCreating] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number>(90);
  const [startNow, setStartNow] = useState<boolean>(true);
  const [endMap, setEndMap] = useState<Record<number, number>>({});
  const [tickMap, setTickMap] = useState<Record<number, string>>({});
  const [expandedImports, setExpandedImports] = useState<Record<number, boolean>>({});
  const [examToDelete, setExamToDelete] = useState<number | null>(null);
  const [resourcesMap, setResourcesMap] = useState<Record<number, any[]>>({});

  // Access Management
  const [selectedExamAccess, setSelectedExamAccess] = useState<number | null>(null);
  const [allowedStudents, setAllowedStudents] = useState<any[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("prof_sidebar_open");
    if (saved !== null) setSidebarOpen(saved === "true");

    // User info
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (user.name) setUserName(user.name);
        setUserRoom(localStorage.getItem("roomNumber") || "");
      } catch (e) { }
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem("prof_sidebar_open", String(newState));
  };

  useEffect(() => {
    if (!socket) return;
    const room = localStorage.getItem("roomNumber");
    socket.emit('professor-join', { roomNumber: room });

    const onUpdateStudents = (list: any[]) => setStudents(list);
    const onAlert = (alert: any) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
      if (alert.level === 'danger') toast(alert.message);
    };
    const onSubmissionUpdate = (data: any) => {
      if (data.type === 'CANCELLED') {
        setAlerts(prev => [{ type: 'CANCELLED', message: `⚠️ Soumission annulée par ${data.matricule}`, level: 'warning', time: new Date().toLocaleTimeString() }, ...prev]);
        toast(`⚠️ Soumission annulée : ${data.matricule}`);
      }
    };

    socket.on('update-student-list', onUpdateStudents);
    socket.on('alert', onAlert);
    socket.on('professor:submission-update', onSubmissionUpdate);

    setIsConnected(socket.connected);
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.off('update-student-list');
      socket.off('alert');
      socket.off('professor:submission-update');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket]);

  // Sync Logique (Timer etc)
  useEffect(() => {
    loadExams();
    socket.on("initial-sync", ({ activeExams }) => {
      const map: Record<number, number> = {};
      activeExams.forEach((ae: any) => map[Number(ae.examId)] = Number(ae.endAt));
      setEndMap(map);
    });
    socket.on("exam-tick", (p: any) => {
      const ms = Math.max(p.timeLeft, 0);
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTickMap(prev => ({ ...prev, [Number(p.examId)]: `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` }));
      setEndMap(prev => ({ ...prev, [Number(p.examId)]: p.endAt }));
    });
    socket.on("exam-started", (p: any) => setEndMap((m) => ({ ...m, [Number(p.examId)]: Number(p.endAt) })));
    socket.on("exam-ended", (p: any) => {
      setEndMap((m) => { const c = { ...m }; delete c[Number(p.examId)]; return c; });
      setTickMap((tm) => { const c = { ...tm }; delete c[Number(p.examId)]; return c; });
      loadExams();
    });
    socket.on("exam-stopped", (p: any) => {
      setEndMap((m) => { const c = { ...m }; delete c[Number(p.examId)]; return c; });
      setTickMap((tm) => { const c = { ...tm }; delete c[Number(p.examId)]; return c; });
    });
    socket.on("exam-warning", () => toast("⏰ Il reste 5 minutes"));
    return () => {
      socket.off("initial-sync");
      socket.off("exam-tick");
      socket.off("exam-started");
      socket.off("exam-ended");
      socket.off("exam-stopped");
      socket.off("exam-warning");
    }
  }, [socket]);

  // Methods (CRUD & Interactions)
  async function loadExams() {
    try {
      setLoading(true);
      const data = await apiFetch<Exam[]>("/exams");
      setExams(Array.isArray(data) ? data : []);
    } catch { toast("Erreur chargement examens"); }
    finally { setLoading(false); }
  }

  async function createExam(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return toast("Titre requis");
    setCreating(true);
    try {
      const end = new Date(Date.now() + duration * 60000).toISOString();
      const created = await apiFetch<any>("/exams", {
        method: "POST", body: JSON.stringify({ titre, description, date_fin: end, roomNumber: localStorage.getItem("roomNumber") })
      });
      toast("Examen créé ✅");
      setTitre(""); setDescription("");
      setDrawerOpen(false); // Close drawer on success
      await loadExams();
      if (startNow && created?.id) {
        socket.emit("start-exam", { examId: created.id, durationMin: duration });
        toast("Examen démarré ⏱️");
      }
    } catch { toast("Erreur création"); }
    finally { setCreating(false); }
  }

  const getTimeStr = (id: number) => tickMap[id];
  async function deleteExam(id: number) { setExamToDelete(id); }
  async function confirmDelete() {
    if (!examToDelete) return;
    try { await apiFetch(`/exams/${examToDelete}`, { method: 'DELETE' }); toast("Supprimé 🗑️"); loadExams(); }
    catch { toast("Erreur suppression"); } finally { setExamToDelete(null); }
  }
  function startExam(id: number) { socket.emit("start-exam", { examId: id, durationMin: duration }); toast("Démarrage..."); }
  function stopExam(id: number) { socket.emit("stop-exam", { examId: id }); toast("Arrêt..."); }
  async function launchExam(id: number) { try { await apiFetch(`/exams/${id}/launch`, { method: 'PUT' }); toast("Publié 🚀"); loadExams(); } catch { toast("Erreur publication"); } }
  function finishExam(id: number) { setExamToFinish(id); }

  const [examToFinish, setExamToFinish] = useState<number | null>(null);

  function confirmFinishExam() {
    if (examToFinish) {
      socket.emit("finish-exam-manual", { examId: examToFinish });
      toast("Terminé 🏁");
      setExamToFinish(null);
    }
  }

  async function fetchResources(id: number) {
    try { const d = await apiFetch<any[]>(`/exams/${id}/resources`); setResourcesMap(p => ({ ...p, [id]: d || [] })); } catch { }
  }
  const toggleImport = (id: number) => { const n = !expandedImports[id]; setExpandedImports(p => ({ ...p, [id]: n })); if (n) fetchResources(id); };

  async function uploadResources(examId: number, form: HTMLFormElement) {
    const fd = new FormData(form);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${baseUrl}/exams/${examId}/resources`, { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error();
      toast("Fichiers importés ✅"); (form as any).reset(); fetchResources(examId);
    } catch { toast("Erreur import"); }
  }

  const [resourceToDelete, setResourceToDelete] = useState<{ examId: number, filename: string, type: 'subject' | 'attachment' } | null>(null);

  function deleteResource(examId: number, filename: string, type: 'subject' | 'attachment') {
    setResourceToDelete({ examId, filename, type });
  }

  async function confirmDeleteResource() {
    if (!resourceToDelete) return;
    const { examId, filename, type } = resourceToDelete;
    try {
      await apiFetch(`/exams/${examId}/resources`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, type })
      });
      toast("Fichier supprimé 🗑️");
      fetchResources(examId);
    } catch { toast("Erreur suppression"); }
    finally { setResourceToDelete(null); }
  }

  // Access Management
  useEffect(() => { if (selectedExamAccess) fetchAllowed(selectedExamAccess); }, [selectedExamAccess]);
  async function fetchAllowed(id: number) { setAccessLoading(true); try { const d = await apiFetch<any[]>(`/exams/${id}/allowed`); setAllowedStudents(d); } catch { } finally { setAccessLoading(false); } }
  async function addAllowed(eid: number, sids: string[]) {
    try { await apiFetch(`/exams/${eid}/allowed`, { method: 'POST', body: JSON.stringify({ studentIds: sids }) }); fetchAllowed(eid); toast("Ajouté(s)"); } catch { toast("Erreur"); }
  }
  async function removeAllowed(eid: number, sid: number) {
    try { await apiFetch(`/exams/${eid}/allowed/${sid}`, { method: 'DELETE' }); fetchAllowed(eid); toast("Retiré"); } catch { toast("Erreur"); }
  }
  async function handleImport(eid: number, f: File) {
    const fd = new FormData(); fd.append('file', f); setAccessLoading(true);
    try {
      const res = await fetch(`${baseUrl}/exams/${eid}/allowed/import`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: fd });
      const d = await res.json();
      if (res.ok) { toast(`Import: ${d.nb_crees} créés, ${d.nb_mis_a_jour} Maj, ${d.nb_ignores} ignorés`); fetchAllowed(eid); } else toast(d.error);
    } catch { toast("Erreur réseau"); } finally { setAccessLoading(false); }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 font-sans text-gray-900 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-72 px-6' : 'w-20 px-3'} bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 flex flex-col fixed h-full z-40 left-0 top-0 shadow-2xl shadow-indigo-500/5`}>
        <div className="h-24 flex items-center justify-between mb-2">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-300/50 ring-2 ring-indigo-100">P</div>
              <div><h1 className="font-black text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight leading-4">Espace Prof</h1><p className="text-xs text-gray-500 font-semibold mt-1">Administration</p></div>
            </div>
          )}
          <button onClick={toggleSidebar} className="p-2.5 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all">
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
          <Link href="/professor/dashboard" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-200/50 transition-all">
            <LayoutDashboard size={22} /><span className={!sidebarOpen ? 'hidden' : ''}>Tableau de bord</span>
          </Link>
          <Link href="/professor/exams" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50/30 hover:text-indigo-600 font-bold transition-all group">
            <FileText size={22} className="group-hover:scale-110 transition-transform" /><span className={!sidebarOpen ? 'hidden' : ''}>Mes Examens</span>
          </Link>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-4"></div>
        </nav>
        <div className="py-8 mt-auto">
          <Link href="/professor/login" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 text-red-400 hover:text-red-500 font-bold transition-all group">
            <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" /><span className={!sidebarOpen ? 'hidden' : ''}>Déconnexion</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'} p-8 md:p-12`}>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-gray-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent tracking-tight mb-2">Tableau de Bord</h1>
            <div className="flex items-center gap-2 text-gray-600 font-semibold">
              {userName && <span>Bonjour, <span className="text-indigo-600 font-black">{userName}</span></span>}
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
              {userRoom && <span>Salle {userRoom}</span>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full border-2 text-sm font-bold shadow-lg transition-all ${isConnected ? 'bg-green-50 text-green-700 border-green-200 shadow-green-100' : 'bg-red-50 text-red-700 border-red-200 shadow-red-100'}`}>
              {isConnected ? <Wifi size={18} /> : <WifiOff size={18} />} {isConnected ? 'Système connecté' : 'Déconnecté'}
            </div>
            <Button onClick={loadExams} className="bg-white/80 backdrop-blur-sm text-indigo-600 hover:bg-white border border-indigo-100 shadow-lg hover:shadow-xl transition-all rounded-2xl px-5">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </header>

        {/* 2-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT COLUMN - Monitoring */}
          <div className="lg:col-span-4 space-y-6">
            {/* ALERTS */}
            <Card className="h-[400px] flex flex-col p-0 border-none shadow-xl shadow-gray-200/50 bg-white/70 backdrop-blur-xl rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-r from-red-50/50 to-orange-50/30">
                <h3 className="font-black text-red-600 flex items-center gap-2 text-lg"><Bell size={20} /> Alertes</h3>
                {alerts.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2.5 py-1 rounded-full font-black animate-pulse">LIVE</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                {alerts.length === 0 && <div className="text-center py-16 text-gray-300 font-semibold italic">Aucune alerte</div>}
                {alerts.map((a, i) => (
                  <div key={i} className={`p-4 rounded-2xl text-xs font-semibold border shadow-sm transition-all ${a.level === 'danger' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    <span className="block text-[10px] opacity-60 mb-1.5 font-mono">{a.time}</span>
                    {a.message}
                  </div>
                ))}
              </div>
            </Card>

            {/* CONNECTED STUDENTS */}
            <Card className="h-[500px] flex flex-col p-0 border-none shadow-xl shadow-gray-200/50 bg-white/70 backdrop-blur-xl rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-gray-100/50 flex items-center justify-between">
                <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg"><Users size={20} /> Étudiants <span className="text-gray-400 font-normal text-sm">({students.length})</span></h3>
                <div className="flex gap-2 text-[10px] font-black uppercase">
                  <span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-600 border border-green-200 shadow-sm">OK</span>
                  <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 shadow-sm">Fraude</span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shadow-sm">Fini</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="space-y-3">
                  {students.map((s, i) => {
                    const st = s.status;
                    const color = st === 'cheating' ? 'bg-red-50 border-red-300' : st === 'finalized' ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-indigo-300';
                    return (
                      <div key={i} className={`p-4 rounded-2xl border-2 transition-all shadow-sm hover:shadow-md ${color}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-gray-900 truncate flex-1 text-sm" title={s.name}>{s.name}</div>
                          <div className={`w-2.5 h-2.5 rounded-full ${st === 'cheating' ? 'bg-red-500 animate-ping' : st === 'finalized' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        </div>
                        <div className="text-xs text-gray-500 font-mono mb-3">{s.matricule}</div>
                        <button onClick={() => setSelectedStudentLogs(s)} className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1.5">
                          <Activity size={12} /> Voir activité
                        </button>
                      </div>
                    );
                  })}
                  {students.length === 0 && <div className="py-16 text-center text-gray-300 font-semibold">En attente de connexion...</div>}
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN - Exams */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-gray-900">Examens Récents</h2>
              <Button onClick={() => setDrawerOpen(true)} className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50 transition-all rounded-2xl px-7 py-6 font-black text-base">
                <Plus className="mr-2" size={20} /> Nouvel Examen
              </Button>
            </div>

            <div className="space-y-5">
              {exams.slice(0, 5).map(ex => {
                const running = !!endMap[ex.id];
                const timer = getTimeStr(ex.id);
                const openImport = expandedImports[ex.id];

                return (
                  <Card key={ex.id} className="border-none shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden hover:shadow-2xl transition-all bg-white/70 backdrop-blur-xl">
                    <div className="p-7 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-[11px] font-mono font-black">#{ex.id}</span>
                          <h3 className="text-xl font-black text-gray-900">{ex.titre}</h3>
                          {ex.status === 'launched' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border-2 border-green-200 shadow-sm">En cours</span>}
                          {ex.status === 'finished' && <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border-2 border-blue-200 shadow-sm">Terminé</span>}
                        </div>
                        <p className="text-sm text-gray-500 font-medium">{ex.description || "Aucune description"}</p>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {running && <div className="px-4 py-2 bg-red-50 text-red-600 font-mono font-black rounded-xl border-2 border-red-200 animate-pulse shadow-sm">{timer}</div>}

                        <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

                        <div className="flex gap-2 flex-wrap">
                          {(ex.status === 'ready' || ex.status === 'finished') && (
                            <Button size="sm" onClick={() => launchExam(ex.id)} className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold border-2 border-indigo-500 rounded-xl">
                              <Rocket size={16} className="mr-2" /> Publier
                            </Button>
                          )}
                          {ex.status === 'launched' && (
                            <Button size="sm" onClick={() => finishExam(ex.id)} className="bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200 font-bold border-2 border-red-500 rounded-xl">
                              <Square size={16} className="mr-2" /> Terminer
                            </Button>
                          )}
                          {!ex.status || ex.status === 'ready' || ex.status === 'launched' ? (
                            <Button size="sm" variant="outline" className="border-gray-300 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500 rounded-xl" onClick={() => startExam(ex.id)} title="Relancer Timer"><Play size={16} /></Button>
                          ) : null}

                        </div>

                        <Link href={`/professor/exams/${ex.id}`}>
                          <Button size="sm" className="bg-gray-900 text-white hover:bg-black rounded-xl font-bold shadow-lg">Gérer</Button>
                        </Link>

                        <Button size="sm" variant="secondary" onClick={() => toggleImport(ex.id)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200 rounded-xl">
                          <FolderUp size={16} />
                        </Button>

                        <Button size="sm" variant="outline" onClick={() => setSelectedExamAccess(ex.id)} className="border-gray-300 text-gray-500 hover:text-gray-900 rounded-xl"><Lock size={16} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteExam(ex.id)} className="text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></Button>
                      </div>
                    </div>

                    {
                      openImport && (
                        <div className="bg-gray-50/50 p-6 border-t border-gray-200/50 animate-slide-down">
                          <h4 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><FolderUp size={16} /> Gestion des fichiers</h4>
                          <form onSubmit={(e) => { e.preventDefault(); uploadResources(ex.id, e.currentTarget); }} className="flex gap-4 items-end mb-4">
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-500 mb-1">Sujet (PDF)</label>
                              <input type="file" name="subject" accept=".pdf" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-500 mb-1">Annexes</label>
                              <input type="file" name="attachments" multiple className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
                            </div>
                            <Button type="submit" size="sm" className="h-9 px-6 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700">Envoyer</Button>
                          </form>
                          <div className="flex flex-wrap gap-2">
                            {(resourcesMap[ex.id] || []).map((r, i) => (
                              <div key={i} className="group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all">
                                <a href={`${baseUrl}${r.url}`} target="_blank" className="flex items-center gap-2">
                                  <FileText size={12} /> {r.file_name}
                                </a>
                                <button
                                  onClick={() => deleteResource(ex.id, r.file_name, r.kind)}
                                  className="opacity-0 group-hover:opacity-100 ml-1 text-red-300 hover:text-red-500 transition-all"
                                  title="Supprimer ce fichier"
                                >
                                  <div className="bg-red-50 rounded-full p-0.5"><div className="w-3 h-3 flex items-center justify-center font-bold">×</div></div>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </main >

      {/* DRAWER - Exam Creation Form */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"></div>

          {/* Drawer Panel */}
          <div className="relative h-full w-full md:w-[500px] bg-gradient-to-br from-indigo-600 to-purple-600 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="p-8 text-white">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3"><Plus className="w-7 h-7" /> Nouvel Examen</h2>
                <button onClick={() => setDrawerOpen(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={createExam} className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-100 mb-2 block">Titre de l'examen</label>
                  <input
                    value={titre}
                    onChange={e => setTitre(e.target.value)}
                    className="w-full bg-white text-gray-900 border-none rounded-2xl px-5 py-4 placeholder-gray-400 focus:ring-4 focus:ring-indigo-500/30 focus:outline-none transition-all font-bold shadow-lg"
                    placeholder="Ex: Algèbre Linéaire - Session 1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-100 mb-2 block">Instructions / Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-white text-gray-900 border-none rounded-2xl px-5 py-4 placeholder-gray-400 focus:ring-4 focus:ring-indigo-500/30 focus:outline-none transition-all font-medium resize-none h-32 shadow-lg"
                    placeholder="Instructions pour les étudiants..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-100 mb-2 block">Durée (min)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={e => setDuration(+e.target.value)}
                      className="w-full bg-white text-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/30 focus:outline-none font-mono font-bold shadow-lg"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 cursor-pointer bg-indigo-700/50 hover:bg-indigo-700 p-4 rounded-2xl border border-indigo-500/30 transition-all w-full justify-center">
                      <div className={`w-6 h-6 rounded flex items-center justify-center transition-all ${startNow ? 'bg-green-400 text-white shadow-lg' : 'bg-indigo-900 border border-indigo-400'}`}>
                        {startNow && <CheckCircle size={16} className="text-indigo-900" />}
                      </div>
                      <input type="checkbox" checked={startNow} onChange={e => setStartNow(e.target.checked)} className="hidden" />
                      <span className={`text-sm font-bold ${startNow ? 'text-white' : 'text-indigo-200'}`}>Lancer maintenant</span>
                    </label>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full py-7 bg-gray-900 text-white hover:bg-black font-black rounded-2xl shadow-2xl hover:shadow-3xl border border-white/10 mt-6 hover:scale-[1.02] transition-all text-lg flex items-center justify-center gap-2"
                >
                  {creating ? <><Clock className="animate-spin" /> Création...</> : <><Rocket /> Créer l'examen</>}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODALS (Logs & Access - kept simple but styled) */}
      {
        selectedStudentLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
            <Card className="w-full max-w-lg flex flex-col p-6 max-h-[80vh] bg-white rounded-3xl shadow-2xl">
              <h3 className="font-bold text-xl mb-4">Journaux : {selectedStudentLogs.name}</h3>
              <div className="flex-1 overflow-y-auto space-y-2 bg-gray-50 p-4 rounded-xl mb-4 text-xs font-mono">
                {(selectedStudentLogs.history || []).slice().reverse().map((l: any, i: number) => (
                  <div key={i} className="text-gray-600 border-b border-gray-100 pb-1 mb-1">
                    <span className="font-bold text-gray-400 mr-2">[{l.at}]</span> {l.type}: {l.message}
                  </div>
                ))}
              </div>
              <Button onClick={() => setSelectedStudentLogs(null)} className="w-full bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-xl py-3 font-bold">Fermer</Button>
            </Card>
          </div>
        )
      }

      {
        selectedExamAccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
            <Card className="w-full max-w-4xl h-[600px] flex flex-col p-0 bg-white rounded-3xl shadow-2xl overflow-hidden relative">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-xl text-gray-900">Gestion des accès <span className="text-gray-400 text-sm font-normal ml-2">#{selectedExamAccess}</span></h3>
                <button onClick={() => setSelectedExamAccess(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold">✕</button>
              </div>
              <div className="flex-1 grid md:grid-cols-2 divide-x divide-gray-100">
                <div className="p-4 flex flex-col bg-slate-50/30">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Connectés</h4>
                    <Button size="sm" onClick={() => addAllowed(selectedExamAccess, students.map(s => s.id || s.studentId))} className="text-xs">Tout autoriser</Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {students.map(s => (
                      <div key={s.id || s.studentId} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <div><div className="font-bold text-sm">{s.name}</div><div className="text-xs text-gray-400">{s.matricule}</div></div>
                        <Button size="sm" onClick={() => addAllowed(selectedExamAccess, [s.id || s.studentId])} className="h-8 w-8 p-0 rounded-full">+</Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Autorisés</h4>
                    <label className="cursor-pointer text-xs font-bold text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded">
                      Import Excel <input type="file" onChange={(e) => { if (e.target.files?.[0]) handleImport(selectedExamAccess, e.target.files[0]); }} className="hidden" />
                    </label>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {allowedStudents.map(a => (
                      <div key={a.id} className="flex justify-between items-center p-3 bg-indigo-50/30 border border-indigo-50 rounded-xl">
                        <div><div className="font-bold text-sm text-indigo-900">{a.name}</div><div className="text-xs text-indigo-400">{a.matricule}</div></div>
                        <button onClick={() => removeAllowed(selectedExamAccess, a.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )
      }

      <ConfirmModal
        isOpen={!!examToDelete}
        type="danger"
        title="Suppression"
        message="Voulez-vous vraiment supprimer cet examen ?"
        confirmText="Supprimer"
        cancelText="Annuler"
        onConfirm={confirmDelete}
        onCancel={() => setExamToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!resourceToDelete}
        type="warning"
        title="Supprimer le fichier"
        message={`Voulez-vous vraiment supprimer "${resourceToDelete?.filename}" ?`}
        confirmText="Supprimer"
        cancelText="Annuler"
        onConfirm={confirmDeleteResource}
        onCancel={() => setResourceToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!examToFinish}
        type="danger"
        title="Terminer l'examen"
        message="Êtes-vous sûr de vouloir terminer cet examen ? L'accès sera fermé aux étudiants."
        confirmText="Terminer"
        cancelText="Annuler"
        onConfirm={confirmFinishExam}
        onCancel={() => setExamToFinish(null)}
      />
    </div>
  );
}