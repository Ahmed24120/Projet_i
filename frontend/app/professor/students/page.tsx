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
    Shield,
    Activity
} from "lucide-react";

export default function ProfessorStudentsPage() {
    const socket = useMemo(() => getSocket(), []);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [students, setStudents] = useState<any[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem("prof_sidebar_open");
        if (saved !== null) setSidebarOpen(saved === "true");
    }, []);

    useEffect(() => {
        if (!socket) return;
        const room = localStorage.getItem("roomNumber");
        socket.emit('professor-join', { roomNumber: room });

        const onUpdateStudents = (list: any[]) => setStudents(list);

        socket.on('update-student-list', onUpdateStudents);

        return () => {
            socket.off('update-student-list', onUpdateStudents);
        };
    }, [socket]);

    const toggleSidebar = () => {
        const newState = !sidebarOpen;
        setSidebarOpen(newState);
        localStorage.setItem("prof_sidebar_open", String(newState));
    };

    const filteredStudents = students.filter(s =>
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.matricule || "").includes(searchTerm)
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
                    <Link href="/professor/students" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-600 text-white font-semibold shadow-md shadow-purple-200 transition-all">
                        <Users size={20} /><span className={!sidebarOpen ? 'hidden' : ''}>Etudiants</span>
                    </Link>
                    <Link href="/professor/alerts" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-purple-600 font-medium transition-all">
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
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Etudiants ({students.length})</h1>
                        <p className="text-gray-500 font-medium">Gérez la liste des étudiants connectés en temps réel.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher un étudiant..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none w-72 shadow-sm transition-all"
                            />
                        </div>
                    </div>
                </header>

                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Etudiant</th>
                                    <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Matricule</th>
                                    <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Statut</th>
                                    <th className="text-right py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStudents.map((student, idx) => (
                                    <tr key={student.id || idx} className="group hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
                                                    {(student.name || "?").charAt(0)}
                                                </div>
                                                <span className="font-bold text-gray-800">{student.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4"><span className="font-mono text-sm text-gray-500">{student.matricule}</span></td>
                                        <td className="py-4 px-4">
                                            {student.status === 'cheating' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><Shield size={10} /> Fraude</span>
                                            ) : student.status === 'finalized' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700"> Terminé</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Connecté</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Détails">
                                                    <Activity size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredStudents.length === 0 && (
                            <div className="py-12 text-center text-gray-400 font-medium">Aucun étudiant connecté</div>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
