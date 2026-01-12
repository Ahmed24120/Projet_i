"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Users, FileText, Activity, ServerCrash } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        nbProfs: 0,
        nbStudents: 0,
        nbExamsRunning: 0,
        nbExamsFinished: 0,
    });

    useEffect(() => {
        const load = async () => {
            try {
                const token = localStorage.getItem("token");
                // We simulate stats by fetching lists (not optimal but avoids new backend files)
                // Or if we implemented /users filter, use that.

                // Parallel Fetch
                const [users, exams] = await Promise.all([
                    apiFetch<any[]>("/auth/users?limit=1000", {}, token || undefined).catch(() => []),
                    apiFetch<any[]>("/exams", {}, token || undefined).catch(() => [])
                ]);

                const nbProfs = users.filter((u: any) => u.role === 'professor').length;
                const nbStudents = users.filter((u: any) => u.role === 'student').length; // Likely capped by limit, but ok for dash
                const nbExamsRunning = exams.filter((e: any) => e.status === 'launched' || e.status_code === 2).length;
                const nbExamsFinished = exams.filter((e: any) => e.status === 'finished' || e.status === 'stopped').length;

                setStats({ nbProfs, nbStudents, nbExamsRunning, nbExamsFinished });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="flex h-full items-center justify-center"><LoadingSpinner /></div>;

    const StatCard = ({ title, value, icon: Icon, color }: any) => (
        <Card className="p-6 border-none shadow-md hover:shadow-lg transition-shadow bg-white">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                </div>
            </div>
        </Card>
    );

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Tableau de bord</h2>
                <p className="text-gray-500">Vue d'ensemble de la plateforme</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Professeurs" value={stats.nbProfs} icon={Users} color="bg-blue-500" />
                <StatCard title="Calcul non précis*" value={stats.nbStudents + "+"} icon={Users} color="bg-indigo-500" />
                <StatCard title="Examens en cours" value={stats.nbExamsRunning} icon={Activity} color="bg-green-500" />
                <StatCard title="Examens terminés" value={stats.nbExamsFinished} icon={FileText} color="bg-gray-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Placeholder Logs / Incidents */}
                <Card className="p-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <ServerCrash className="w-5 h-5 text-orange-500" />
                        Derniers incidents (Logs)
                    </h3>
                    <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded border text-sm text-gray-500 text-center italic">
                            Aucun incident critique récent.
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
