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
  const handleExport = async (e: any, examId: number) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      toast("Préparation de l'archive...");
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/api/exams/${examId}/export`, {
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur export");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archive_exam_${examId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("✅ Archive téléchargée");
    } catch (err: any) {
      toast("❌ " + err.message);
    }
  };

  const activeExams = filteredExams.filter(ex => !ex.status_code || ex.status_code <= 2 && ex.status !== 'finished' && ex.status !== 'stopped');
  const archivedExams = filteredExams.filter(ex => ex.status_code === 3 || ex.status_code === 4 || ex.status === 'finished' || ex.status === 'stopped');

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-72 px-6' : 'w-20 px-3'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col fixed h-full z-40 left-0 top-0 shadow-2xl shadow-gray-200/50`}>
        <div className="h-24 flex items-center justify-between mb-2">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">
                P
              </div>
              <div>
                <h1 className="font-black text-lg text-gray-800 tracking-tight leading-4">Espace Prof</h1>
                <p className="text-xs text-gray-400 font-medium mt-1">Administration</p>
              </div>
            </div>
          )}
          <button onClick={toggleSidebar} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
          <Link href="/professor/dashboard" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-gray-500 hover:bg-gray-50 hover:text-indigo-600 font-bold transition-all group">
            <LayoutDashboard size={22} className="group-hover:scale-110 transition-transform" />
            {sidebarOpen && <span>Tableau de bord</span>}
          </Link>

          <Link href="/professor/exams" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-indigo-50 text-indigo-600 font-bold shadow-sm shadow-indigo-100 transition-all">
            <FileText size={22} />
            {sidebarOpen && <span>Mes Examens</span>}
          </Link>

          <div className="h-px bg-gray-100 my-4 mx-2"></div>
        </nav>

        <div className="py-8 mt-auto">
          <Link href="/professor/login" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 text-red-400 hover:text-red-500 font-bold transition-all group">
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
              <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Mes Examens</h1>
              <p className="text-gray-500 font-medium">Gérez vos évaluations et consultez l'historique.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none transition-all w-64 shadow-sm font-medium"
                />
              </div>
              <Button onClick={load} variant="outline" className="h-11 px-4 rounded-xl border-gray-200 hover:bg-white hover:shadow-md transition-all gap-2">
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse shadow-sm" />)}
            </div>
          ) : (
            <div className="space-y-12">

              {/* ACTIFS */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                  Examens Actifs & Brouillons
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{activeExams.length}</span>
                </h2>

                {activeExams.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                    <p className="text-gray-400 font-medium">Aucun examen actif</p>
                  </div>
                ) : (
                  <div className="grid gap-5">
                    {activeExams.map((ex) => {
                      const status = getStatusInfo(ex);
                      const StatusIcon = status.icon;
                      return (
                        <div key={ex.id} className="group bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider flex items-center gap-1.5 ${status.color}`}>
                                <StatusIcon size={12} /> {status.label}
                              </span>
                              <span className="text-gray-400 text-xs font-mono">#{ex.id}</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{ex.titre || "Sans titre"}</h3>
                            <p className="text-sm text-gray-500 line-clamp-1">{ex.description || "Aucune description"}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Link href={`/professor/exams/${ex.id}`}>
                              <Button className="rounded-xl px-6 py-5 bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-100 hover:border-indigo-100 shadow-sm hover:shadow-md transition-all font-bold">
                                Gérer / Surveiller
                                <ChevronRight size={18} className="ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
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
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <div className="w-2 h-8 bg-gray-500 rounded-full"></div>
                  Archives / Terminés
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{archivedExams.length}</span>
                </h2>

                {archivedExams.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                    <p className="text-gray-400 font-medium">Aucune archive</p>
                  </div>
                ) : (
                  <div className="grid gap-5 opacity-80 hover:opacity-100 transition-opacity">
                    {archivedExams.map((ex) => {
                      const status = getStatusInfo(ex);
                      const StatusIcon = status.icon;
                      return (
                        <div key={ex.id} className="group bg-gray-50/50 rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider flex items-center gap-1.5 ${status.color}`}>
                                <StatusIcon size={12} /> {status.label}
                              </span>
                              <span className="text-gray-400 text-xs font-mono">#{ex.id}</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 mb-1">{ex.titre || "Sans titre"}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Clock size={12} />
                              Fini le {ex.date_fin || "ND"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={(e) => handleExport(e, ex.id)}
                              className="rounded-xl px-5 py-4 bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 shadow-sm hover:shadow-md transition-all font-bold text-sm"
                            >
                              📥 Télécharger ZIP
                            </Button>
                            <Link href={`/professor/exams/${ex.id}`}>
                              <Button variant="ghost" className="rounded-xl px-4 py-4 text-gray-400 hover:text-gray-600">
                                Détails <ChevronRight size={16} />
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
