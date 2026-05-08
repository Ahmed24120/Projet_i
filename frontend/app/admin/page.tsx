"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Users, GraduationCap, Play, CheckCircle, AlertTriangle, Activity, Database, Server } from "lucide-react";

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        profs: 0,
        students: 0,
        activeExams: 0,
        finishedExams: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const [users, exams] = await Promise.all([
                    apiFetch<any[]>("/auth/users?role="),
                    apiFetch<any[]>("/exams")
                ]);

                const profs = users.filter(u => u.role === 'professor').length;
                const students = users.filter(u => u.role === 'student').length;

                const activeExams = exams.filter(e => e.status === 'launched' || e.status_code === 2).length;
                const finishedExams = exams.filter(e => ['finished', 'stopped'].includes(e.status) || e.status_code >= 3).length;

                setStats({ profs, students, activeExams, finishedExams });
            } catch (e) {
                console.error("Failed to load stats", e);
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, []);

    if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Chargement du tableau de bord...</div>;

    const cards = [
        {
            label: "Professeurs",
            val: stats.profs,
            icon: GraduationCap,
            bg: "bg-gradient-to-br from-indigo-500 to-indigo-600",
            text: "text-white",
            desc: "Comptes actifs"
        },
        {
            label: "Étudiants",
            val: stats.students,
            icon: Users,
            bg: "bg-white",
            text: "text-blue-600",
            border: "border-blue-100",
            desc: "Inscrits sur la plateforme"
        },
        {
            label: "Examens En Cours",
            val: stats.activeExams,
            icon: Activity,
            bg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
            text: "text-white",
            desc: "Sessions actives maintenant"
        },
        {
            label: "Examens Terminés",
            val: stats.finishedExams,
            icon: Database,
            bg: "bg-white",
            text: "text-gray-600",
            border: "border-gray-100",
            desc: "Archives disponibles"
        },
    ];

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Tableau de Bord</h1>
                    <p className="text-gray-500 font-medium">Vue d'ensemble de la plateforme et statistiques.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full font-bold text-sm border border-green-100">
                    <Server size={16} /> Système Opérationnel
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((c) => (
                    <div
                        key={c.label}
                        className={`
              relative p-6 rounded-2xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden
              ${c.bg} ${c.text} ${c.border ? `border ${c.border}` : ''}
            `}
                    >
                        {/* Decor */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${c.bg === 'bg-white' ? 'bg-gray-50' : 'bg-white/20 backdrop-blur-sm'}`}>
                                    <c.icon size={24} />
                                </div>
                            </div>

                            <div>
                                <div className="text-4xl font-black mb-1 tracking-tight">{c.val}</div>
                                <div className="font-bold opacity-90">{c.label}</div>
                                <div className="text-xs opacity-70 mt-1 font-medium">{c.desc}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* System Health / Logs Area */}
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Activity className="text-blue-500" />
                    Activité Récente
                </h3>
                <div className="space-y-4">
                    {/* Mock Logs - can be real later */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <div className="flex-1 font-medium text-gray-700">Système démarré avec succès</div>
                        <div className="text-xs text-gray-400 font-mono">À l'instant</div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <div className="flex-1 font-medium text-gray-700">Base de données connectée (SQLite)</div>
                        <div className="text-xs text-gray-400 font-mono">À l'instant</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
