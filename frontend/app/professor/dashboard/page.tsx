"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/Toast";
import { baseUrl, apiFetch } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Exam = {
  id: number;
  titre?: string;
  description?: string;
  date_debut?: string | null;
  date_fin?: string | null;
  sujet_path?: string | null;
  status?: 'ready' | 'launched' | 'finished';
};

export default function ProfessorDashboard() {
  const socket = useMemo(() => getSocket(), []);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [userRoom, setUserRoom] = useState<string>("");

  // Real-time Monitoring
  const [students, setStudents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<any>(null);

  useEffect(() => {
    // Load User Name & Room
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (user.name) setUserName(user.name);
        const room = localStorage.getItem("roomNumber") || "";
        setUserRoom(room);
      } catch (e) { }
    }

    if (!socket) return;

    const room = localStorage.getItem("roomNumber");
    socket.emit('professor-join', { roomNumber: room });

    const onUpdateStudents = (list: any[]) => setStudents(list);
    const onAlert = (alert: any) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
      if (alert.level === 'danger') {
        toast(alert.message);
      } else if (alert.type === 'CANCELLED') {
        toast(alert.message || `Soumission annulée par ${alert.matricule}`);
      } else {
        toast(alert.message);
      }
    };

    const onSubmissionUpdate = (data: any) => {
      if (data.type === 'CANCELLED') {
        toast(`⚠️ Soumission annulée : ${data.matricule} (Travail #${data.workId})`);
        setAlerts(prev => [{
          type: 'CANCELLED',
          message: `⚠️ Soumission annulée par ${data.matricule}`,
          level: 'warning',
          time: new Date().toLocaleTimeString()
        }, ...prev]);
      }
    };

    socket.on('update-student-list', onUpdateStudents);
    socket.on('alert', onAlert);
    socket.on('professor:submission-update', onSubmissionUpdate);

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

  // Exam Creation Steps
  const [creating, setCreating] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number>(90);
  const [startNow, setStartNow] = useState<boolean>(true);

  // Timers
  const [endMap, setEndMap] = useState<Record<number, number>>({});
  const [tickMap, setTickMap] = useState<Record<number, string>>({});
  const [msMap, setMsMap] = useState<Record<number, number>>({});

  // UI State
  const [expandedImports, setExpandedImports] = useState<Record<number, boolean>>({});
  const [examToDelete, setExamToDelete] = useState<number | null>(null);
  const [resourcesMap, setResourcesMap] = useState<Record<number, any[]>>({});

  // ... (Exam Timer Logic same as before)
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
      const str = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      setTickMap(prev => ({ ...prev, [Number(p.examId)]: str }));
      setMsMap(prev => ({ ...prev, [Number(p.examId)]: ms }));
      setEndMap(prev => ({ ...prev, [Number(p.examId)]: p.endAt }));
    });
    socket.on("exam-started", (p: any) => {
      setEndMap((m) => ({ ...m, [Number(p.examId)]: Number(p.endAt) }));
    });
    socket.on("exam-ended", (p: any) => {
      setEndMap((m) => { const c = { ...m }; delete c[Number(p.examId)]; return c; });
      setTickMap((tm) => { const c = { ...tm }; delete c[Number(p.examId)]; return c; });
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
    };
  }, [socket]);

  const getTimeStr = (examId: number) => {
    return tickMap[examId] || null;
  };

  async function loadExams() {
    try {
      setLoading(true);
      const data = await apiFetch<Exam[]>("/exams");
      setExams(Array.isArray(data) ? data : []);
    } catch (error) {
      toast("Impossible de charger les examens");
    } finally {
      setLoading(false);
    }
  }

  async function createExam(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return toast("Le titre est requis");
    setCreating(true);
    try {
      const end = new Date(Date.now() + duration * 60000).toISOString();
      const currentRoom = localStorage.getItem("roomNumber");

      const created = await apiFetch<any>("/exams", {
        method: "POST",
        body: JSON.stringify({
          titre,
          description,
          date_fin: end,
          roomNumber: currentRoom
        }),
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
      toast("⚠️ Connexion instable, réessayez plus tard");
      return;
    }
    socket.emit("start-exam", { examId: id, durationMin: duration });
    toast("⏳ Démarrage de l'examen...");
  }
  function stopExam(id: number) {
    if (!socket || !socket.connected) {
      toast("⚠️ Connexion instable");
      return;
    }
    socket.emit("stop-exam", { examId: id });
    toast("🛑 Arrêt de l'examen...");
  }

  async function launchExam(id: number) {
    try {
      await apiFetch(`/exams/${id}/launch`, { method: 'PUT' });
      toast("Examen publié avec succès ! 🚀");
      loadExams();
    } catch (e) {
      toast("Erreur lors de la publication");
    }
  }

  async function fetchResources(id: number) {
    try {
      const data = await apiFetch<any[]>(`/exams/${id}/resources`);
      setResourcesMap(prev => ({ ...prev, [id]: data || [] }));
    } catch (e) { console.error(e); }
  }

  const toggleImport = (id: number) => {
    const isOpen = !expandedImports[id];
    setExpandedImports(prev => ({ ...prev, [id]: isOpen }));
    if (isOpen) fetchResources(id);
  };

  async function uploadResources(examId: number, form: HTMLFormElement) {
    const fd = new FormData(form);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${baseUrl}/exams/${examId}/resources`, {
        method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) return toast("Échec de l'import");
      toast("Fichiers importés ✅");
      (form as any).reset();
      fetchResources(examId);
    } catch (e) { toast("Erreur d'import"); }
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8 animate-fade-in">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
              Tableau de Bord
            </h1>
            {userName && (
              <p className="text-lg font-medium text-slate-600 mt-1">
                Bonjour, <span className="text-indigo-600 font-bold">{userName}</span> 👋
                {userRoom && <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-md text-xs text-slate-500 border border-slate-200">Salle {userRoom}</span>}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
                Gestion en temps réel
              </span>
              <span className="h-4 w-px bg-border"></span>
              <span className={`flex items-center gap-1.5 ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
                {isConnected ? '● Connecté' : '● Déconnecté'}
              </span>
            </div>
          </div>
          <Link href="/professor/login">
            <Button variant="outline">Se déconnecter</Button>
          </Link>
        </header>

        {/* Monitoring & Alerts */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* Alerts Panel */}
          <Card className="md:col-span-1 h-96 flex flex-col p-0 overflow-hidden border-destructive/20" glass>
            <div className="p-4 border-b border-border bg-destructive/5 flex items-center justify-between">
              <h3 className="font-bold text-destructive flex items-center gap-2">
                📢 Alertes
                <span className="animate-pulse bg-red-500 text-white text-[10px] px-1.5 rounded-full">LIVE</span>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/50">
              {alerts.length === 0 && (
                <p className="text-center text-muted-foreground text-sm mt-10">Aucune alerte</p>
              )}
              {alerts.map((alert, i) => (
                <div key={i} className={`p-3 rounded-lg text-sm border-l-4 ${alert.level === 'danger' ? 'bg-red-50 border-red-500 text-red-900' :
                  alert.level === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-900' :
                    'bg-blue-50 border-blue-500 text-blue-900'
                  }`}>
                  <div className="font-bold text-xs opacity-70 mb-1">{alert.time}</div>
                  <div>{alert.message}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Connected Students Panel */}
          <Card className="md:col-span-2 h-96 flex flex-col p-0 overflow-hidden" glass>
            <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                👨‍🎓 Étudiants Connectés {userRoom ? `(Salle ${userRoom})` : ''}
                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{students.length}</span>
              </h3>
              <div className="flex gap-3 text-[10px] uppercase font-bold text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> OK</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Fraude</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Fini</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-background/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {students.map((s, i) => {
                  const isCheating = s.status === 'cheating';
                  const isFinalized = s.status === 'finalized';
                  const isOffline = s.status?.includes('disconnected') || s.status === 'offline';

                  return (
                    <div key={i} className={`
                      relative p-3 rounded-xl border transition-all text-sm
                      ${isCheating ? 'bg-red-50 border-red-200 shadow-sm' :
                        isFinalized ? 'bg-blue-50 border-blue-200' :
                          isOffline ? 'bg-muted border-transparent opacity-60' :
                            'bg-white border-border hover:border-primary/50'}
                    `}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-foreground truncate w-full" title={s.name}>
                          {s.name}
                        </div>
                        <div className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${isCheating ? 'bg-red-500 text-white' :
                          isFinalized ? 'bg-blue-500 text-white' :
                            'bg-emerald-500 text-white'
                          }`}>
                          {s.status === 'connected' ? 'OK' : s.status}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mb-2 flex justify-between">
                        <span>{s.matricule}</span>
                        {s.roomNumber && <span className="bg-slate-100 px-1 rounded text-slate-500">S:{s.roomNumber}</span>}
                      </div>

                      <button
                        onClick={() => setSelectedStudentLogs(s)}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        Voir journaux
                      </button>
                    </div>
                  );
                })}
                {students.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    En attente de connexion...
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Create Exam */}
        <Card className="p-6 border-primary/20 bg-gradient-to-br from-white to-primary/5 dark:from-slate-900 dark:to-slate-800">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            ✨ Nouvel Examen
          </h2>
          <form onSubmit={createExam} className="grid md:grid-cols-2 gap-6">
            <Input
              label="Titre de l'examen"
              placeholder="Ex : Réseaux - Session 1"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
            />
            <Input
              label="Durée (minutes)"
              type="number"
              placeholder="90"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value || "0"))}
            />
            <div className="md:col-span-2">
              <Input
                label="Instructions"
                placeholder="Consignes, matériel autorisé, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between mt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={startNow}
                  onChange={(e) => setStartNow(e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-ring"
                />
                <span className="font-medium text-foreground">Démarrer automatiquement</span>
              </label>

              <Button type="submit" isLoading={creating} size="lg">
                Créer l'examen
              </Button>
            </div>
          </form>
        </Card>

        {/* ... Exam List (Unchanged, just rendering existing logic) ... */}
        {/* Skipping repetitive code block for brevity, ensuring complete functionality is preserved by not removing it actually */}
        {/* Exam List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Examens ({exams.length})</h2>
            <Button variant="ghost" size="sm" onClick={loadExams} className="gap-2">
              Actualiser
            </Button>
          </div>

          <div className="space-y-4">
            {exams.map((ex) => {
              const tl = getTimeStr(ex.id);
              const running = !!endMap[ex.id];
              const isImportOpen = !!expandedImports[ex.id];

              return (
                <Card key={ex.id} className="p-6 transition-all hover:shadow-lg">
                  <div className="flex flex-col md:flex-row gap-6 justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded">#{ex.id}</span>
                        <h3 className="text-xl font-bold text-foreground">{ex.titre || "Sans titre"}</h3>
                        {ex.status === 'launched' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Publié</span>}
                        {ex.status === 'ready' && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">Brouillon</span>}
                      </div>
                      <p className="text-muted-foreground text-sm max-w-2xl">{ex.description || "Pas de description."}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className={`px-4 py-2 rounded-lg font-mono font-bold text-sm ${running ? 'bg-primary/10 text-primary animate-pulse border border-primary/20' : 'bg-muted text-muted-foreground'}`}>{running ? tl : "Inactif"}</div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => startExam(ex.id)} className="text-green-600 hover:text-green-700 hover:bg-green-50">▶</Button>
                        <Button size="sm" variant="outline" onClick={() => stopExam(ex.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">⏹</Button>
                      </div>
                      <div className="h-8 w-px bg-border mx-2"></div>
                      <div className="flex items-center gap-2">
                        <Link href={`/professor/exams/${ex.id}`}><Button size="sm">Accéder</Button></Link>
                        {ex.status !== 'launched' && (
                          <Button size="sm" variant="outline" onClick={() => launchExam(ex.id)} className="text-indigo-600 hover:bg-indigo-50 border-indigo-200">
                            🚀 Publier
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => toggleImport(ex.id)}>Fichiers {isImportOpen ? '▲' : '▼'}</Button>
                        <Button size="sm" variant="danger" onClick={() => deleteExam(ex.id)}>🗑</Button>
                      </div>
                    </div>
                  </div>
                  {isImportOpen && (
                    <div className="mt-6 pt-6 border-t border-border animate-accordion-down">
                      <form onSubmit={(e) => { e.preventDefault(); uploadResources(ex.id, e.currentTarget); }} className="bg-muted/30 p-4 rounded-xl border border-border">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div><label className="block text-sm font-bold text-foreground mb-2">Sujet (PDF)</label><input type="file" name="subject" accept=".pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" /></div>
                          <div><label className="block text-sm font-bold text-foreground mb-2">Pièces jointes</label><input type="file" name="attachments" multiple className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80" /></div>
                        </div>
                        <div className="mt-4 flex justify-end"><Button type="submit" size="sm">Uploader les fichiers</Button></div>
                      </form>
                      <div className="mt-4 flex flex-wrap gap-2">{(resourcesMap[ex.id] || []).map((r, i) => (<a key={i} href={`${baseUrl}${r.url}`} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-white border border-border rounded-lg text-xs font-bold text-primary hover:underline">📄 {r.file_name}</a>))}</div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* LOGS MODAL */}
        {selectedStudentLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <Card className="w-full max-w-lg max-h-[80vh] flex flex-col p-0">
              <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                <h3 className="font-bold text-lg">Journaux : {selectedStudentLogs.name}</h3>
                <button onClick={() => setSelectedStudentLogs(null)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="overflow-y-auto p-4 space-y-3 flex-1">
                {(selectedStudentLogs.history || []).slice().reverse().map((log: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-lg border-l-4 text-sm ${log.type === 'FRAUDE' ? 'bg-red-50 border-red-500' :
                    log.type === 'WIFI_PERDU' ? 'bg-orange-50 border-orange-500' :
                      'bg-slate-50 border-slate-300'
                    }`}>
                    <div className="flex justify-between mb-1 opacity-70 text-xs">
                      <span className="font-mono">{log.at}</span>
                      <span className="font-bold">{log.type}</span>
                    </div>
                    <p>{log.message}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border">
                <Button className="w-full" onClick={() => setSelectedStudentLogs(null)}>Fermer</Button>
              </div>
            </Card>
          </div>
        )}

        <ConfirmModal
          isOpen={!!examToDelete}
          type="danger"
          title="Supprimer l'examen"
          message="Êtes-vous sûr de vouloir supprimer cet examen définitivement ?"
          confirmText="Oui, Supprimer"
          cancelText="Annuler"
          onConfirm={confirmDelete}
          onCancel={() => setExamToDelete(null)}
        />
      </div>
    </div>
  );
}