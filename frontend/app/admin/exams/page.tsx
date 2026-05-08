"use client";

import { useEffect, useState } from "react";
import { apiFetch, baseUrl } from "@/lib/api";
import { Play, Square, Download, FolderDown, AlertCircle, FileText, Calendar, Clock, User, CheckCircle, Search, Hash } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/components/ui/Toast";

export default function AdminExamsPage() {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal State
    const [confirmAction, setConfirmAction] = useState<{
        open: boolean;
        type: 'stop' | 'finish' | null;
        examId: number | null;
    }>({ open: false, type: null, examId: null });

    const fetchExams = async () => {
        setLoading(true);
        try {
            const res = await apiFetch<any[]>("/exams");
            setExams(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
    }, []);

    const filteredExams = exams.filter(e =>
        e.titre.toLowerCase().includes(search.toLowerCase()) ||
        (e.prof_name && e.prof_name.toLowerCase().includes(search.toLowerCase()))
    );

    const openConfirm = (type: 'stop' | 'finish', id: number) => {
        setConfirmAction({ open: true, type, examId: id });
    };

    const executeAction = async () => {
        const { type, examId } = confirmAction;
        if (!type || !examId) return;

        try {
            await apiFetch(`/exams/${examId}/${type}`, { method: "POST" });
            toast(type === 'stop' ? "Examen arrêté avec succès" : "Examen clôturé et archivé");
            fetchExams();
        } catch (e: any) {
            toast(e.message || "Erreur lors de l'action");
        } finally {
            setConfirmAction({ open: false, type: null, examId: null });
        }
    };

    const handleExport = async (id: number) => {
        try {
            const token = localStorage.getItem("token");
            const url = `${baseUrl}/exams/${id}/export`;

            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error("Erreur téléchargement");

            const blob = await res.blob();
            const loadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = loadUrl;
            a.download = `examen_${id}_export.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast("Téléchargement démarré 📥");
        } catch (e: any) {
            toast("Erreur Export: " + e.message);
        }
    };

    const getStatusBadge = (e: any) => {
        const s = e.status_code;
        if (s === 2) return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold animate-pulse shadow-sm shadow-emerald-100 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> EN COURS
            </span>
        );
        if (s === 3) return <span className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 shadow-sm">🛑 STOPPÉ</span>;
        if (s === 4) return <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200 shadow-sm">🏁 TERMINÉ</span>;
        if (s === 1) return <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 shadow-sm">🚀 PUBLIÉ</span>;
        return <span className="px-3 py-1.5 rounded-full bg-gray-50 text-gray-500 text-xs font-bold border border-gray-200 border-dashed">BROUILLON</span>;
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestion Examens</h1>
                    <p className="text-gray-500 font-medium mt-1">Surveillance et archivage des sessions d'examen.</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100/80">
                <div className="relative max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Rechercher par titre ou nom du professeur..."
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium text-gray-700"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/80 border-b border-gray-100">
                        <tr>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-wider w-1/3">Examen</th>
                            <th className="px-6 py-6 text-gray-400 font-bold text-xs uppercase tracking-wider">Professeur</th>
                            <th className="px-6 py-6 text-gray-400 font-bold text-xs uppercase tracking-wider">Planification</th>
                            <th className="px-6 py-6 text-gray-400 font-bold text-xs uppercase tracking-wider text-center">État</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-wider text-right">Contrôles</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredExams.map(e => (
                            <tr key={e.id} className="group hover:bg-blue-50/40 transition-all duration-200">
                                <td className="px-8 py-5">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl flex items-center justify-center shadow-sm transition-colors
                                            ${e.status_code === 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'}
                                        `}>
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">{e.titre}</div>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <Hash size={12} className="text-gray-400" />
                                                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{e.matiere_code || "CODE"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 border border-gray-200">
                                            <User size={14} />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700">{e.prof_name || "Non assigné"}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex flex-col gap-1.5 text-sm text-gray-500">
                                        <div className="flex items-center gap-2 font-medium">
                                            <Calendar size={14} className="text-gray-400" />
                                            {e.date_debut ? new Date(e.date_debut).toLocaleDateString('fr-FR') : "-"}
                                        </div>
                                        {e.duration_min > 0 && (
                                            <div className="flex items-center gap-2 text-xs bg-gray-50 px-2 py-1 rounded w-fit text-gray-600 border border-gray-100">
                                                <Clock size={12} /> {e.duration_min} min
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <div className="flex justify-center">
                                        {getStatusBadge(e)}
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex items-center justify-end gap-2 transition-opacity opacity-0 group-hover:opacity-100">
                                        {/* STOP BUTTON */}
                                        {e.status_code === 2 && (
                                            <button
                                                onClick={() => openConfirm('stop', e.id)}
                                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-lg transition-all hover:shadow-sm"
                                                title="Arrêt d'Urgence"
                                            >
                                                <Square size={16} fill="currentColor" /> Arrêter
                                            </button>
                                        )}
                                        {/* FINISH BUTTON */}
                                        {(e.status_code === 3 || e.status_code === 2) && (
                                            <button
                                                onClick={() => openConfirm('finish', e.id)}
                                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all hover:shadow-sm"
                                                title="Clôturer définitivement"
                                            >
                                                <FolderDown size={16} /> Clôturer
                                            </button>
                                        )}
                                        {/* EXPORT BUTTON */}
                                        {(e.status_code === 3 || e.status_code === 4) && (
                                            <button
                                                onClick={() => handleExport(e.id)}
                                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-all hover:shadow-sm"
                                                title="Télécharger ZIP"
                                            >
                                                <Download size={16} /> Archives
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && filteredExams.length === 0 && (
                            <tr><td colSpan={5} className="py-20 text-center text-gray-400 font-medium">Aucun examen trouvé pour cette recherche.</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={5} className="py-20 text-center text-gray-400 animate-pulse font-medium">Chargement des données...</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                isOpen={confirmAction.open}
                title={confirmAction.type === 'stop' ? "Arrêt d'Urgence" : "Clôture d'Examen"}
                message={confirmAction.type === 'stop'
                    ? "Voulez-vous vraiment forcer l'arrêt de cet examen ? Les étudiants ne pourront plus soumettre de fichiers."
                    : "Attention : La clôture est irréversible. L'examen sera archivé et ne pourra plus être modifié."}
                type="danger"
                confirmText={confirmAction.type === 'stop' ? "Arrêter Immédiatement" : "Clôturer et Archiver"}
                onConfirm={executeAction}
                onCancel={() => setConfirmAction({ open: false, type: null, examId: null })}
            />
        </div>
    );
}
