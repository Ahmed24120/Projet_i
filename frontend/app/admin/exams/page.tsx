"use client";

import { useEffect, useState } from "react";
import { apiFetch, baseUrl } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StopCircle, Download } from "lucide-react";

export default function AdminExams() {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [stopId, setStopId] = useState<number | null>(null);

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch<any[]>("/exams", {}, token || undefined); // As Admin, this returns ALL exams
            setExams(res);
        } catch {
            toast("Erreur chargement examens");
        } finally {
            setLoading(false);
        }
    };

    const handleForceStop = async () => {
        if (!stopId) return;
        const token = localStorage.getItem("token");
        try {
            await apiFetch(`/exams/${stopId}/stop`, { method: "POST" }, token || undefined);
            toast("Examen arrêté de force");
            setStopId(null);
            fetchExams();
        } catch (e) {
            toast("Erreur arrêt examen");
        }
    };

    const handleExport = (e: any, examId: number) => {
        e.stopPropagation();
        e.preventDefault();
        const token = localStorage.getItem("token");
        toast("Préparation du téléchargement...");
        fetch(`${baseUrl}/exams/${examId}/export`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(await res.text());
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `examen_${examId}_export.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                toast("Téléchargement démarré ✅");
            })
            .catch(e => toast("Erreur téléchargement: " + e.message));
    };

    return (
        <div className="space-y-8 p-2">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-[100px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>

            <div>
                <h2 className="text-4xl font-black text-gray-800 tracking-tight leading-tight">Gestion des Examens</h2>
                <p className="text-gray-500 font-medium mt-1">Surveillez et gérez les sessions d'examens en temps réel.</p>
            </div>

            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Titre</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Professeur</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Salle</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Statut</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {exams.map((e, i) => (
                                <tr
                                    key={e.id}
                                    className="group hover:bg-indigo-50/30 transition-colors duration-200"
                                    style={{ animationDelay: `${i * 50}ms` }}
                                >
                                    <td className="px-8 py-4 font-bold text-gray-800">{e.titre}</td>
                                    <td className="px-8 py-4 text-gray-600 font-medium">{e.prof_name || <span className="text-gray-400 italic">N/A</span>}</td>
                                    <td className="px-8 py-4">
                                        <span className="bg-gray-100/80 border border-gray-200 px-3 py-1 rounded-lg text-xs font-mono font-bold text-gray-600">
                                            {e.room_number || '-'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className={`px-3 py-1.5 rounded-full text-xs uppercase font-bold tracking-wide shadow-sm inline-flex items-center gap-1.5 ${e.status === 'launched' ? 'bg-green-100 text-green-700 border border-green-200 animate-pulse' :
                                            e.status === 'finished' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                                                e.status === 'stopped' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                    'bg-blue-50 text-blue-600 border border-blue-100'
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${e.status === 'launched' ? 'bg-green-500' :
                                                e.status === 'finished' ? 'bg-gray-500' :
                                                    e.status === 'stopped' ? 'bg-red-500' :
                                                        'bg-blue-500'
                                                }`}></span>
                                            {e.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(e.status === 'launched' || e.status_code === 2) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 shadow-sm transition-all active:scale-95"
                                                onClick={() => setStopId(e.id)}
                                            >
                                                <StopCircle className="w-3 h-3 mr-1.5" /> Stop
                                            </Button>
                                        )}
                                        {(e.status === 'finished' || e.status === 'stopped' || e.status_code >= 3) && (
                                            <button
                                                onClick={(evt) => handleExport(evt, e.id)}
                                                className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100 transition-all active:scale-95"
                                                title="Télécharger l'archive"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {exams.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Download className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Aucun examen trouvé</h3>
                        <p className="text-gray-500">Les examens créés apparaîtront ici.</p>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!stopId}
                type="danger"
                title="Arrêt d'urgence"
                message="Voulez-vous forcer l'arrêt de cet examen ?"
                confirmText="Arrêter"
                cancelText="Annuler"
                onConfirm={handleForceStop}
                onCancel={() => setStopId(null)}
            />
        </div>
    );
}
