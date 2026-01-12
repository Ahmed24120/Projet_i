"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
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

    const handleExport = async (e: any, examId: string) => {
        e.stopPropagation();
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`http://localhost:3000/api/exams/${examId}/export`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erreur export");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `archive_exam_${examId}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast("Export téléchargé");
        } catch {
            toast("Erreur téléchargement");
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Gestion des Examens</h2>

            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Titre</th>
                            <th className="px-6 py-3">Professeur</th>
                            <th className="px-6 py-3">Salle</th>
                            <th className="px-6 py-3">Statut</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {exams.map(e => (
                            <tr key={e.id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-3 font-medium text-gray-900">{e.titre}</td>
                                <td className="px-6 py-3 text-gray-500">{e.prof_name || "N/A"}</td>
                                <td className="px-6 py-3 font-mono text-xs">{e.room_number || '-'}</td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${e.status === 'launched' ? 'bg-green-100 text-green-700 animate-pulse' :
                                        e.status === 'finished' ? 'bg-gray-100 text-gray-600' :
                                            e.status === 'stopped' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-50 text-blue-600'
                                        }`}>
                                        {e.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-right flex justify-end gap-2">
                                    {(e.status === 'launched' || e.status_code === 2) && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                            onClick={() => setStopId(e.id)}
                                        >
                                            <StopCircle className="w-3 h-3 mr-1" /> Stop
                                        </Button>
                                    )}
                                    {(e.status === 'finished' || e.status === 'stopped' || e.status_code >= 3) && (
                                        <button onClick={(evt) => handleExport(evt, e.id)} className="p-1 hover:bg-gray-100 rounded text-blue-600" title="Télécharger">
                                            <Download className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {exams.length === 0 && <div className="p-8 text-center text-gray-400">Aucun examen trouvé</div>}
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
