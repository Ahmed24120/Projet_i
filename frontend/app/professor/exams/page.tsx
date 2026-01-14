"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { baseUrl, apiFetch } from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type Exam = {
  id: number;
  titre?: string;
  description?: string;
  date_fin?: string | null;
  sujet_path?: string | null;
  status?: string;
  status_code?: number;
};

export default function ProfessorExamsListPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("prof_sidebar_open");
    if (saved !== null) setSidebarOpen(saved === "true");
    load();
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem("prof_sidebar_open", String(newState));
  };

  async function load() {
    try {
      setLoading(true);
      const data = await apiFetch<Exam[]>("/exams");
      setExams(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e.message && (e.message.includes("403") || e.message.includes("401"))) {
        window.location.href = "/professor/login";
        return;
      }
      console.error(e);
      toast("Impossible de charger les examens");
    } finally {
      setLoading(false);
    }
  }

  const filteredExams = exams.filter(ex =>
    (ex.titre || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusInfo = (ex: Exam) => {
    // Logic based on status_code or status string
    if (ex.status_code === 4 || ex.status === 'finished') return { label: "Terminé", color: "bg-blue-100 text-blue-700", icon: CheckCircle };
    if (ex.status_code === 3 || ex.status === 'stopped') return { label: "Arrêté", color: "bg-red-100 text-red-700", icon: AlertCircle };
    if (ex.status_code === 2 || ex.status === 'launched') return { label: "En cours", color: "bg-green-100 text-green-700 animate-pulse", icon: Clock };
    if (ex.status_code === 1 || ex.status === 'published') return { label: "Publié", color: "bg-indigo-100 text-indigo-700", icon: Eye };
    return { label: "Brouillon", color: "bg-gray-100 text-gray-600", icon: FileText };
  };

  // Export Button Handler
  const handleExport = (e: any, examId: number) => {
    e.stopPropagation();
    e.preventDefault();
    const token = localStorage.getItem("token");
    toast("Préparation du téléchargement...");
    fetch(`${baseUrl}/exams/${examId}/export`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `examen_${examId}_export.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast("Téléchargement démarré ✅");
      })
      .catch(e => toast("Erreur téléchargement: " + e.message));
  };

  const activeExams = filteredExams.filter(ex => !ex.status_code || ex.status_code <= 2 && ex.status !== 'finished' && ex.status !== 'stopped');
  const archivedExams = filteredExams.filter(ex => ex.status_code === 3 || ex.status_code === 4 || ex.status === 'finished' || ex.status === 'stopped');

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 font-sans relative overflow-hidden">
      {/* Ambient Background Decorations */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-72 px-6' : 'w-20 px-3'} bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 flex flex-col fixed h-full z-40 left-0 top-0 shadow-2xl shadow-indigo-500/5`}>
        <div className="h-24 flex items-center justify-between mb-2">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-300/50 ring-2 ring-indigo-100">
                P
              </div>
              <div>
                <h1 className="font-black text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight leading-4">Espace Prof</h1>
                <p className="text-xs text-gray-500 font-semibold mt-1">Administration</p>
              </div>
            </div>
          )}
          <button onClick={toggleSidebar} className="p-2.5 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all duration-200">
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
          <Link href="/professor/dashboard" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50/30 hover:text-indigo-600 font-bold transition-all duration-200 group">
            <LayoutDashboard size={22} className="group-hover:scale-110 transition-transform" />
            {sidebarOpen && <span>Tableau de bord</span>}
          </Link>

          <Link href="/professor/exams" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-200/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-300/50">
            <FileText size={22} />
            {sidebarOpen && <span>Mes Examens</span>}
          </Link>

          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-4"></div>
        </nav>

        <div className="py-8 mt-auto">
          <Link href="/professor/login" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 text-red-400 hover:text-red-500 font-bold transition-all duration-200 group">
            <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" />
            {sidebarOpen && <span>Déconnexion</span>}
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'} p-8 md:p-12`}>
        <div className="max-w-6xl mx-auto space-y-10">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black bg-gradient-to-r from-gray-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent tracking-tight mb-2">Mes Examens</h1>
              <p className="text-gray-600 font-semibold">Gérez vos évaluations et consultez l'historique.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors duration-200" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un examen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 pr-4 py-3 rounded-2xl border border-gray-200/50 bg-white/80 backdrop-blur-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all w-72 shadow-lg shadow-gray-200/50 font-medium hover:shadow-xl hover:shadow-indigo-100/30"
                />
              </div>
              <Button onClick={load} variant="outline" className="h-12 px-4 rounded-2xl border-gray-200/50 bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-lg hover:shadow-indigo-100/30 transition-all gap-2">
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid gap-5">
              {[1, 2, 3].map(i => <div key={i} className="h-36 bg-white/60 backdrop-blur-sm rounded-3xl animate-pulse shadow-lg" />)}
            </div>
          ) : (
            <div className="space-y-12">

              {/* ACTIFS */}
              <section>
                <h2 className="text-2xl font-black text-gray-900 mb-7 flex items-center gap-3">
                  <div className="w-1.5 h-9 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full shadow-lg shadow-indigo-200"></div>
                  Examens Actifs & Brouillons
                  <span className="bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 text-xs px-3 py-1.5 rounded-full font-black border border-indigo-100">{activeExams.length}</span>
                </h2>

                {activeExams.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-gray-300 rounded-3xl bg-white/40 backdrop-blur-sm">
                    <div className="text-5xl mb-3 opacity-30">📋</div>
                    <p className="text-gray-500 font-semibold">Aucun examen actif</p>
                  </div>
                ) : (
                  <div className="grid gap-5">
                    {activeExams.map((ex) => {
                      const status = getStatusInfo(ex);
                      const StatusIcon = status.icon;
                      return (
                        <div key={ex.id} className="group bg-white/70 backdrop-blur-xl rounded-[2rem] p-7 border border-white/60 shadow-lg shadow-gray-200/50 hover:shadow-2xl hover:shadow-indigo-200/30 hover:-translate-y-1.5 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-[2rem]" />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={`px-4 py-1.5 rounded-xl text-[11px] uppercase font-black tracking-wider flex items-center gap-2 shadow-sm ${status.color}`}>
                                <StatusIcon size={14} /> {status.label}
                              </span>
                              <span className="text-gray-400 text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-lg">#{ex.id}</span>
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{ex.titre || "Sans titre"}</h3>
                            <p className="text-sm text-gray-600 line-clamp-1 font-medium">{ex.description || "Aucune description"}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Link href={`/professor/exams/${ex.id}`}>
                              <Button className="rounded-2xl px-7 py-6 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-purple-600 border-0 shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50 transition-all duration-300 font-bold text-sm group/btn">
                                Gérer / Surveiller
                                <ChevronRight size={18} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ARCHIVES */}
              <section>
                <h2 className="text-2xl font-black text-gray-900 mb-7 flex items-center gap-3">
                  <div className="w-1.5 h-9 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full shadow-lg shadow-gray-200"></div>
                  Archives / Terminés
                  <span className="bg-gradient-to-r from-gray-50 to-slate-50 text-gray-700 text-xs px-3 py-1.5 rounded-full font-black border border-gray-200">{archivedExams.length}</span>
                </h2>

                {archivedExams.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-gray-300 rounded-3xl bg-white/40 backdrop-blur-sm">
                    <div className="text-5xl mb-3 opacity-30">📦</div>
                    <p className="text-gray-500 font-semibold">Aucune archive</p>
                  </div>
                ) : (
                  <div className="grid gap-5">
                    {archivedExams.map((ex) => {
                      const status = getStatusInfo(ex);
                      const StatusIcon = status.icon;
                      return (
                        <div key={ex.id} className="group bg-gradient-to-br from-gray-50/80 to-slate-50/80 backdrop-blur-sm rounded-[2rem] p-7 border border-gray-200/70 shadow-md shadow-gray-200/40 hover:shadow-xl hover:shadow-gray-300/50 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={`px-4 py-1.5 rounded-xl text-[11px] uppercase font-black tracking-wider flex items-center gap-2 shadow-sm ${status.color}`}>
                                <StatusIcon size={14} /> {status.label}
                              </span>
                              <span className="text-gray-400 text-xs font-mono bg-white/60 px-2 py-0.5 rounded-lg">#{ex.id}</span>
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 mb-2">{ex.titre || "Sans titre"}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
                              <Clock size={13} />
                              Terminé le {ex.date_fin || "ND"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={(e) => handleExport(e, ex.id)}
                              className="rounded-2xl px-6 py-5 bg-white text-indigo-600 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-indigo-600 hover:text-white border border-indigo-200 shadow-lg shadow-indigo-100/50 hover:shadow-xl hover:shadow-indigo-200/50 transition-all duration-300 font-bold text-sm group/download"
                            >
                              <span className="text-lg mr-2 group-hover/download:scale-110 inline-block transition-transform">📥</span> Télécharger ZIP
                            </Button>
                            <Link href={`/professor/exams/${ex.id}`}>
                              <Button variant="ghost" className="rounded-2xl px-5 py-5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 font-semibold transition-all group/details">
                                Détails <ChevronRight size={16} className="group-hover/details:translate-x-1 transition-transform" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
