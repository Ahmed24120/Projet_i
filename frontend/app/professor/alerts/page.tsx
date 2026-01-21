"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import {
    ChevronLeft,
    ChevronRight,
    LayoutDashboard,
    FileText,
    Users,
    Bell,
    LogOut,
    Search,
    Filter,
    AlertTriangle,
    Eye,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ProfessorAlertsPage() {
    const socket = useMemo(() => getSocket(), []);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem("prof_sidebar_open");
        if (saved !== null) setSidebarOpen(saved === "true");
    }, []);

    useEffect(() => {
        if (!socket) return;
        const room = localStorage.getItem("roomNumber");
        socket.emit('professor-join', { roomNumber: room });

        const onAlert = (alert: any) => {
            setAlerts(prev => [alert, ...prev].slice(0, 100)); // Keep last 100 alerts
        };

        // Also listen for submission updates which are kind of alerts
        const onSubmissionUpdate = (data: any) => {
            if (data.type === 'CANCELLED') {
                onAlert({
                    type: 'CANCELLED',
                    message: `Soumission annulée`,
                    description: `L'étudiant ${data.matricule} a annulé sa soumission.`,
                    student: data.matricule,
                    level: 'warning',
                    time: new Date().toLocaleTimeString()
                });
            }
        };

        socket.on('alert', onAlert);
        socket.on('professor:submission-update', onSubmissionUpdate);

        return () => {
            socket.off('alert', onAlert);
            socket.off('professor:submission-update', onSubmissionUpdate);
        };
    }, [socket]);

    const toggleSidebar = () => {
        const newState = !sidebarOpen;
        setSidebarOpen(newState);
        localStorage.setItem("prof_sidebar_open", String(newState));
    };

    const filteredAlerts = alerts.filter(a =>
        (a.message || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.student || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <Link href="/professor/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-purple-600 font-medium transition-all">
                        <LayoutDashboard size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Tableau de Bord</span>
                    </Link>
                    <Link href="/professor/exams" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-purple-600 font-medium transition-all">
                        <FileText size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Mes Exemens</span>
                    </Link>
                    <Link href="/professor/students" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-purple-600 font-medium transition-all">
                        <Users size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Etudiants</span>
                    </Link>
                    <Link href="/professor/alerts" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-600 text-white font-semibold shadow-md shadow-purple-200 transition-all">
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

                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Alertes ({alerts.length})</h1>
                        <p className="text-gray-500 font-medium">Historique des alertes et notifications de sécurité.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher une alerte..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none w-72 shadow-sm transition-all"
                            />
                        </div>
                        <Button variant="outline" className="h-11 px-4 rounded-xl border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                            <Filter size={18} /> Filtrer
                        </Button>
                    </div>
                </header>

                <div className="space-y-4">
                    {filteredAlerts.length === 0 && <div className="text-center py-12 text-gray-400 font-medium">Aucune alerte reçue pour le moment</div>}

                    {filteredAlerts.map((alert, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start gap-5 hover:shadow-md transition-shadow group">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${alert.level === 'danger' ? 'bg-red-100 text-red-600' : alert.level === 'warning' ? 'bg-orange-100 text-orange-600' : alert.level === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                <AlertTriangle size={24} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-bold text-lg text-gray-900">{alert.message || "Alerte"}</h3>
                                    <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{alert.time || new Date().toLocaleTimeString()}</span>
                                </div>
                                <p className="text-gray-600 text-sm mb-2">{alert.description || alert.message}</p>
                                {alert.student && (
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                        <Users size={14} className="text-purple-400" /> Étudiant : <span className="text-purple-600">{alert.student}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Voir détails">
                                    <Eye size={18} />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </main>
        </div>
    );
}
