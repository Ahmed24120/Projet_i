"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { Search, LogOut, Clock, ShieldCheck, DoorOpen, Smile, Frown } from "lucide-react";

type Exam = {
  id: number;
  titre: string;
  description: string;
  date_debut?: string;
  date_fin?: string;
  status_code?: number;
};

export default function StudentExams() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExamsMap, setActiveExamsMap] = useState<Record<number, number>>({});
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/student/login");
      return;
    }

    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(u);
    } catch { }

    loadExams(token);

    const socket = getSocket();

    socket.on("initial-sync", ({ activeExams }) => {
      const map: Record<number, number> = {};
      activeExams.forEach((ae: any) => map[Number(ae.examId)] = ae.endAt);
      setActiveExamsMap(map);
    });

    socket.on("exam-started", (p) => {
      setActiveExamsMap(prev => ({ ...prev, [p.examId]: p.endAt }));
      loadExams(token);
    });

    socket.on("exam-ended", (p) => {
      setActiveExamsMap(prev => { const copy = { ...prev }; delete copy[p.examId]; return copy; });
      loadExams(token); // Refresh list to remove if needed
    });

    socket.on("exam-stopped", (p) => {
      setActiveExamsMap(prev => { const copy = { ...prev }; delete copy[p.examId]; return copy; });
      loadExams(token); // Refresh list to remove it
    });

    return () => {
      socket.off("initial-sync");
      socket.off("exam-started");
      socket.off("exam-ended");
      socket.off("exam-stopped");
    };
  }, []);

  async function loadExams(token: string) {
    try {
      const room = localStorage.getItem("roomNumber");
      const url = room ? `/exams?roomNumber=${room}` : "/exams";
      const data = await apiFetch<Exam[]>(url, {}, token);
      setExams(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast("Erreur lors du chargement des examens");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/student/login");
  }

  const filteredExams = exams.filter(ex =>
    ex.titre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200">
              {user?.prenom?.[0] || "E"}
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900 leading-tight">
                {user?.prenom && user?.nom ? `${user.prenom} ${user.nom}` : "Espace Étudiant"}
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                {user?.matricule ? `Matricule: ${user.matricule}` : "Bonne chance !"}
              </p>
            </div>
          </div>

          <Button onClick={logout} variant="ghost" className="text-red-400 hover:text-red-500 hover:bg-red-50 gap-2">
            <LogOut size={18} />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Examens Disponibles</h2>
            <p className="text-gray-500 font-medium">Sélectionnez un examen pour commencer.</p>
          </div>

          <div className="relative group w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Rechercher un examen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm font-medium"
            />
          </div>
        </div>

        {filteredExams.length === 0 && !loading ? (
          <div className="text-center py-24 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Frown size={40} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun examen trouvé</h3>
            <p className="text-gray-500 max-w-md mx-auto">Il semble qu'aucun examen ne soit disponible pour le moment or ne corresponde à votre recherche.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredExams.map((exam) => {
              const isActive = !!activeExamsMap[exam.id];
              // Hide finished exams from student view to avoid confusion? 
              // Or show them as disabled/history?
              // User asked "verifier si les examens finis apparaissent normalement CHEZ LE PROF". For students, usually we only show active ones.
              // But let's keep them visible if backend sends them, just styled.

              return (
                <div key={exam.id} className="group bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col relative overflow-hidden">
                  {isActive && <div className="absolute top-0 inset-x-0 h-1.5 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]"></div>}

                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {isActive ? <><Clock size={12} className="animate-spin-slow" /> En Cours</> : 'En Attente'}
                    </span>
                    <span className="text-gray-300 font-mono text-xs">#{exam.id}</span>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight">{exam.titre}</h3>
                  <p className="text-sm text-gray-500 line-clamp-3 mb-8 flex-1 leading-relaxed">
                    {exam.description || "Pas de description fournie pour cet examen."}
                  </p>

                  {isActive ? (
                    <Link href={`/student/exams/${exam.id}`} className="block mt-auto">
                      <Button className="w-full py-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300 font-bold text-lg group-hover:scale-[1.02] transition-transform">
                        Commencer l'examen
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full py-6 rounded-xl bg-gray-100 text-gray-400 font-bold border border-gray-200 cursor-not-allowed mt-auto">
                      Pas encore commencé
                    </Button>
                  )}

                  <div className="mt-6 pt-6 border-t border-gray-50 flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-wider justify-center">
                    <span className="flex items-center gap-1"><ShieldCheck size={14} /> Sécurisé</span>
                    <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                    <span className="flex items-center gap-1"><DoorOpen size={14} /> {(exam as any).room_number ? `Salle ${(exam as any).room_number}` : 'Présentiel'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  );
}
