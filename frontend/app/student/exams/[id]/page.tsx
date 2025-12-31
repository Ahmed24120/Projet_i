"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { apiFetch, baseUrl } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
    const [isEnded, setIsEnded] = useState(false);
    const [isFinalized, setIsFinalized] = useState(false);
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

    async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!selectedFiles || selectedFiles.length === 0) {
            toast("⚠️ Veuillez d'abord sélectionner un fichier.");
            return;
        }

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
                (e.target as any).reset();
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

    if (!exam) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex flex-col font-sans overflow-hidden">
            {/* Premium Header */}
            <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 px-8 py-4 flex items-center justify-between border-b border-sky-200 shadow-lg">
                <div className="flex items-center gap-5">
                    <Link
                        href="/student/exams"
                        className="p-2.5 rounded-2xl bg-sky-100 text-sky-600 hover:bg-sky-200 transition-all shadow-sm"
                        title="Retour à la liste"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </Link>
                    <div className="h-12 w-12 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center text-2xl shadow-md text-white">🎓</div>
                    <div>
                        <h1 className="font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent text-xl tracking-tight">{exam.titre}</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Examen en cours</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="bg-gradient-to-br from-sky-600 to-blue-600 text-white px-6 py-2.5 rounded-2xl shadow-lg flex flex-col items-center min-w-[140px]">
                        <span className="text-[9px] font-black text-sky-200 uppercase tracking-[0.2em] mb-1">Temps restant</span>
                        <div className={`text-2xl font-mono font-black tracking-tighter tabular-nums ${isEnded ? 'text-red-300' :
                            timeLeftMs <= 60000 ? 'text-red-300 animate-pulse' :
                                timeLeftMs <= 300000 ? 'text-orange-300' :
                                    'text-white'
                            }`}>
                            {timeLeftStr}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={toggleFullScreen}
                            className={`hidden md:flex rounded-2xl font-bold border-2 transition-all shadow-sm ${isFullScreen ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-white border-sky-200 text-sky-600 hover:border-sky-400 hover:bg-sky-50'}`}
                        >
                            {isFullScreen ? 'Réduire' : 'Plein écran'}
                        </Button>

                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center gap-2 border-2 border-red-100 hover:border-red-600 shadow-sm text-sm"
                            title="Déconnexion"
                        >
                            Quitter
                        </button>
                    </div>
                </div>
            </header>

            <ConfirmModal
                isOpen={showLogoutConfirm}
                type="danger"
                title="Déconnexion"
                message="Êtes-vous sûr de vouloir quitter l'examen ?"
                confirmText="Oui, quitter"
                cancelText="Rester"
                onConfirm={() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    router.push("/student/login");
                }}
                onCancel={() => setShowLogoutConfirm(false)}
            />

            <ConfirmModal
                isOpen={showFinalizeConfirm}
                type="warning"
                title="Terminer l'examen"
                message="Êtes-vous sûr de vouloir terminer l'examen ? Vous ne pourrez plus modifier ou envoyer de nouveaux fichiers après cette étape."
                confirmText="Oui, terminer"
                cancelText="Annuler"
                onConfirm={finalizeExam}
                onCancel={() => setShowFinalizeConfirm(false)}
            />

            {/* Main Content Layout */}
            <main className="flex-1 p-6 md:p-8 grid grid-cols-12 gap-8 overflow-y-auto custom-scrollbar">

                {/* Column 1: Resources (Right/Side) */}
                <div className="col-span-12 lg:col-span-3 space-y-6 order-last lg:order-none">
                    <Card className="p-6 border-none bg-white shadow-xl rounded-[2rem] border border-sky-100">
                        <h3 className="text-sm font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-6 flex items-center justify-between">
                            <span className="flex items-center gap-3">
                                <span className="p-2 bg-sky-50 rounded-xl text-lg">📄</span>
                                Sujet d'examen
                            </span>
                        </h3>
                        {exam.sujet_path ? (
                            <div className="space-y-4">
                                <div className="bg-sky-50 p-5 rounded-2xl border-2 border-dashed border-sky-200 text-center group transition-all hover:border-sky-400">
                                    <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">📄</span>
                                    <p className="text-[11px] font-bold text-gray-600 uppercase tracking-tight truncate">Document principal</p>
                                </div>
                                <button
                                    disabled={isUploading}
                                    onClick={async () => {
                                        setIsUploading(true);
                                        try {
                                            const token = localStorage.getItem("token");
                                            const response = await fetch(`${baseUrl}/exams/${id}/download-subject`, {
                                                headers: { 'Authorization': `Bearer ${token}` }
                                            });
                                            if (!response.ok) throw new Error('Download failed');
                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `sujet_examen_${id}.pdf`;
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                        } catch (error) { toast("Erreur de téléchargement"); }
                                        finally { setIsUploading(false); }
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-2xl font-black text-sm hover:from-sky-600 hover:to-blue-600 shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {isUploading ? <LoadingSpinner size="sm" /> : <span>Télécharger le sujet 📥</span>}
                                </button>
                            </div>
                        ) : (
                            <p className="text-center py-6 text-gray-400 text-xs italic">Aucun sujet disponible</p>
                        )}
                    </Card>

                    <Card className="p-6 border-none bg-white shadow-xl rounded-[2rem] border border-sky-100">
                        <h3 className="text-sm font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-6 flex items-center justify-between">
                            <span className="flex items-center gap-3">
                                <span className="p-2 bg-amber-50 rounded-xl text-lg">📎</span>
                                Pièces jointes
                            </span>
                            <span className="bg-sky-100 text-sky-600 px-3 py-1 rounded-full text-[10px] font-black">
                                {resources.filter(r => r.kind === 'attachment').length}
                            </span>
                        </h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pl-2">
                            {resources.filter(r => r.kind === 'attachment').map((res, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-sky-50 rounded-2xl border border-sky-100 hover:border-sky-300 hover:bg-white transition-all group">
                                    <p className="text-[11px] font-bold text-gray-700 truncate flex-1">{res.file_name}</p>
                                    <a
                                        href={`${baseUrl}${res.url}`}
                                        download
                                        className="ml-2 p-2 text-sky-600 bg-white rounded-xl shadow-sm border border-sky-100 hover:scale-110 transition-transform"
                                    >
                                        📥
                                    </a>
                                </div>
                            ))}
                            {resources.filter(r => r.kind === 'attachment').length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    <p className="text-xs italic">Aucune pièce jointe</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Column 2: Main Submission Area (Center) */}
                <div className="col-span-12 lg:col-span-6 space-y-8">
                    <Card className={`p-10 bg-white border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] rounded-[3rem] text-center relative overflow-hidden transition-all duration-500 ${isFinalized ? 'opacity-70 grayscale' : ''}`}>
                        {isFinalized && (
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                <div className="bg-emerald-500 text-white px-8 py-3 rounded-2xl shadow-2xl font-black rotate-[-5deg] border-4 border-white">✨ Vos réponses ont été reçues ✨</div>
                            </div>
                        )}

                        <div className={`mb-8 h-24 w-24 mx-auto flex items-center justify-center rounded-[2.5rem] shadow-2xl transition-all duration-700 ${isFinalized ? 'bg-gray-200 text-gray-400' : 'bg-gradient-to-br from-sky-500 to-blue-600 text-white scale-110 shadow-sky-200'}`}>
                            <span className="text-4xl">{isFinalized ? '🔒' : '🚀'}</span>
                        </div>

                        <h2 className="text-3xl font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3 tracking-tight">Soumission finale</h2>
                        <p className="text-gray-600 mb-10 text-sm font-medium">Téléversez vos fichiers ici. Vous pouvez modifier et supprimer tant que vous n'avez pas cliqué sur "Terminer".</p>

                        <form onSubmit={handleUpload} className="w-full space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <label className="flex flex-col items-center justify-center w-full h-48 border-4 border-dashed border-sky-100 rounded-[2.5rem] cursor-pointer bg-sky-50/30 hover:bg-white hover:border-sky-400 hover:shadow-2xl hover:shadow-sky-50 transition-all group overflow-hidden">
                                    <div className="flex flex-col items-center justify-center text-sky-300 group-hover:text-sky-500 transition-colors">
                                        <span className="text-5xl mb-3 group-hover:scale-110 transition-transform">📄</span>
                                        <p className="text-xs font-black uppercase tracking-widest">Sélectionner fichiers</p>
                                    </div>
                                    <input type="file" className="hidden" multiple onChange={(e) => setSelectedFiles(e.target.files)} />
                                </label>

                                <label className="flex flex-col items-center justify-center w-full h-48 border-4 border-dashed border-purple-100 rounded-[2.5rem] cursor-pointer bg-purple-50/30 hover:bg-white hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-50 transition-all group overflow-hidden">
                                    <div className="flex flex-col items-center justify-center text-purple-300 group-hover:text-purple-500 transition-colors">
                                        <span className="text-5xl mb-3 group-hover:scale-110 transition-transform">📁</span>
                                        <p className="text-xs font-black uppercase tracking-widest">Sélectionner dossier</p>
                                    </div>
                                    <input type="file" className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} onChange={(e) => setSelectedFiles(e.target.files)} />
                                </label>
                            </div>

                            {selectedFiles && (
                                <div className="bg-sky-50/50 border-2 border-sky-100 p-4 rounded-2xl">
                                    <p className="text-sky-600 font-black text-xs">📎 {selectedFiles.length} fichier(s) sélectionné(s)</p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isEnded || isFinalized || isUploading}
                                className={`w-full py-6 text-xl font-black rounded-3xl shadow-2xl transition-all duration-300 ${isFinalized ? 'bg-gray-200' : isEnded ? 'bg-gray-400' : 'bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 hover:scale-[1.02] active:scale-95 shadow-sky-200'}`}
                            >
                                {isUploading ? <LoadingSpinner color="white" /> : isFinalized ? "Réception confirmée ✅" : isEnded ? "Hors délai" : "Confirmer l'envoi 📥"}
                            </Button>
                        </form>

                        {!isFinalized && submittedFiles.length > 0 && (
                            <button
                                onClick={() => setShowFinalizeConfirm(true)}
                                className="mt-8 w-full py-4 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm hover:from-sky-700 hover:to-blue-700 transition-all shadow-xl shadow-sky-200 flex items-center justify-center gap-3 group"
                            >
                                🏁 Terminer l'examen et envoyer la copie finale
                                <span className="group-hover:translate-x-2 transition-transform">➡️</span>
                            </button>
                        )}
                    </Card>

                    <div className="bg-amber-50 rounded-[2.5rem] p-6 border-b-4 border-amber-200 flex items-start gap-4">
                        <span className="text-3xl">💡</span>
                        <p className="text-xs text-amber-800 font-bold leading-relaxed">
                            Après avoir téléversé vos fichiers, vérifiez-les dans la liste latérale. Ne cliquez sur **"Terminer l'examen"** que lorsque vous êtes absolument certain de votre travail, car cela enverra votre copie définitive au professeur.
                        </p>
                    </div>
                </div>

                {/* Column 3: History & Alerts (Left/Side) */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <Card className="p-6 border-none bg-gradient-to-br from-sky-600 to-blue-600 shadow-2xl rounded-[2rem] text-white">
                        <h3 className="text-sm font-black text-sky-200 mb-6 flex justify-between items-center uppercase tracking-[0.2em]">
                            Fichiers envoyés 📁
                            <span className="bg-white/10 text-white px-2 py-0.5 rounded-lg text-[10px]">{submittedFiles.length}</span>
                        </h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pl-2 custom-scrollbar-dark">
                            {submittedFiles.map((f: any, i) => (
                                <div key={i} className="group p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">✔️</div>
                                            <span className="text-[11px] font-black truncate max-w-[120px]">{f.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] font-bold text-sky-200">
                                        <div className="flex gap-4">
                                            <span>⏲️ {f.time}</span>
                                            <span>📦 {f.size || 'N/A'}</span>
                                        </div>
                                        {!isFinalized && (
                                            <button
                                                onClick={() => cancelSubmission(f.id, i)}
                                                className="text-red-400 hover:text-white transition-colors"
                                            >
                                                Annuler 🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {submittedFiles.length === 0 && (
                                <div className="text-center py-12 text-sky-300">
                                    <span className="text-4xl block mb-2 opacity-20">📭</span>
                                    <p className="text-xs font-bold italic">Aucun fichier pour le moment</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="p-6 border-none bg-white shadow-xl rounded-[2rem] border border-sky-100">
                        <h3 className="text-sm font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-4 flex items-center gap-3">
                            <span className="p-2 bg-red-50 rounded-xl text-lg">⚠️</span>
                            Alertes importantes
                        </h3>
                        <ul className="space-y-3">
                            {[
                                "Assurez-vous d'avoir une connexion Internet stable.",
                                "Ne changez pas de navigateur ou de réseau.",
                                "La soumission finale s'envoie en un seul clic."
                            ].map((note, idx) => (
                                <li key={idx} className="text-[10px] font-bold text-gray-600 flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1 flex-shrink-0"></span>
                                    {note}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
}
