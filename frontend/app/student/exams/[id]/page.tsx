"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { apiFetch, baseUrl } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
    Clock,
    FileText,
    Upload,
    FolderUp,
    LogOut,
    Maximize,
    Minimize,
    AlertTriangle,
    CheckCircle,
    Download,
    File as FileIcon,
    Send,
    Wifi,
    WifiOff
} from "lucide-react";

export default function ExamRoom() {
    const { id } = useParams();
    const router = useRouter();
    const socket = getSocket();
    const [exam, setExam] = useState<any>(null);
    const [resources, setResources] = useState<any[]>([]);
    const [timeLeftStr, setTimeLeftStr] = useState<string>("--:--");
    const [timeLeftMs, setTimeLeftMs] = useState<number>(Infinity);
    const [progress, setProgress] = useState(100);
    const [isUploading, setIsUploading] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [endAt, setEndAt] = useState<number | null>(null);
    const [durationSent, setDurationSent] = useState<number>(0);
    const [submittedFiles, setSubmittedFiles] = useState<{ id: string, name: string, time: string, size?: string }[]>([]);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showUploadConfirm, setShowUploadConfirm] = useState(false);
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [isEnded, setIsEnded] = useState(false);
    const [isFinalized, setIsFinalized] = useState(false);
    const [hasExited, setHasExited] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

    // Initialisation
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/student/login");
            return;
        }

        const user = JSON.parse(localStorage.getItem("user") || "{}");

        // Load Data
        apiFetch(`/exams/${id}`, {}, token).then((data: any) => {
            setExam(data);
            if (data.isFinalized) {
                setIsFinalized(true);
                setIsEnded(true);
            }
        });
        apiFetch<any[]>(`/exams/${id}/resources`, {}, token).then(setResources);

        // Socket
        socket.emit("join-exam", {
            examId: id,
            studentId: String(user.id || user.matricule),
            matricule: user.matricule,
            role: 'student'
        });

        socket.on("exam-started", ({ endAt: endT }) => {
            setEndAt(endT);
            toast("🚀 L'examen a commencé ! Bonne chance à tous.");
        });

        socket.on("exam-tick", (p: any) => {
            const ms = Math.max(p.timeLeft, 0);
            setTimeLeftMs(ms);
            const m = Math.floor(ms / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setTimeLeftStr(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);

            setEndAt(p.endAt);
            if (durationSent === 0) setDurationSent(p.timeLeft);
            if (p.timeLeft > 0) {
                setProgress((p.timeLeft / (durationSent || p.timeLeft)) * 100);
            }
        });

        socket.on("exam-ended", () => {
            setIsEnded(true);
            setTimeLeftStr("Terminé");
            setProgress(0);
            toast("⏱️ Temps écoulé ! L'examen est terminé.");
        });

        socket.on("exam-stopped", () => {
            setIsEnded(true);
            setTimeLeftStr("Arrêté");
            toast("⏹️ L'examen a été arrêté par le professeur.");
        });

        socket.on("exam-warning", () => {
            toast("⚠️ Attention : Il ne reste que 5 minutes !");
        });

        // Network status detection
        const handleOnline = () => {
            socket.emit("network-status", { studentId: user.matricule || user.id, online: true });
            toast("📡 Connexion Internet rétablie.");
        };
        const handleOffline = () => {
            socket.emit("network-status", { studentId: user.matricule || user.id, online: false });
            toast("⚠️ Connexion Internet perdue ! Vérifiez votre réseau.");
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        const preventEvents = (e: Event) => e.preventDefault();
        document.addEventListener("contextmenu", preventEvents);
        document.addEventListener("copy", preventEvents);
        document.addEventListener("paste", preventEvents);

        return () => {
            socket.off("exam-started");
            socket.off("exam-ended");
            socket.off("exam-warning");
            socket.off("exam-tick");
            socket.off("exam-stopped");
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            document.removeEventListener("contextmenu", preventEvents);
            document.removeEventListener("copy", preventEvents);
            document.removeEventListener("paste", preventEvents);
        };
    }, [id, router, socket, durationSent]);

    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => toast("Plein écran non supporté"));
        } else {
            document.exitFullscreen().then(() => setIsFullScreen(false));
        }
    }

    function handleUploadRequest(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedFiles || selectedFiles.length === 0) {
            toast("⚠️ Veuillez d'abord sélectionner un fichier.");
            return;
        }
        setShowUploadConfirm(true);
    }

    async function performUpload() {
        if (!selectedFiles || selectedFiles.length === 0) return;

        // Hide modal
        setShowUploadConfirm(false);
        setIsUploading(true);
        const user = JSON.parse(localStorage.getItem("user") || "{}");

        const formData = new FormData();
        formData.append("id_etud", user.id);
        formData.append("matricule", user.matricule || "N/A");
        formData.append("nom", user.name || user.email || "Unknown");
        formData.append("examId", id as string);

        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append("files", selectedFiles[i]);
        }

        try {
            const res = await fetch(`${baseUrl}/works/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                toast("✅ Votre réponse a été reçue avec succès !");

                const newSubmissions = data.files.map((f: any) => ({
                    id: data.workId,
                    name: f.name,
                    size: (f.size / 1024).toFixed(1) + " KB",
                    time: new Date().toLocaleTimeString('ar-MA'),
                }));

                setSubmittedFiles(prev => [...prev, ...newSubmissions]);
                setSelectedFiles(null);
                // Reset form manually if needed, but since we use controlled/file input usually resets on re-render if key changes or we leave it.
                // We'll rely on setSelectedFiles(null) to hide the UI state.
            } else {
                const err = await res.json();
                toast(`❌ ${err.error || "Échec de l'envoi"}`);
            }
        } catch {
            toast("Erreur réseau");
        } finally {
            setIsUploading(false);
        }
    }

    async function cancelSubmission(workId: any, index: number) {
        if (isFinalized) return;
        try {
            const res = await fetch(`${baseUrl}/works/${workId}?examId=${id}&studentId=${JSON.parse(localStorage.getItem("user") || "{}").id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) {
                // Emit socket event for real-time cancellation
                socket.emit("submission:cancelled", { examId: id, workId });

                setSubmittedFiles(prev => prev.filter((_, i) => i !== index));
                toast("🗑️ Soumission annulée avec succès.");
            }
        } catch (_) {
            toast("Erreur lors de la suppression");
        }
    }

    function finalizeExam() {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        socket.emit("finalize-exam", { examId: id, studentId: user.id || user.matricule });
        setIsFinalized(true);
        setIsEnded(true);
        setShowFinalizeConfirm(false);
        toast("📊 Examen terminé et réponses validées.");
    }

    if (!exam) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner size="lg" /></div>;

    const getStatusColor = () => {
        if (isFinalized) return "bg-green-100 text-green-700 border-green-200";
        if (isEnded) return "bg-red-100 text-red-700 border-red-200";
        return "bg-green-100 text-green-700 border-green-200"; // En cours
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* 1. Header SaaS Style */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm transition-all">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">{exam.titre}</h1>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border w-fit mt-1 flex items-center gap-1.5 ${getStatusColor()}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                            {isFinalized ? "Finalisé" : isEnded ? "Terminé" : "Examen en cours"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Timer */}
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-colors ${timeLeftMs < 60000 ? 'bg-red-50 text-red-600 border border-red-100' :
                        'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                        <Clock className="w-5 h-5" />
                        <span className="text-2xl font-mono font-bold tracking-tight translate-y-[1px]">{timeLeftStr}</span>
                    </div>

                    <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleFullScreen}
                            className="hidden md:flex gap-2 text-gray-600 border-gray-200 hover:bg-gray-50"
                        >
                            {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                            {isFullScreen ? 'Réduire' : 'Plein écran'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowLogoutConfirm(true)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Quitter</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Modals */}
            <ConfirmModal
                isOpen={showLogoutConfirm}
                type="danger"
                title="Quitter l'examen ?"
                message="Êtes-vous sûr de vouloir quitter ? Le temps continuera de s'écouler."
                confirmText="Oui, déconnecter"
                cancelText="Annuler"
                onConfirm={() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    router.push("/student/login");
                }}
                onCancel={() => setShowLogoutConfirm(false)}
            />

            <ConfirmModal
                isOpen={showUploadConfirm}
                type="info"
                title="Confirmer l'envoi"
                message={`Vous êtes sur le point d'envoyer ${selectedFiles?.length || 0} fichier(s). Voulez-vous continuer ?`}
                confirmText="Oui, envoyer"
                cancelText="Annuler"
                onConfirm={performUpload}
                onCancel={() => setShowUploadConfirm(false)}
            />

            <ConfirmModal
                isOpen={showFinalizeConfirm}
                type="warning"
                title="Confirmer l'envoi final"
                message="Vous ne pourrez plus modifier vos réponses après cette action. Êtes-vous sûr ?"
                confirmText="Oui, terminer"
                cancelText="Retour"
                onConfirm={finalizeExam}
                onCancel={() => setShowFinalizeConfirm(false)}
            />

            {/* 2. Main Content Grid */}
            <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                    {/* COL 1: Sujet & Ressources (3 cols) */}
                    <div className="lg:col-span-3 space-y-6 flex flex-col">
                        <Card className="p-0 overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    Sujet
                                </h3>
                            </div>
                            <div className="p-6 text-center space-y-4">
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Téléchargez le sujet officiel de l'examen pour commencer.
                                </p>
                                <Button
                                    onClick={async () => {
                                        setIsUploading(true);
                                        try {
                                            const token = localStorage.getItem("token");
                                            const response = await fetch(`${baseUrl}/exams/${id}/download-subject`, {
                                                headers: { 'Authorization': `Bearer ${token}` }
                                            });
                                            if (!response.ok) throw new Error('Failed');
                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `sujet_examen_${id}.pdf`;
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                        } catch { toast("Erreur de téléchargement"); }
                                        finally { setIsUploading(false); }
                                    }}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 shadow-lg"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Télécharger PDF
                                </Button>
                            </div>
                        </Card>

                        <Card className="p-0 overflow-hidden border border-gray-100 shadow-sm flex-1">
                            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    <FolderUp className="w-4 h-4 text-gray-500" />
                                    Pièces jointes
                                </h3>
                                <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {resources.filter(r => r.kind === 'attachment').length}
                                </span>
                            </div>
                            <div className="p-2 space-y-1">
                                {resources.filter(r => r.kind === 'attachment').map((res, i) => (
                                    <a
                                        key={i}
                                        href={`${baseUrl}${res.url}`}
                                        download
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                            <FileIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate">{res.file_name}</p>
                                            <p className="text-[10px] text-gray-400">Document annexe</p>
                                        </div>
                                        <Download className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                    </a>
                                ))}
                                {resources.filter(r => r.kind === 'attachment').length === 0 && (
                                    <div className="p-8 text-center text-gray-400 text-sm italic">
                                        Aucune pièce jointe
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* COL 2: Submission Center (6 cols) */}
                    <div className="lg:col-span-6 flex flex-col">
                        <Card className={`flex-1 p-0 overflow-hidden border-none shadow-xl bg-white rounded-2xl relative transition-all duration-300 ring-1 ring-gray-100 ${isFinalized ? 'opacity-80 grayscale-[0.5]' : ''}`}>
                            {isFinalized && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center p-6">
                                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-sm animate-bounce">
                                        <CheckCircle className="w-10 h-10" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Examen terminé !</h2>
                                    <p className="text-gray-500 max-w-md">Vos fichiers ont été transmis avec succès. Vous pouvez maintenant quitter cette page en toute sécurité.</p>
                                </div>
                            )}

                            <div className="p-8 pb-0 text-center">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Soumission du travail</h2>
                                <p className="text-gray-500 text-sm max-w-lg mx-auto">
                                    Déposez vos fichiers un par un ou par dossier complet.
                                    Vous pouvez modifier votre envoi jusqu'à la confirmation finale.
                                </p>
                            </div>

                            <form onSubmit={handleUploadRequest} className="p-8 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Upload File */}
                                    <label className="relative group cursor-pointer">
                                        <input type="file" className="hidden" multiple onChange={(e) => setSelectedFiles(e.target.files)} />
                                        <div className="h-40 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-3 group-hover:scale-[1.02] duration-200">
                                            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-500 mb-1">
                                                <Upload className="w-6 h-6" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-gray-700 group-hover:text-blue-700">Ajouter des fichiers</p>
                                                <p className="text-xs text-gray-400 mt-1">Tous formats acceptés</p>
                                            </div>
                                        </div>
                                    </label>

                                    {/* Upload Folder */}
                                    <label className="relative group cursor-pointer">
                                        <input type="file" className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} onChange={(e) => setSelectedFiles(e.target.files)} />
                                        <div className="h-40 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all flex flex-col items-center justify-center gap-3 group-hover:scale-[1.02] duration-200">
                                            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-500 mb-1">
                                                <FolderUp className="w-6 h-6" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-gray-700 group-hover:text-indigo-700">Dossier complet</p>
                                                <p className="text-xs text-gray-400 mt-1">Projets, code source...</p>
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Selection Status */}
                                <div className={`transition-all duration-300 overflow-hidden ${selectedFiles ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                <span className="font-bold text-xs">{selectedFiles?.length}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Fichiers prêts à l'envoi</p>
                                                <p className="text-[10px] text-gray-500">En attente de confirmation</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-blue-600 animate-pulse">Prêt</span>
                                    </div>
                                </div>

                                {/* Main Action Button */}
                                <Button
                                    type="submit"
                                    disabled={!selectedFiles || isEnded || isFinalized || isUploading}
                                    className={`w-full py-6 text-base font-bold rounded-xl transition-all shadow-lg ${isUploading ? 'bg-gray-100 text-gray-400 cursor-wait' :
                                        !selectedFiles ? 'bg-gray-100 text-gray-400' :
                                            'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5'
                                        }`}
                                >
                                    {isUploading ? <LoadingSpinner size="sm" /> :
                                        !selectedFiles ? "Sélectionnez un fichier pour activer" :
                                            <span className="flex items-center gap-2">Confirmer l'envoi <Send className="w-4 h-4" /></span>
                                    }
                                </Button>
                            </form>

                            {/* Finalize Section */}
                            {!isFinalized && submittedFiles.length > 0 && (
                                <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
                                    <p className="text-xs text-gray-500 mb-4 px-8">
                                        Si vous avez envoyé tous vos fichiers, cliquez ci-dessous pour valider définitivement votre examen.
                                    </p>
                                    <Button
                                        onClick={() => setShowFinalizeConfirm(true)}
                                        variant="outline"
                                        className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 hover:text-green-800 transition-colors"
                                    >
                                        Terminer l'examen
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* COL 3: History & Alerts (3 cols) */}
                    <div className="lg:col-span-3 space-y-6 flex flex-col">

                        {/* Sent Files */}
                        <Card className="p-0 overflow-hidden border border-gray-100 shadow-sm flex-1 max-h-[500px] flex flex-col">
                            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    Fichiers envoyés
                                </h3>
                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {submittedFiles.length}
                                </span>
                            </div>
                            <div className="p-2 space-y-2 overflow-y-auto custom-scrollbar flex-1">
                                {submittedFiles.map((f: any, i) => (
                                    <div key={i} className="group p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-100 hover:shadow-sm transition-all">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <FileIcon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate" title={f.name}>{f.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{f.size || 'N/A'}</span>
                                                    <span className="text-[10px] text-gray-400">{f.time}</span>
                                                </div>
                                            </div>
                                            {!isFinalized && (
                                                <button
                                                    onClick={() => cancelSubmission(f.id, i)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Supprimer"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {submittedFiles.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-center p-4">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                            <Upload className="w-5 h-5 opacity-50" />
                                        </div>
                                        <p className="text-sm font-medium">Aucun fichier envoyé</p>
                                        <p className="text-xs mt-1 opacity-70">Vos uploads apparaîtront ici</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Alerts */}
                        <Card className="p-0 overflow-hidden border border-red-100 shadow-sm bg-red-50/30">
                            <div className="p-4 border-b border-red-100/50 flex items-center gap-2 text-red-800">
                                <AlertTriangle className="w-4 h-4" />
                                <h3 className="font-bold text-sm">Important</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex gap-3 text-xs text-gray-600">
                                    <Wifi className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <p>Assurez-vous d'avoir une connexion stable.</p>
                                </div>
                                <div className="flex gap-3 text-xs text-gray-600">
                                    <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                                    <p>Ne fermez pas cette page avant la fin.</p>
                                </div>
                                <div className="flex gap-3 text-xs text-gray-600">
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    <p>La confirmation finale est irréversible.</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
}
