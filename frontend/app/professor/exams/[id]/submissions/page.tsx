"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, baseUrl } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { toast } from "@/components/ui/Toast";

type Submission = {
    matricule: string;
    files: {
        name: string;
        size: number;
        at: string;
        url: string;
    }[];
};

export default function ExamSubmissions() {
    const { id } = useParams();
    const router = useRouter();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [examTitle, setExamTitle] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/professor/login");
            return;
        }
        loadData();
    }, [id]);

    async function loadData() {
        try {
            const [subs, exam] = await Promise.all([
                apiFetch<Submission[]>(`/exams/${id}/submissions`),
                apiFetch<any>(`/exams/${id}`)
            ]);
            setSubmissions(subs || []);
            setExamTitle(exam?.titre || "");
        } catch (e) {
            toast("Impossible de charger les soumissions");
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;

    return (
        <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href={`/professor/exams/${id}`} className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition-colors">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">📂 تسليمات الطلاب</h1>
                            <p className="text-slate-500 font-medium">{examTitle || `امتحان #${id}`}</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {submissions.map((sub, idx) => (
                        <Card key={idx} className="p-6 border-2 border-slate-100 hover:border-primary-500 transition-all group">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl group-hover:bg-primary-50 transition-colors">
                                    🎓
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">{sub.matricule}</h3>
                                    <p className="text-sm text-slate-400 font-mono">{sub.files.length} ملفات مسلمة</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {sub.files.map((file, fIdx) => (
                                    <div key={fIdx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <a
                                                href={`${baseUrl}${file.url}`}
                                                target="_blank"
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Afficher"
                                            >
                                                👁️
                                            </a>
                                            <a
                                                href={`${baseUrl}${file.url}`}
                                                download
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Télécharger"
                                            >
                                                📥
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}

                    {submissions.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                            <div className="text-6xl mb-4">📭</div>
                            <h3 className="text-xl font-bold text-slate-900">لا توجد تسليمات بعد</h3>
                            <p className="text-slate-400">ستظهر ملفات الطلاب هنا بمجرد رفعها.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
