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
  Search,
  Square,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  Activity,
  X,
  MoreHorizontal,
  Download
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

  const stats = [
    { label: "Etudiants", value: students.length, icon: Users, color: "bg-green-100 text-green-600", border: "border-green-200" },
    { label: "Examens", value: exams.length, icon: FileText, color: "bg-blue-100 text-blue-600", border: "border-blue-200" },
    { label: "Alertes", value: alerts.length, icon: AlertTriangle, color: "bg-red-100 text-red-600", border: "border-red-200" },
    { label: "Terminés", value: exams.filter(e => e.status === 'finished').length, icon: CheckCircle, color: "bg-emerald-100 text-emerald-600", border: "border-emerald-200" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-gray-900 relative overflow-hidden">

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-72 px-6' : 'w-20 px-3'} bg-white border-r border-gray-100 transition-all duration-300 flex flex-col fixed h-full z-40 left-0 top-0 shadow-sm`}>
        <div className="h-24 flex items-center justify-between mb-4">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-200">P</div>
              <div><h1 className="font-bold text-lg text-gray-900 leading-tight">Espace Prof</h1><p className="text-xs text-gray-400 font-medium">Administration</p></div>
            </div>
          )}
          <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 transition-all">
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          <Link href="/professor/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-600 text-white font-semibold shadow-md shadow-purple-200 transition-all">
            <LayoutDashboard size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Tableau de Bord</span>
          </Link>
          <Link href="/professor/exams" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-purple-600 font-medium transition-all">
            <FileText size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Mes Exemens</span>
          </Link>
          <Link href="/professor/students" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-purple-600 font-medium transition-all">
            <Users size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Etudiants</span>
          </Link>
          <Link href="/professor/alerts" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-purple-600 font-medium transition-all">
            <Bell size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Alertes</span>
          </Link>
        </nav>

        <div className="py-8 mt-auto border-t border-gray-50">
          <Link href="/professor/login" className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-500 font-medium transition-all">
            <LogOut size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Déconnexion</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'} p-8 bg-[#F8F9FC]`}>

        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Tableau de Bord</h1>
            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
              <span>Bonjour, <span className="text-purple-600 font-bold">{userName || "Professeur"}</span></span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span>Salle <span className="font-bold">{userRoom || "201"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold shadow-sm transition-all ${isConnected ? 'bg-white text-green-600 border-green-100' : 'bg-white text-red-600 border-red-100'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div> {isConnected ? 'Système connecté' : 'Déconnecté'}
            </div>
            <div className="flex items-center gap-2 bg-white px-2 pr-4 py-1.5 rounded-full border border-gray-100 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">{userName ? userName.charAt(0) : 'P'}</div>
              <span className="text-sm font-bold text-gray-700">{userName || "Professeur"}</span>
            </div>
          </div>
        </header>

        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-800">{s.value}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">{s.label}</div>
              </div>
            </div>
          ))}
          <button onClick={() => setDrawerOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white p-5 rounded-2xl shadow-lg shadow-purple-200 transition-all flex flex-col items-center justify-center gap-2 group">
            <Plus size={32} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold">Nouvel Examen</span>
          </button>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT: ALERTS */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
              <Bell className="text-orange-400" size={20} /> Alertes
            </h3>
            <div className="space-y-4">
              {alerts.length === 0 && <div className="text-center text-gray-300 py-10 text-sm font-medium">Aucune alerte récente</div>}
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${a.level === 'danger' ? 'bg-red-500 shadow-red-200 shadow-lg' : 'bg-orange-400'}`}></div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-gray-800">{a.message || "Alerte de sécurité"}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{a.time || "Il y a 1 min"}</span>
                    </div>
                  </div>
                  <button className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all"><Eye size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: EXAMS LIST */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-2xl text-gray-800">Examens Récents</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Rechercher..." className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none w-64 transition-all" />
              </div>
            </div>

            <div className="space-y-4">
              {exams.slice(0, 5).map(ex => {
                const running = !!endMap[ex.id];
                const statusColor = running ? 'bg-green-100 text-green-700' : (ex.status === 'finished' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600');
                const statusText = running ? 'EN COURS' : (ex.status === 'finished' ? 'TERMINÉ' : (ex.status === 'launched' ? 'LANCÉ' : 'BROUILLON'));
                const openImport = expandedImports[ex.id];

                return (
                  <div key={ex.id} className="border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-500">#{ex.id}</div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="font-bold text-lg text-gray-900">{ex.titre}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{statusText}</span>
                            {running && tickMap[ex.id] && (
                              <div className="flex items-center gap-1.5 ml-2 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 animate-pulse">
                                <Clock size={12} className="text-purple-600" />
                                <span className="font-mono text-xs font-bold text-purple-700">{tickMap[ex.id]}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{ex.description || "Aucune description"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 mr-4">
                          {(ex.status === 'ready' || ex.status === 'finished') && (
                            <button onClick={() => launchExam(ex.id)} className="p-2 hover:bg-purple-50 text-purple-600 rounded-lg" title="Publier"><Rocket size={18} /></button>
                          )}
                          {ex.status === 'launched' && (
                            <button onClick={() => finishExam(ex.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Terminer"><Square size={18} /></button>
                          )}
                          {!ex.status || ex.status === 'ready' || ex.status === 'launched' ? (
                            <button onClick={() => startExam(ex.id)} className="p-2 hover:bg-green-50 text-green-600 rounded-lg" title="Démarrer Timer"><Play size={18} /></button>
                          ) : null}
                          <button onClick={() => toggleImport(ex.id)} className={`p-2 hover:bg-blue-50 text-blue-600 rounded-lg ${openImport ? 'bg-blue-50' : ''}`} title="Fichiers"><FolderUp size={18} /></button>
                        </div>


                        <Link href={`/professor/exams/${ex.id}`}>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-5 font-bold shadow-purple-200 shadow-md flex items-center gap-2">
                            <Rocket size={14} /> Gérer
                          </Button>
                        </Link>

                        <div className="relative group/menu">
                          <button className="p-2 hover:bg-gray-50 rounded-lg text-gray-400"><MoreHorizontal size={20} /></button>
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 hidden group-hover/menu:block z-20 overflow-hidden">
                            <button onClick={() => setSelectedExamAccess(ex.id)} className="w-full text-left px-4 py-3 text-sm font-medium text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2"><Lock size={14} /> Accès</button>
                            <button onClick={() => deleteExam(ex.id)} className="w-full text-left px-4 py-3 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"><Trash2 size={14} /> Supprimer</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {
                      openImport && (
                        <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100 animate-slide-down">
                          <h4 className="font-bold text-xs text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wider"><FolderUp size={12} /> Gestion des fichiers</h4>
                          <form onSubmit={(e) => { e.preventDefault(); uploadResources(ex.id, e.currentTarget); }} className="flex gap-4 items-end mb-4">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-400 mb-1">Sujet (PDF)</label>
                              <input type="file" name="subject" accept=".pdf" className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-white file:text-purple-600 file:border-purple-100 file:border hover:file:bg-purple-50 transition-colors" />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-400 mb-1">Annexes</label>
                              <input type="file" name="attachments" multiple className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-white file:text-purple-600 file:border-purple-100 file:border hover:file:bg-purple-50 transition-colors" />
                            </div>
                            <Button type="submit" size="sm" className="bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700">Envoyer</Button>
                          </form>
                          <div className="flex flex-wrap gap-2">
                            {resourcesMap[ex.id]?.length === 0 && <span className="text-xs text-gray-400 italic">Aucun fichier</span>}
                            {(resourcesMap[ex.id] || []).map((r, i) => (
                              <div key={i} className="group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-all">
                                <a href={`${baseUrl}${r.url}`} target="_blank" className="flex items-center gap-2">
                                  <FileText size={12} /> {r.file_name}
                                </a>
                                <button onClick={() => deleteResource(ex.id, r.file_name, r.kind)} className="text-red-300 hover:text-red-500 transition-colors" title="Supprimer">
                                  <div className="p-0.5"><X size={12} /></div>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </main>

      {/* DRAWER - Exam Creation Form */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"></div>
          <div className="relative h-full w-full md:w-[600px] bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 p-8 sm:p-12">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-black text-gray-900">Nouvel Examen</h2>
              <button onClick={() => setDrawerOpen(false)} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <form onSubmit={createExam} className="space-y-8">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Titre de l'examen</label>
                <input
                  value={titre}
                  onChange={e => setTitre(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 border-2 border-transparent focus:border-purple-600 rounded-2xl px-5 py-4 focus:outline-none transition-all font-bold text-lg placeholder-gray-300"
                  placeholder="Ex: Algèbre Linéaire"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 border-2 border-transparent focus:border-purple-600 rounded-2xl px-5 py-4 focus:outline-none transition-all font-medium resize-none h-32 placeholder-gray-300"
                  placeholder="Instructions pour les étudiants..."
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Durée (minutes)</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="number"
                      value={duration}
                      onChange={e => setDuration(+e.target.value)}
                      className="w-full bg-gray-50 text-gray-900 border-2 border-transparent focus:border-purple-600 rounded-2xl pl-12 pr-5 py-4 focus:outline-none font-bold text-lg"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <label className={`w-full flex items-center gap-3 cursor-pointer p-4 rounded-2xl border-2 transition-all justify-center h-[62px] ${startNow ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${startNow ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'}`}>
                      {startNow && <CheckCircle size={14} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={startNow} onChange={e => setStartNow(e.target.checked)} className="hidden" />
                    <span className="font-bold text-sm">Lancer maintenant</span>
                  </label>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full py-6 bg-purple-600 text-white hover:bg-purple-700 font-bold rounded-2xl shadow-xl shadow-purple-200 hover:scale-[1.01] transition-all text-lg flex items-center justify-center gap-2"
                >
                  {creating ? <><RefreshCw className="animate-spin" /> Création...</> : <><Rocket /> Créer l'examen</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODALS & OTHERS */}
      {selectedStudentLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <Card className="w-full max-w-lg flex flex-col p-6 max-h-[80vh] bg-white rounded-3xl shadow-2xl">
            <h3 className="font-bold text-xl mb-4 text-gray-900">Activité : {selectedStudentLogs.name}</h3>
            <div className="flex-1 overflow-y-auto space-y-2 bg-gray-50 p-4 rounded-xl mb-4 text-xs font-mono text-gray-600">
              {(selectedStudentLogs.history || []).slice().reverse().map((l: any, i: number) => (
                <div key={i} className="border-b border-gray-100 pb-1 mb-1">
                  <span className="font-bold text-gray-400 mr-2">[{l.at}]</span> {l.type}: {l.message}
                </div>
              ))}
            </div>
            <Button onClick={() => setSelectedStudentLogs(null)} className="w-full bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-xl py-3 font-bold">Fermer</Button>
          </Card>
        </div>
      )}

      {selectedExamAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <Card className="w-full max-w-4xl h-[600px] flex flex-col p-0 bg-white rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-xl text-gray-900">Gestion des accès <span className="text-gray-400 text-sm font-normal ml-2">#{selectedExamAccess}</span></h3>
              <button onClick={() => setSelectedExamAccess(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 font-bold shadow-sm transition-all"><X size={16} /></button>
            </div>
            <div className="flex-1 grid md:grid-cols-2 divide-x divide-gray-100">
              <div className="p-4 flex flex-col bg-slate-50/50">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Etudiants Connectés</h4>
                  <Button size="sm" onClick={() => addAllowed(selectedExamAccess, students.map(s => s.id || s.studentId))} className="text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">Tout autoriser</Button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {students.map(s => (
                    <div key={s.id || s.studentId} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-purple-200 transition-colors">
                      <div><div className="font-bold text-sm text-gray-900">{s.name}</div><div className="text-xs text-gray-400">{s.matricule}</div></div>
                      <Button size="sm" onClick={() => addAllowed(selectedExamAccess, [s.id || s.studentId])} className="h-8 w-8 p-0 rounded-full bg-green-50 text-green-600 hover:bg-green-100 border-none"><Plus size={16} /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Liste Autorisée</h4>
                  <label className="cursor-pointer text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg transition-colors">
                    Import Excel <input type="file" onChange={(e) => { if (e.target.files?.[0]) handleImport(selectedExamAccess, e.target.files[0]); }} className="hidden" />
                  </label>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {allowedStudents.map(a => (
                    <div key={a.id} className="flex justify-between items-center p-3 bg-purple-50/30 border border-purple-100 rounded-xl">
                      <div><div className="font-bold text-sm text-purple-900">{a.name}</div><div className="text-xs text-purple-400">{a.matricule}</div></div>
                      <button onClick={() => removeAllowed(selectedExamAccess, a.id)} className="text-red-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

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