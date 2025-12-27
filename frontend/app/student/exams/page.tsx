"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
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

    // ✅ Écouter les mises à jour d'examens en temps réel
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
      const data = await apiFetch<Exam[]>("/exams", {}, token);
      setExams(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast("خطأ في تحميل الامتحانات");
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold border border-primary-200">
              {user?.prenom?.[0] || "S"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">أهلاً بك، {user?.prenom || "طالب"} 👋</h1>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {user?.matricule ? `رقم الطالب: ${user.matricule}` : "طالب مسجل"}
              </p>
            </div>
          </div>
          <Button onClick={logout} className="bg-red-600 text-white hover:bg-red-700 border border-red-700 font-semibold shadow-md">
            تسجيل خروج
          </Button>
        </header>

        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">📚</span> الامتحانات المتاحة
            </h2>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="بحث عن امتحان..."
                  className="pl-4 pr-10 py-2 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 w-full sm:w-64 transition-all text-gray-900"
                  onChange={(e) => { /* TODO: Implement search logic */ }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold shadow-md shadow-primary-500/20">الكل</button>
                <button className="px-4 py-2 rounded-xl bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 text-sm font-semibold transition-colors">نشط</button>
                <button className="px-4 py-2 rounded-xl bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 text-sm font-semibold transition-colors">منتهي</button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {exams.filter(ex => !!activeExamsMap[ex.id]).map((exam) => {
              return (
                <Card key={exam.id} hoverEffect className="flex flex-col h-full border-t-4 border-t-green-500">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <Badge className="bg-green-100 text-green-700">متاح الآن</Badge>
                      <span className="text-xs text-gray-400">#{exam.id}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{exam.titre}</h3>
                    <p className="text-sm text-gray-500 line-clamp-3 mb-6">
                      {exam.description || "لا يوجد وصف متاح لهذا الامتحان."}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 mt-auto">
                    <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">⏱️ جاري</span>
                      <span className="flex items-center gap-1">🔒 مراقب</span>
                    </div>
                    <Link href={`/student/exams/${exam.id}`} className="block">
                      <Button className="w-full bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/20">
                        انضم للامتحان ✍️
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            })}

            {exams.filter(ex => !!activeExamsMap[ex.id]).length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-lg font-bold text-gray-900">لا يوجد امتحانات حالياً</h3>
                <p className="text-gray-500">استمتع بوقتك! ستظهر الامتحانات هنا عند نشرها.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
