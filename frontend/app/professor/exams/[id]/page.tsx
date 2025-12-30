"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { apiFetch, baseUrl } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type SubmittedFile = {
    name: string;
    url: string;
    exists?: boolean;
};

type StudentState = {
    studentId: string;
    matricule?: string;
    nom?: string;
    role?: string;
    status: "online" | "offline" | "no-wifi";
    lastSeen?: number;
    warnings: string[];
    submittedFiles: SubmittedFile[];
    isFinalized?: boolean;
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
    const [selectedStudentForFiles, setSelectedStudentForFiles] = useState<StudentState | null>(null);
    const [previewFile, setPreviewFile] = useState<SubmittedFile | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            apiFetch(`/exams/${id}`, {}, token).then((d: any) => setExamTitle(d.titre)).catch(() => { });
        }

        async function loadLogs() {
            try {
                const data = await apiFetch<any[]>(`/exams/${id}/logs`, {}, token || undefined);
                if (data) {
                    setLogs(data.map(l => ({
                        id: l.id,
                        msg: l.action,
                        type: l.type,
                        time: new Date(l.timestamp).toLocaleTimeString('ar-MA'),
                        matricule: l.matricule
                    })));
                }
            } catch (e) { }
        }

        loadLogs();
        socket.emit("professor-join");
        socket.emit("join-exam", { examId: id, role: "professor" });

        socket.on("update-student-list", (list: any[]) => {
            const examStudents = list.filter(s => String(s.examId) === String(id));
            setStudents(prev => {
                const newMap: Record<string, StudentState> = {};
                examStudents.forEach(s => {
                    // Preserve existing files if we already know them
                    const existing = prev[s.studentId];
                    newMap[s.studentId] = {
                        studentId: s.studentId,
                        matricule: s.matricule,
                        nom: s.name,
                        status: s.status as any,
                        lastSeen: s.lastSeen,
                        warnings: s.history?.filter((h: any) => h.type === 'FRAUDE').map((h: any) => h.message) || [],
                        submittedFiles: existing ? existing.submittedFiles : []
                    };
                });
                return newMap;
            });
        });

        socket.on("alert", (p: any) => {
            if (p.type === 'WIFI_OFF' || p.type === 'NETWORK_CHANGE' || p.type === 'CHEAT_ATTEMPT') {
                toast(`${p.level === 'danger' ? '🚨' : '⚠️'} ${p.message}`);
                addLog(p.message, p.level === 'danger' ? 'warn' : 'info');
            }
        });

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

        // Initialize submission status from DB
        apiFetch(`/exams/${id}/submissions`).then((data: any) => {
            if (Array.isArray(data)) {
                // Map matricule -> files array
                const submittedByMatricule = new Map<string, { files: SubmittedFile[], isFinalized: boolean }>();
                data.forEach(sub => {
                    // Backend returns { matricule, isFinalized, files: [...] }
                    const newFiles = (sub.files || []).map((f: any) => ({
                        name: f.name,
                        url: f.url,
                        exists: f.exists
                    }));

                    const existing = submittedByMatricule.get(sub.matricule);
                    const allFiles = existing ? [...existing.files, ...newFiles] : newFiles;

                    submittedByMatricule.set(sub.matricule, {
                        files: allFiles,
                        isFinalized: !!sub.isFinalized
                    });
                });

                // Update students
                setStudents(prev => {
                    const next = { ...prev };
                    let changed = false;
                    Object.values(next).forEach(s => {
                        if (s.matricule && submittedByMatricule.has(s.matricule)) {
                            const data = submittedByMatricule.get(s.matricule)!;

                            if (data.files.length !== s.submittedFiles.length || s.isFinalized !== data.isFinalized) {
                                s.submittedFiles = data.files;
                                s.isFinalized = data.isFinalized;
                                changed = true;
                            }
                        }
                    });
                    return changed ? next : prev;
                });
            }
        }).catch(() => { });

        // Add handler for real-time finalization
        socket.on("finalize-exam", (p: any) => {
            // p = { examId, studentId, ... }
            const sid = String(p.studentId);
            updateStudent(sid, { isFinalized: true });
            toast(`🎓 الطالب ${sid} أنهى الامتحان`);
            addLog(`أنهى الامتحان: ${sid}`, 'info');
        });

        socket.on("file-submitted", (p) => {
            // p contains: { workId, examId, studentId, files: [{ name, filename, path }], at }
            // API upload returns 'filename' (disk name) and 'name' (original).
            // We need to construct URL. URL pattern: /static/exams/{examId}/students/{matricule}/{filename}

            // We need the student's matricule to build the URL or find the student to update.
            // p.studentId is the DB ID (or socket ID? backend says studentId: id_etud which is DB ID usually).
            // Wait, previous code treated p.studentId as the key in 'students' map.
            // 'students' map keys come from 'studentsPresence' in backend which keys by socket.id usually?
            // backend/sockets/index.js: studentsPresence.set(socket.id, { ... studentId: user.id ... })
            // So students map is keyed by studentId (DB ID).

            const sid = String(p.studentId);

            setStudents(prev => {
                const s = prev[sid];
                if (!s) return prev; // Student not found in list (weird)

                const newFiles: SubmittedFile[] = (p.files || []).map((f: any) => ({
                    name: f.name,
                    url: `/static/exams/${id}/students/${s.matricule}/${f.filename}`,
                    exists: true
                }));

                // Avoid duplicates by checking URL or name
                const combined = [...s.submittedFiles];
                newFiles.forEach(nf => {
                    if (!combined.find(cf => cf.url === nf.url)) {
                        combined.push(nf);
                    }
                });

                return {
                    ...prev,
                    [sid]: { ...s, submittedFiles: combined }
                };
            });

            const fileName = p.files && p.files.length > 0 ? p.files[0].name : "ملف";
            toast(`📥 استلام ملف جديد من ${p.studentId}`);
            addLog(`تم استلام ملف: ${fileName} (من ${p.studentId})`, 'info');
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
            socket.off("update-student-list");
            socket.off("alert");
            socket.off("student-connected");
            socket.off("student-disconnected");
            socket.off("student-offline");
            socket.off("cheat-alert");
            socket.off("file-submitted");
            socket.off("exam-tick");
            socket.off("exam-ended");
            socket.off("exam-stopped");
        };
    }, [id, socket]);

    // ... (helper functions) ...

    function translateCheat(type: string, details: string) {
        if (type === "TAB_SWITCH") return "تبديل نافذة";
        if (type === "FOCUS_LOST") return "فقدان تركيز";
        if (type === "COPY_PASTE_ATTEMPT") return "محاولة نسخ";
        if (type === "DEV_TOOLS_ATTEMPT") return "أدوات مطور";
        return details;
    }

    function updateStudent(studentId: string, changes: Partial<StudentState> | ((prev: StudentState) => Partial<StudentState>)) {
        setStudents((prev) => {
            // Ensure submittedFiles is initialized as empty array if missing
            const current = prev[studentId] || { studentId, status: "offline", warnings: [], submittedFiles: [] };
            // @ts-ignore - Partial<StudentState> complexity with new type
            const newVals = typeof changes === 'function' ? changes(current) : changes;
            return { ...prev, [studentId]: { ...current, ...newVals } };
        });
    }

    function addLog(msg: string, type: string = 'info') {
        setLogs((prev) => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
    }

    // ... (render) ...

    const onlineCount = Object.values(students).filter(s => s.status === 'online').length;

    return (
        <div dir="rtl" className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link
                        href="/professor/dashboard"
                        className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        title="رجوع"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </Link>
                    <div className="bg-indigo-600 text-white p-2 rounded-xl">
                        <span className="text-2xl font-bold">🎓</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">{examTitle || 'مراقبة الامتحان'}</h1>
                        <p className="text-xs text-slate-500 font-medium">لوحة التحكم المباشرة</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className={`px-4 py-2 rounded-xl font-mono text-xl font-bold tracking-widest ${isEnded ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                        {timerStr}
                    </div>
                    <Badge variant={isEnded ? 'danger' : 'success'}>{isEnded ? 'منتهي' : 'جاري'}</Badge>
                </div>
            </header>

            <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Visual Grid of Students */}
                <div className="lg:col-span-3 space-y-6">
                    <Card>
                        <div className="mb-4 pb-2 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">الممتحنين ({onlineCount}/{Object.keys(students).length})</h3>
                        </div>
                        {Object.keys(students).length === 0 ? (
                            <div className="text-center py-20 opacity-50">
                                <span className="text-6xl mb-4 block">👥</span>
                                <p>بانتظار التحاق الطلبة...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {Object.values(students)
                                    .sort((a, b) => (a.status === 'online' ? -1 : 1))
                                    .map(s => (
                                        <div key={s.studentId} className={`relative p-4 rounded-2xl border-2 transition-all group ${s.status === 'online' ? 'bg-white border-indigo-100 shadow-sm hover:border-indigo-300' : s.status === 'no-wifi' ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <Badge variant={s.status === 'online' ? 'success' : s.status === 'no-wifi' ? 'warning' : 'default'}>
                                                    {s.status === 'online' ? 'متصل' : s.status === 'no-wifi' ? 'لا يوجد إنترنت' : (s.submittedFiles && s.submittedFiles.length > 0) ? 'غير متصل' : 'غائب'}
                                                </Badge>
                                                <div className="text-left">
                                                    <span className="block text-lg font-black text-slate-800 leading-tight">{s.matricule || '...'}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">#{s.studentId}</span>
                                                </div>
                                            </div>

                                            {/* Warnings */}
                                            {s.warnings && s.warnings.length > 0 && (
                                                <div className="mb-3 space-y-1">
                                                    {s.warnings.slice(-2).map((w, i) => (
                                                        <div key={i} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded flex items-center gap-1 animate-pulse">
                                                            <span>⚠️</span> {w}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Submission Status */}
                                            <div className={`mt-3 pt-3 border-t ${s.status === 'online' ? 'border-indigo-50' : 'border-slate-100'}`}>
                                                {s.submittedFiles && s.submittedFiles.length > 0 ? (
                                                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg mb-2">
                                                        <span>📎</span>
                                                        <span className="text-xs font-bold">{s.submittedFiles.length} ملفات</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-slate-400 bg-slate-100 px-3 py-2 rounded-lg mb-2">
                                                        <span>⏳</span>
                                                        <span className="text-xs">لم يسلم بعد</span>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => s.isFinalized ? setSelectedStudentForFiles(s) : null}
                                                    disabled={!s.isFinalized}
                                                    className={`w-full py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${s.isFinalized
                                                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    {s.isFinalized ? '📂 عرض الملفات' : '⏳ الطالب لم ينهِ الامتحان'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Logs Sidebar */}
                <div className="lg:col-span-1 h-[calc(100vh-8rem)] sticky top-24">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <span>📜</span> السجل
                            </h3>
                            <button onClick={() => setShowClearLogsConfirm(true)} className="text-[10px] text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                                مسح
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                            {logs.length === 0 ? (
                                <div className="text-center py-12 opacity-30">
                                    <span className="text-4xl px-2">📭</span>
                                    <p className="text-xs mt-2">لا يوجد نشاط</p>
                                </div>
                            ) : (
                                logs.map((l, i) => (
                                    <div key={i} className={`text-xs p-3 rounded-xl border relative overflow-hidden ${l.type === 'warn' ? 'bg-amber-50 border-amber-100 text-amber-800' : l.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-white border-slate-100 text-slate-600'}`}>
                                        <div className="flex justify-between opacity-50 mb-1 font-mono text-[9px]">
                                            <span>{l.time}</span>
                                        </div>
                                        <p className="font-medium leading-relaxed">{l.msg}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <FileViewerModal
                isOpen={!!selectedStudentForFiles}
                onClose={() => setSelectedStudentForFiles(null)}
                studentData={selectedStudentForFiles}
            />

            <FilePreviewModal
                file={previewFile}
                onClose={() => setPreviewFile(null)}
            />

            <ConfirmModal
                isOpen={showClearLogsConfirm}
                title="مسح السجل"
                message="هل أنت متأكد من مسح جميع السجلات؟"
                confirmText="نعم، مسح"
                cancelText="إلغاء"
                type="danger"
                onConfirm={() => {
                    setLogs([]);
                    setShowClearLogsConfirm(false);
                }}
                onCancel={() => setShowClearLogsConfirm(false)}
            />
        </div >
    );
}

// Update StudentState interface (usually implied, but good to be explicit in mind or if defined elsewhere)
// But here I'll just update the component usage.

function FileViewerModal({ isOpen, onClose, studentData }: { isOpen: boolean, onClose: () => void, studentData: StudentState | null }) {
    if (!isOpen || !studentData) return null;
    const { submittedFiles, studentId, matricule } = studentData;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-slide-up" dir="rtl">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            📂 ملفات الطالب <span className="text-indigo-600">{matricule || studentId}</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">المعرف: {studentId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        ✖
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
                    {submittedFiles.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                            <span className="text-4xl opacity-30">📭</span>
                            <p className="text-slate-400 font-bold mt-2">لا توجد ملفات مسلمة بعد</p>
                        </div>
                    ) : (
                        submittedFiles.map((file, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-4 border rounded-2xl transition-all group ${file.exists !== false ? 'bg-slate-50 border-slate-100 hover:bg-indigo-50 hover:border-indigo-100' : 'bg-red-50 border-red-100 opacity-75'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${file.exists !== false ? 'bg-white' : 'bg-red-100 text-red-500'}`}>
                                        {file.exists !== false ? '📄' : '🚫'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-700 text-sm truncate max-w-[200px]">{file.name}</p>
                                        <div className="flex gap-2">
                                            <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">ملف تم تسليمه</span>
                                            {file.exists === false && (
                                                <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded font-bold">ملف محذوف من السيرفر</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <>
                                        <button
                                            onClick={() => setPreviewFile(file)}
                                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                                        >
                                            عرض
                                        </button>
                                        <a
                                            href={`${baseUrl}${file.url}`}
                                            download
                                            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors"
                                        >
                                            تحميل
                                        </a>
                                    </>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all shadow-lg hover:shadow-slate-300/50">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
}

