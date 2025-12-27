"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type StudentState = {
    studentId: string;
    matricule?: string;
    nom?: string;
    role?: string;
    status: "online" | "offline";
    lastSeen?: number;
    warnings: string[];
    submittedFiles: string[];
};

export default function ProfessorMonitor() {
    const { id } = useParams();
    const router = useRouter();
    const socket = useMemo(() => getSocket(), []);
    const [students, setStudents] = useState<Record<string, StudentState>>({});
    const [logs, setLogs] = useState<{ id?: number, msg: string, type: string, time: string, matricule?: string }[]>([]);
    const [examTitle, setExamTitle] = useState("");
    const [timerStr, setTimerStr] = useState("--:--");
    const [timeLeftMs, setTimeLeftMs] = useState<number>(Infinity);
    const [isEnded, setIsEnded] = useState(false);
    const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            apiFetch(`/exams/${id}`, {}, token).then((d: any) => setExamTitle(d.titre)).catch(() => { });
            loadLogs();
        }

        async function loadLogs() {
            try {
                const data = await apiFetch<any[]>(`/exams/${id}/logs`, {}, token || undefined);
                if (data) {
                    setLogs(data.map(l => ({
                        id: l.id,
                        msg: l.action,
                        type: l.type,
                        time: new Date(l.timestamp).toLocaleTimeString(),
                        matricule: l.matricule
                    })));
                }
            } catch (e) { }
        }

        socket.emit("join-exam", { examId: id, role: "professor" });

        socket.on("student-connected", (p) => {
            if (p.role === "professor") return;
            updateStudent(p.studentId, { status: "online", matricule: p.matricule, lastSeen: p.at });
            addLog(`دخول الطالب: ${p.matricule || p.studentId}`, 'success');
        });

        socket.on("student-disconnected", (p) => {
            updateStudent(p.studentId, { status: "offline", lastSeen: p.at });
            addLog(`خروج الطالب: ${p.studentId}`, 'warn');
        });

        socket.on("student-offline", (p) => updateStudent(p.studentId, { status: "offline", lastSeen: p.at }));

        socket.on("cheat-alert", (p) => {
            let detailsAR = translateCheat(p.type, p.details);
            updateStudent(p.studentId, (prev) => ({
                warnings: [...(prev.warnings || []), `${detailsAR} (${new Date(p.at).toLocaleTimeString()})`]
            }));
            toast(`⚠️ غش محتمل: ${p.studentId}`);
            addLog(`استشعار غش: ${p.studentId} - ${detailsAR}`, 'warn');
        });

        socket.on("submission-upserted", (p) => {
            updateStudent(p.studentId, (prev) => ({
                submittedFiles: [...(prev.submittedFiles || []), p.fileName]
            }));
            toast(`تم استلام ملف من ${p.studentId}`);
            addLog(`تم استلام ملف: ${p.fileName} (من ${p.studentId})`, 'info');
        });

        socket.on("exam-tick", (p: any) => {
            const ms = Math.max(p.timeLeft, 0);
            setTimeLeftMs(ms);
            const m = Math.floor(ms / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setTimerStr(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
        });

        socket.on("exam-ended", () => {
            setIsEnded(true);
            setTimerStr("انتهى");
            addLog("انتهى وقت الامتحان", 'warn');
        });

        socket.on("exam-stopped", () => {
            setIsEnded(true);
            setTimerStr("توقف");
        });

        return () => {
            socket.off("student-connected");
            socket.off("student-disconnected");
            socket.off("student-offline");
            socket.off("cheat-alert");
            socket.off("submission-upserted");
            socket.off("exam-tick");
            socket.off("exam-ended");
            socket.off("exam-stopped");
        };
    }, [id, socket]);

    function translateCheat(type: string, details: string) {
        if (type === "TAB_SWITCH") return "تبديل نافذة";
        if (type === "FOCUS_LOST") return "فقدان تركيز";
        if (type === "COPY_PASTE_ATTEMPT") return "محاولة نسخ";
        if (type === "DEV_TOOLS_ATTEMPT") return "أدوات مطور";
        return details;
    }

    function updateStudent(studentId: string, changes: Partial<StudentState> | ((prev: StudentState) => Partial<StudentState>)) {
        setStudents((prev) => {
            const current = prev[studentId] || { studentId, status: "offline", warnings: [], submittedFiles: [] };
            const newVals = typeof changes === 'function' ? changes(current) : changes;
            return { ...prev, [studentId]: { ...current, ...newVals } };
        });
    }

    function addLog(msg: string, type: string = 'info') {
        setLogs((prev) => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
    }

    async function clearLogs() {
        setShowClearLogsConfirm(true);
    }

    async function handleClearLogsConfirmed() {
        setShowClearLogsConfirm(false);
        try {
            await apiFetch(`/exams/${id}/logs/clear`, { method: "POST" });
            setLogs([]);
            // Plus optionnel: réinitialiser les warnings visuels des étudiants
            setStudents(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(k => { next[k].warnings = []; });
                return next;
            });
            toast("✅ تم مسح السجل");
        } catch (e) {
            toast("❌ فشل مسح السجل");
        }
    }

    const studentList = Object.values(students);
    const onlineCount = studentList.filter(s => s.status === "online").length;

    return (
        <div dir="rtl" className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white shadow-sm z-30 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/professor/dashboard"
                        className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        title="Retour"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </Link>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        🛡️ مراقبة مباشرة <span className="text-gray-300">|</span> <span className="text-primary-600">{examTitle || `Examen #${id}`}</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <Link href={`/professor/exams/${id}/submissions`} className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-all border border-indigo-100">
                        📂 استعراض الملفات
                    </Link>
                    <div className="h-10 w-px bg-gray-200 mx-2 hidden md:block"></div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">الوقت المتبقي</span>
                            <span className={`text-2xl font-mono font-bold ${isEnded ? 'text-red-500' :
                                timeLeftMs <= 60000 ? 'text-red-600 animate-pulse' :
                                    timeLeftMs <= 300000 ? 'text-orange-500' :
                                        'text-primary-600'}`}>
                                {timerStr}
                            </span>
                        </div>

                        <div className="h-10 w-px bg-gray-200" />

                        <div className="flex gap-3">
                            <div className="flex flex-col items-center px-4 py-1 bg-green-50 rounded-lg border border-green-100">
                                <span className="text-xs text-green-600 font-bold uppercase">متصل</span>
                                <span className="text-xl font-bold text-green-700 leading-none">{onlineCount}</span>
                            </div>
                            <div className="flex flex-col items-center px-4 py-1 bg-slate-100 rounded-lg border border-slate-200">
                                <span className="text-xs text-slate-500 font-bold uppercase">كلي</span>
                                <span className="text-xl font-bold text-slate-700 leading-none">{studentList.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <ConfirmModal
                isOpen={showClearLogsConfirm}
                type="warning"
                title="مسح سجل الأحداث"
                message="هل أنت متأكد من رغبتك في مسح كافة التنبيهات؟ لا يمكن التراجع عن هذا الإجراء."
                confirmText="نعم، امسح الكل"
                cancelText="تراجع"
                onConfirm={handleClearLogsConfirmed}
                onCancel={() => setShowClearLogsConfirm(false)}
            />

            <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
                {/* Main Grid */}
                <div className="lg:col-span-3 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {studentList.map(s => {
                            const isOnline = s.status === 'online';
                            const hasWarnings = s.warnings.length > 0;
                            const hasSubmitted = s.submittedFiles.length > 0;

                            return (
                                <Card key={s.studentId} className={`student-card relative overflow-hidden transition-all duration-300 border-2 ${hasWarnings ? 'cheating border-red-400 shadow-red-100' : isOnline ? 'connected border-green-400 shadow-green-50' : 'disconnected border-gray-200 opacity-70'}`}>
                                    {hasWarnings && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500 animate-pulse"></div>}

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner ${hasWarnings ? 'bg-red-600' : isOnline ? 'bg-emerald-600' : 'bg-slate-400'}`}>
                                                {s.matricule ? s.matricule.slice(-2) : '??'}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 leading-tight">{s.matricule || "مجهول"}</h3>
                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{String(s.studentId).slice(0, 8)}</p>
                                            </div>
                                        </div>
                                        <Badge variant={isOnline ? 'success' : 'default'} animate={isOnline && !hasWarnings} className="text-[10px]">
                                            {isOnline ? 'متصل' : 'غائب'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        {hasWarnings ? (
                                            <div className="bg-red-50 p-2 rounded text-red-700 text-xs font-bold flex items-center gap-2 border border-red-100">
                                                ⚠️ {s.warnings.length} مخالفات
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2 border border-emerald-100 opacity-70">
                                                ✅ سجل نظيف
                                            </div>
                                        )}

                                        {hasSubmitted ? (
                                            <div className="bg-blue-50 p-2 rounded text-blue-700 text-xs font-bold flex items-center gap-2 border border-blue-100">
                                                📎 {s.submittedFiles.length} ملفات
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 p-2 rounded text-gray-400 text-xs flex items-center gap-2 border border-gray-100">
                                                ⏳ لم يسلم بعد
                                            </div>
                                        )}
                                    </div>

                                    {hasWarnings && (
                                        <div className="mt-2 pt-2 border-t border-red-100 text-[10px] text-red-500 truncate">
                                            آخر: {s.warnings[s.warnings.length - 1].split('(')[0]}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}

                        {studentList.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-3xl bg-white/50">
                                <LoadingSpinner size="lg" className="mb-4 opacity-20" />
                                <p className="text-lg font-medium">بانتظار انضمام الطلاب...</p>
                                <p className="text-sm">سيظهرون هنا تلقائياً عند الدخول.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl shadow-sm h-[calc(100vh-140px)] flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 text-sm">سجل الأحداث</h3>
                        <button
                            onClick={clearLogs}
                            className="text-[10px] bg-white px-2 py-1 rounded border border-gray-200 text-red-500 hover:bg-red-50 font-bold transition-colors"
                        >
                            🗑️ تفريغ
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {logs.map((l, i) => (
                            <div key={i} className={`p-3 rounded-xl text-xs border-r-4 animate-fade-in ${l.type === 'warn' ? 'bg-red-50 border-red-500 text-red-800' :
                                l.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
                                    'bg-slate-50 border-slate-400 text-slate-700'
                                }`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-mono text-[9px] opacity-60">{l.time}</span>
                                    {l.type === 'warn' && <span className="bg-red-100 text-red-600 px-1 rounded font-black">!</span>}
                                </div>
                                <div className="font-bold leading-tight">{l.msg}</div>
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                                <span className="text-4xl mb-2">📭</span>
                                <p className="text-xs">لا يوجد نشاط بعد</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
