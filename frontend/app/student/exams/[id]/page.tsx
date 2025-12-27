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
    const [submittedFiles, setSubmittedFiles] = useState<{ name: string, time: string }[]>([]);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isEnded, setIsEnded] = useState(false);

    // Initialisation
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/student/login");
            return;
        }

        const user = JSON.parse(localStorage.getItem("user") || "{}");

        // Load Data
        apiFetch(`/exams/${id}`, {}, token).then((data) => setExam(data));
        apiFetch<any[]>(`/exams/${id}/resources`, {}, token).then(setResources);

        // Socket
        socket.emit("join-exam", {
            examId: id,
            studentId: user.id || user.matricule,
            matricule: user.matricule,
            role: 'student'
        });

        socket.on("exam-started", ({ endAt: endT }) => {
            setEndAt(endT);
            toast("🚀 الامتحان بدأ! بالتوفيق للجميع.");
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
            setTimeLeftStr("انتهى");
            setProgress(0);
            toast("⏱️ انتهى وقت الامتحان! سيتم إغلاق البوابة.");
        });

        socket.on("exam-stopped", () => {
            setIsEnded(true);
            setTimeLeftStr("توقف");
            toast("⏹️ تم إيقاف الامتحان من قبل الأستاذ.");
        });

        socket.on("exam-warning", () => {
            toast("⚠️ تنبيه: بقي 5 دقائق فقط!");
        });

        // Anti-Cheat Events
        const handleVisibilityChange = () => {
            if (document.hidden && !isUploading) reportCheat("TAB_SWITCH", "إخفاء المتصفح/تبديل التبويب");
        };
        const handleBlur = () => {
            if (!isUploading) reportCheat("FOCUS_LOST", "فقدان تركيز (نقر خارج النافذة)");
        };
        const preventEvents = (e: Event) => e.preventDefault();

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("contextmenu", preventEvents);
        document.addEventListener("copy", preventEvents);
        document.addEventListener("paste", preventEvents);

        return () => {
            socket.off("exam-started");
            socket.off("exam-ended");
            socket.off("exam-warning");
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("contextmenu", preventEvents);
            document.removeEventListener("copy", preventEvents);
            document.removeEventListener("paste", preventEvents);
        };
    }, [id, router, socket, isUploading]);

    // Removal of client-side timer interval as it is now server-controlled via exam-tick
    useEffect(() => {
        // Empty as ticks come from socket
    }, []);

    function reportCheat(type: string, details: string) {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        socket.emit("cheat-alert", {
            examId: id,
            studentId: user.matricule || user.id,
            type,
            details
        });
        toast(`⚠️ تحذير: تم تسجيل نشاط مشبوه (${details})`);
    }

    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => toast("الملء التلقائي غير مدعوم"));
        } else {
            document.exitFullscreen().then(() => setIsFullScreen(false));
        }
    }

    async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsUploading(true);
        const user = JSON.parse(localStorage.getItem("user") || "{}");

        // CRITICAL: Multer needs text fields BEFORE files to populate req.body in destination callback
        const formData = new FormData();
        formData.append("id_etud", user.id);
        formData.append("matricule", user.matricule || "N/A");
        formData.append("nom", user.name || user.email || "Unknown");
        formData.append("examId", id as string);

        // Add files from the form
        const form = e.currentTarget;
        const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput && fileInput.files) {
            for (let i = 0; i < fileInput.files.length; i++) {
                formData.append("files", fileInput.files[i]);
            }
        }

        try {
            const res = await fetch(`${baseUrl}/works/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                toast("✅ تم استلام إجابتك بنجاح!");

                // Ajouter à l'historique
                const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
                const fileName = fileInput?.files?.[0]?.name || "ملف";
                setSubmittedFiles(prev => [...prev, {
                    name: fileName,
                    time: new Date().toLocaleTimeString('ar-MA')
                }]);

                (e.target as any).reset();
            } else {
                toast("فشل الإرسال، حاول مجدداً");
            }
        } catch {
            toast("خطأ في الشبكة");
        } finally {
            setIsUploading(false);
        }
    }

    if (!exam) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

    return (
        <div dir="rtl" className="min-h-screen bg-gray-50 flex flex-col font-sans overflow-hidden">
            {/* Top Bar */}
            <header className="bg-white shadow-md z-20 px-6 py-4 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Link
                        href="/student/exams"
                        className="p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                        title="رجوع للقائمة"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </Link>
                    <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center text-xl">📝</div>
                    <div>
                        <h1 className="font-bold text-gray-900 text-lg">{exam.titre}</h1>
                        <p className="text-xs text-gray-500 max-w-md truncate">{exam.description || "امتحان نهائي"}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center min-w-[100px]">
                        <div className="text-xs text-gray-500 font-medium mb-1">الوقت المتبقي</div>
                        <div className={`text-2xl font-mono font-bold tracking-wider tabular-nums ${isEnded ? 'text-red-600' :
                            timeLeftMs <= 60000 ? 'text-red-500 animate-pulse' :
                                timeLeftMs <= 300000 ? 'text-orange-500' :
                                    'text-slate-900'
                            }`}>
                            {timeLeftStr}
                        </div>
                    </div>

                    <Button onClick={toggleFullScreen} className={`hidden md:flex ${isFullScreen ? 'bg-gray-100 text-gray-700' : 'bg-primary-50 text-primary-700'}`}>
                        {isFullScreen ? 'تصغير الشاشة' : '⛶ ملء الشاشة'}
                    </Button>

                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                    >
                        <span>خروج</span> 🚪
                    </button>
                </div>
            </header>

            <ConfirmModal
                isOpen={showLogoutConfirm}
                type="danger"
                title="تسجيل الخروج"
                message="هل أنت متأكد من رغبتك في الخروج من الامتحان؟"
                confirmText="نعم، خروج"
                cancelText="بقاء"
                onConfirm={() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    router.push("/student/login");
                }}
                onCancel={() => setShowLogoutConfirm(false)}
            />

            {/* Progress Bar (Sticky) */}
            <div className="h-1 w-full bg-gray-200">
                <div
                    className={`h-full transition-all duration-1000 ease-linear ${progress < 20 ? 'bg-red-500' : 'bg-primary-500'}`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Exam Resources Banner */}
            <div className="mx-4 md:mx-6 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Subject */}
                {exam.sujet_path && (
                    <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 border-none shadow-lg p-6 text-white relative overflow-hidden group lg:col-span-2">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
                            <span className="text-7xl">📄</span>
                        </div>
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="text-center sm:text-right">
                                <h2 className="text-2xl font-black mb-1 flex items-center gap-3">
                                    <span className="p-2 bg-white/20 rounded-xl text-xl">📥</span>
                                    موضوع الامتحان
                                </h2>
                                <p className="text-blue-100 text-sm">
                                    المستند الرئيسي لأسئلة الامتحان.
                                </p>
                            </div>
                            <button
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
                                    } catch (error) {
                                        toast("خطأ في تحميل الملف");
                                    } finally {
                                        setIsUploading(false);
                                    }
                                }}
                                className="px-6 py-3 bg-white text-blue-700 rounded-xl font-black text-sm hover:bg-blue-50 shadow-xl transition-all active:scale-95 whitespace-nowrap"
                            >
                                تحميل الموضوع
                            </button>
                        </div>
                    </Card>
                )}

                {/* Attachments List */}
                <Card className="bg-white border-2 border-slate-100 shadow-lg p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="text-lg">📎</span> المرفقات الإضافية
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-mono">
                            {resources.filter(r => r.kind === 'attachment').length}
                        </span>
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {resources.filter(r => r.kind === 'attachment').map((res, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-slate-700 truncate">{res.file_name}</p>
                                </div>
                                <a
                                    href={`${baseUrl}${res.url}`}
                                    download
                                    target="_blank"
                                    className="ml-2 p-1.5 text-indigo-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                    title="تحميل"
                                >
                                    📥
                                </a>
                            </div>
                        ))}
                        {resources.filter(r => r.kind === 'attachment').length === 0 && (
                            <div className="text-center py-6 text-slate-400">
                                <p className="text-xs italic">لا توجد مرفقات إضافية</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Main Content Area - Simplified and Centered */}
            <div className="flex-1 p-4 md:p-8 flex flex-col items-center gap-8 overflow-y-auto">
                <div className="w-full max-w-4xl space-y-8">



                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Right: Submission Area */}
                        <Card className="p-8 bg-white border-2 border-slate-100 shadow-xl rounded-3xl flex flex-col items-center text-center">
                            <div className="mb-6 h-20 w-20 bg-green-100 text-3xl flex items-center justify-center rounded-3xl animate-bounce">
                                📤
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">تسليم الإجابة</h2>
                            <p className="text-gray-500 mb-8 text-sm">
                                ارفع ملف الإجابة النهائي (PDF, ZIP, DOCX).<br /> يمكنك التعديل حتى انتهاء الوقت.
                            </p>

                            <form onSubmit={handleUpload} className="w-full space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex flex-col items-center justify-center w-full h-40 border-4 border-dashed border-slate-200 rounded-3xl cursor-pointer bg-slate-50 hover:bg-white hover:border-blue-500 transition-all group">
                                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-500">
                                            <span className="text-4xl mb-2">📄</span>
                                            <p className="text-sm font-bold">اختيار ملفات</p>
                                        </div>
                                        <input
                                            type="file"
                                            name="files"
                                            className="hidden"
                                            multiple
                                            onClick={() => setIsUploading(true)}
                                            onFocus={() => setIsUploading(true)}
                                            onChange={() => setIsUploading(false)}
                                        />
                                    </label>

                                    <label className="flex flex-col items-center justify-center w-full h-40 border-4 border-dashed border-slate-200 rounded-3xl cursor-pointer bg-slate-50 hover:bg-white hover:border-purple-500 transition-all group">
                                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-purple-500">
                                            <span className="text-4xl mb-2">📁</span>
                                            <p className="text-sm font-bold">اختيار مجلد</p>
                                        </div>
                                        <input
                                            type="file"
                                            name="files"
                                            className="hidden"
                                            {...({ webkitdirectory: "", directory: "" } as any)}
                                            onClick={() => setIsUploading(true)}
                                            onFocus={() => setIsUploading(true)}
                                            onChange={() => setIsUploading(false)}
                                        />
                                    </label>
                                </div>
                                <Button type="submit" disabled={isEnded} className={`w-full py-5 text-xl font-black rounded-2xl shadow-xl transition-all ${isEnded ? 'bg-gray-400 opacity-50' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 active:scale-95'}`}>
                                    {isEnded ? "انتهى الوقت" : "تأكيد الإرسال ✅"}
                                </Button>
                            </form>
                        </Card>

                        {/* Left: Instructions & History */}
                        <div className="space-y-6">
                            <Card className="p-6 bg-amber-50 border-none rounded-3xl">
                                <h3 className="text-amber-800 font-bold mb-3 flex items-center gap-2 text-lg">
                                    ⚠️ تنبيهات هامة
                                </h3>
                                <ul className="text-amber-700 text-sm space-y-2 list-disc list-inside font-medium pr-2">
                                    <li>يمنع منعاً باتاً تغيير نافذة المتصفح.</li>
                                    <li>سيتم تسجيل كل محاولة خروج كـ "محاولة غش".</li>
                                    <li>تأكد من الضغط على زر "تأكيد الإرسال" قبل انتهاء الوقت.</li>
                                </ul>
                            </Card>

                            <Card className="p-6 bg-slate-900 text-white border-none rounded-3xl shadow-xl">
                                <h3 className="text-slate-400 font-bold mb-4 uppercase tracking-widest text-xs flex justify-between items-center">
                                    وصل التسليمات 📋
                                    <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-[10px]">{submittedFiles.length} ملف</span>
                                </h3>
                                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                                    {submittedFiles.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700 animate-slide-in">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">✔️</span>
                                                <span className="text-sm font-medium truncate max-w-[120px]">{f.name}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono">{f.time}</span>
                                        </div>
                                    ))}
                                    {submittedFiles.length === 0 && (
                                        <p className="text-center py-4 text-slate-600 text-sm italic">لا توجد تسليمات حتى الآن</p>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
