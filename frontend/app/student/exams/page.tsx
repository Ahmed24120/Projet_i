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

type Exam = {
  id: number;
  titre: string;
  description: string;
  date_debut?: string;
  date_fin?: string;
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
      setActiveExamsMap(prev => {
        const copy = { ...prev };
        delete copy[p.examId];
        return copy;
      });
    });

    socket.on("exam-stopped", (p) => {
      setActiveExamsMap(prev => {
        const copy = { ...prev };
        delete copy[p.examId];
        return copy;
      });
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-white">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const filteredExams = exams.filter(ex =>
    ex.titre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">

        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-sky-100">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {user?.prenom?.[0] || "E"}
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
                Bienvenue, {user?.prenom || "Étudiant"} 👋
              </h1>
              <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {user?.matricule ? `Matricule : ${user.matricule}` : "Compte Étudiant"}
              </p>
            </div>
          </div>
          <Button onClick={logout} variant="danger" className="shadow-md hover:shadow-lg transition-all">
            Déconnexion
          </Button>
        </header>

        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <span className="text-4xl">📚</span> Examens Disponibles
            </h2>

            <div className="w-full md:w-auto md:min-w-[300px]">
              <Input
                placeholder="Rechercher un examen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-sky-200 focus:border-sky-400 focus:ring-sky-400"
                fullWidth
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredExams.map((exam) => {
              const isActive = !!activeExamsMap[exam.id];
              return (
                <Card key={exam.id} hover className={`flex flex-col h-full border-t-4 shadow-lg hover:shadow-xl transition-all duration-300 bg-white ${isActive ? 'border-t-sky-500' : 'border-t-gray-300'}`}>
                  <div className="flex-1 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isActive ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                        {isActive ? '🟢 En cours' : '⏳ Disponible'}
                      </span>
                      <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">#{exam.id}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2 flex-wrap">
                      {exam.titre}
                      {(exam as any).room_number && (
                        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full font-semibold">
                          🚪 Salle {(exam as any).room_number}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-3 mb-6 leading-relaxed">
                      {exam.description || "Aucune description disponible pour cet examen."}
                    </p>
                  </div>

                  <div className="p-6 pt-0 mt-auto">
                    <div className="flex items-center justify-between mb-4 text-xs font-medium text-gray-500">
                      <span className="flex items-center gap-1">⏱️ Temps réel</span>
                      <span className="flex items-center gap-1">🔒 Sécurisé</span>
                    </div>
                    <Link href={`/student/exams/${exam.id}`} className="block">
                      <Button className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 shadow-md hover:shadow-lg transition-all" size="lg">
                        Rejoindre l'examen ✍️
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            })}

            {exams.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-dashed border-sky-200 shadow-lg">
                <div className="text-6xl mb-6 opacity-80">📚</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Aucun examen disponible</h3>
                <p className="text-gray-600">Les examens de votre salle apparaîtront ici une fois créés.</p>
              </div>
            )}

            {exams.length > 0 && filteredExams.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-600 bg-white/50 rounded-xl">
                Aucun examen ne correspond à votre recherche.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
