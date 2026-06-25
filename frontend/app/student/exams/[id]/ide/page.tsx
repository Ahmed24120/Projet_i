"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import JSZip from "jszip";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────────
type Language = "cpp" | "php" | "python" | "html" | "sql";

const LANGUAGES: { key: Language; label: string; monacoLang: string; ext: string }[] = [
  { key: "python", label: "Python", monacoLang: "python", ext: ".py" },
  { key: "cpp", label: "C++", monacoLang: "cpp", ext: ".cpp" },
  { key: "php", label: "PHP", monacoLang: "php", ext: ".php" },
  { key: "html", label: "Web", monacoLang: "html", ext: ".html" },
  { key: "sql", label: "SQL (SQLite)", monacoLang: "sql", ext: ".sql" },
];

interface AppFile {
  filename: string;
  content: string;
  lastModified?: string;
}

function getApiBase() {
  if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getMonacoLanguage(filename: string, defaultLang: string) {
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.js')) return 'javascript';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.php')) return 'php';
  return defaultLang;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function StudentIDEPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  const [exam, setExam] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // New multi-file state
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [files, setFiles] = useState<AppFile[]>([]);
  const [activeFilename, setActiveFilename] = useState<string>("");

  const [output, setOutput] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "">("");
  const [stdinInput, setStdinInput] = useState<string>("");
  const [phpWebContainerId, setPhpWebContainerId] = useState<string | null>(null);
  const [phpWebEntryFile, setPhpWebEntryFile] = useState<string>("");
  const [toast, setToast] = useState<string>("");
  const [isExamEnded, setIsExamEnded] = useState(false);
  // SQL DB state
  const [sqlDatabaseFile, setSqlDatabaseFile] = useState<any>(null);
  const [databaseDumpContent, setDatabaseDumpContent] = useState<string | null>(null);
  const dbInputRef = useRef<HTMLInputElement>(null);

  // Split pane resizing
  const [leftPct, setLeftPct] = useState(40);
  const [consoleHeight, setConsoleHeight] = useState(250);
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const draggingConsole = useRef(false);

  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState("");

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameOldName, setRenameOldName] = useState("");
  const [renameNewNameInput, setRenameNewNameInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    onConfirm: () => { },
  });

  const showConfirm = (title: string, message: string, type: 'danger' | 'warning' | 'info', onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // ── Fetch exam & drafts ──────────────────────────────────────────────────
  useEffect(() => {
    if (!examId) return;

    const loadData = async () => {
      try {
        const resExam = await fetch(`${getApiBase()}/exams/${examId}`, { headers: authHeaders() });
        if (resExam.ok) setExam(await resExam.json());

        const resWork = await fetch(`${getApiBase()}/api/work?examId=${examId}`, { headers: authHeaders() });
        if (resWork.ok) {
          const work = await resWork.json();
          if (work) {
            if (work.selectedLanguage) setSelectedLanguage(work.selectedLanguage as Language);
            if (work.files) {
              setFiles(work.files);
              if (work.files.length > 0) setActiveFilename(work.files[0].filename);
            }
            if (work.sqlDatabaseFile) setSqlDatabaseFile(work.sqlDatabaseFile.diskFilename ? work.sqlDatabaseFile : null);
            if (work.databaseDump?.content) setDatabaseDumpContent(work.databaseDump.content);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInitial(false);
      }
    };
    loadData();
  }, [examId]);

  // ── Socket.io & Polling: exam events ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    import("socket.io-client").then(({ io }) => {
      const socket = io(getApiBase(), { auth: { token }, reconnection: true });
      const userRaw = localStorage.getItem("user");
      const user = userRaw ? JSON.parse(userRaw) : {};

      socket.emit("join-exam", { examId, studentId: user?.id, matricule: user?.matricule, role: "student" });
      socket.on("exam-published", (data: any) => setExam((prev: any) => ({ ...prev, isPublished: true, subject_file: data.subjectFile })));
      socket.on("exam-ended", () => { setIsExamEnded(true); showToast("⏰ L'examen est terminé."); });
      socket.on("queue-update", (data: any) => {
        setOutput(`⏳ File d'attente : position ${data.position}/${data.total} (serveur chargé, exécution en attente)...`);
      });
      return () => socket.disconnect();
    });
  }, [examId]);

  useEffect(() => {
    if (!examId) return;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${getApiBase()}/exams/${examId}/status`, { headers: authHeaders() });
        const data = await res.json();
        if (data.isPublished && data.subjectFile !== exam?.subject_file) {
          setExam((prev: any) => ({ ...prev, isPublished: true, subject_file: data.subjectFile }));
        }
      } catch (err) { }
    };
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [examId, exam?.subject_file]);

  // ── Modale de choix de langage ───────────────────────────────────────────
  const initLanguage = async (lang: Language) => {
    try {
      const res = await fetch(`${getApiBase()}/api/work/init`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ examId, language: lang })
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedLanguage(lang);
        setFiles(data.work.files);
        if (data.work.files.length > 0) setActiveFilename(data.work.files[0].filename);
        setSqlDatabaseFile(data.work.sqlDatabaseFile?.diskFilename ? data.work.sqlDatabaseFile : null);
      } else {
        showToast("❌ " + data.error);
      }
    } catch (err) {
      showToast("❌ Erreur serveur");
    }
  };

  const handleChangeLanguage = async () => {
    showConfirm(
      "Changer de langage ?",
      "Attention : Tous vos fichiers actuels seront supprimés et vous repartirez de zéro.",
      "danger",
      async () => {
        try {
          const res = await fetch(`${getApiBase()}/api/work/changeLanguage`, {
            method: "POST", headers: authHeaders(), body: JSON.stringify({ examId })
          });
          if (res.ok) {
            setSelectedLanguage(null);
            setFiles([]);
            setActiveFilename("");
            setSqlDatabaseFile(null);
            showToast("✅ Langage réinitialisé.");
          } else {
            showToast("❌ Erreur lors du changement de langage");
          }
        } catch (err) {
          showToast("❌ Erreur serveur");
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    );
  };

  // ── Auto-save par fichier (debounced 1.5s) ───────────────────────────────
  const saveCode = useCallback(async (filename: string, content: string) => {
    if (!examId || !filename) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`${getApiBase()}/api/work/file/save`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ examId, filename, content }),
      });
      if (res.ok) setSaveStatus("saved");
      else setSaveStatus("error");
    } catch {
      setSaveStatus("error");
    }
  }, [examId]);

  const activeFile = files.find(f => f.filename === activeFilename);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (activeFile) {
      saveTimerRef.current = setTimeout(() => saveCode(activeFile.filename, activeFile.content), 1500);
    }
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.content, activeFilename]);

  // ── Gestion Multi-Fichiers ───────────────────────────────────────────────
  const handleAddFile = () => {
    setNewFileNameInput("");
    setShowNewFileModal(true);
  };

  const confirmNewFile = async () => {
    const ext = LANGUAGES.find(l => l.key === selectedLanguage)?.ext || ".txt";
    let name = newFileNameInput.trim();
    if (!name) {
      setShowNewFileModal(false);
      return;
    }
    if (!name.includes(".")) name += ext;

    if (files.some(f => f.filename === name)) {
      showToast("❌ Fichier existant");
      return;
    }

    const res = await fetch(`${getApiBase()}/api/work/file/add`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ examId, filename: name })
    });
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
      setActiveFilename(name);
      setShowNewFileModal(false);
      setNewFileNameInput("");
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (isExecuting) return showToast("⏳ Impossible de supprimer pendant l'exécution");
    showConfirm(
      "Supprimer le fichier ?",
      `Voulez-vous vraiment supprimer définitivement "${filename}" ?`,
      "danger",
      async () => {
        const res = await fetch(`${getApiBase()}/api/work/file/delete`, {
          method: "POST", headers: authHeaders(), body: JSON.stringify({ examId, filename })
        });
        if (res.ok) {
          const data = await res.json();
          setFiles(data.files);
          if (activeFilename === filename && data.files.length > 0) setActiveFilename(data.files[0].filename);
          else if (data.files.length === 0) setActiveFilename("");
        }
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    );
  };

  const handleRenameClick = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (isExecuting) return showToast("⏳ Impossible de renommer pendant l'exécution");
    setRenameOldName(filename);
    setRenameNewNameInput(filename);
    setShowRenameModal(true);
  };

  const confirmRenameFile = async () => {
    if (!renameNewNameInput.trim()) return showToast("❌ Le nom ne peut pas être vide");
    if (renameNewNameInput === renameOldName) {
      setShowRenameModal(false);
      return;
    }

    // Mitigation Conflit Auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Sauvegarde forcée si c'est le fichier actif
    if (activeFilename === renameOldName) {
      const currentFile = files.find(f => f.filename === renameOldName);
      if (currentFile) await saveCode(renameOldName, currentFile.content);
    }

    setIsRenaming(true);
    try {
      const res = await fetch(`${getApiBase()}/api/work/file/rename`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ examId, oldFilename: renameOldName, newFilename: renameNewNameInput })
      });
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files);
        if (activeFilename === renameOldName) {
          setActiveFilename(renameNewNameInput);
        }
        showToast("✅ Fichier renommé");
        setShowRenameModal(false);
      } else {
        showToast("❌ " + (data.error || "Erreur renommage"));
      }
    } catch (err) {
      showToast("❌ Erreur serveur");
    } finally {
      setIsRenaming(false);
    }
  };

  // ── SQL Specific Logic ──────────────────────────────────────────────────
  const handleSqlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast("⏳ Importation de la base de données...");

    const formData = new FormData();
    formData.append("database", file);
    formData.append("examId", examId);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${getApiBase()}/api/work/sql/upload`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSqlDatabaseFile(data.sqlDatabaseFile);
        showToast("✅ Base de données importée !");
      } else {
        showToast("❌ " + (data.error || "Erreur lors de l'import"));
      }
    } catch (err) {
      showToast("❌ Erreur connexion serveur");
    } finally {
      if (dbInputRef.current) dbInputRef.current.value = "";
    }
  };

  const handleRemoveSql = async () => {
    showConfirm(
      "Supprimer la base de données ?",
      "Voulez-vous vraiment supprimer la base de données importée ? Les fichiers SQL ne seront pas impactés.",
      "warning",
      async () => {
        try {
          const res = await fetch(`${getApiBase()}/api/work/sql/remove`, {
            method: "POST", headers: authHeaders(), body: JSON.stringify({ examId })
          });
          if (res.ok) {
            setSqlDatabaseFile(null);
            showToast("✅ Base de données supprimée.");
          } else {
            showToast("❌ Erreur suppression");
          }
        } catch (err) {
          showToast("❌ Erreur connexion serveur");
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    );
  };

  // ── Code execution ───────────────────────────────────────────────────────
  const handleExecute = async () => {
    if (selectedLanguage === "html") {
      const htmlContent = files.find(f => f.filename.endsWith('.html'))?.content || "<h1>Aucun fichier HTML trouv\u00e9</h1>";
      const cssContent = files.filter(f => f.filename.endsWith('.css')).map(f => `<style>\n${f.content}\n</style>`).join('\n');
      const jsContent = files.filter(f => f.filename.endsWith('.js')).map(f => `<script>\n${f.content}\n</script>`).join('\n');
      let bundled = htmlContent;
      if (bundled.includes("</head>")) bundled = bundled.replace("</head>", `${cssContent}\n</head>`);
      else bundled = `${cssContent}\n${bundled}`;
      if (bundled.includes("</body>")) bundled = bundled.replace("</body>", `${jsContent}\n</body>`);
      else bundled = `${bundled}\n${jsContent}`;
      setPreviewHtml(bundled);
      setOutput("__HTML_PREVIEW__");
      return;
    }

    const code = activeFile?.content || "";
    const isProbablyInteractive =
      (selectedLanguage === "cpp" && code.includes("cin")) ||
      (selectedLanguage === "python" && code.includes("input(")) ||
      (selectedLanguage === "php" && (code.includes("fgets") || code.includes("STDIN") || code.includes("readline")));

    if (isProbablyInteractive && !stdinInput.trim()) {
      showConfirm(
        "Entr\u00e9e standard manquante",
        "Votre code semble attendre une saisie (ex: cin, input()), mais la zone d'Entr\u00e9e Standard est vide. Cela risque de bloquer le programme. Voulez-vous continuer sans entr\u00e9e ?",
        "warning",
        () => { setModalConfig(prev => ({ ...prev, isOpen: false })); executeWorkflow(); }
      );
      return;
    }
    executeWorkflow();
  };

  const executeWorkflow = async () => {
    setIsExecuting(true);
    setOutput("⏳ Exécution en cours...");
    setPhpWebContainerId(null);
    if (activeFile) await saveCode(activeFile.filename, activeFile.content);
    try {
      const res = await fetch(`${getApiBase()}/api/execute`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ files, currentFile: activeFilename, language: selectedLanguage, examId, stdin: stdinInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'exécution");
      if (data.phpWeb && data.containerId) {
        setPhpWebContainerId(data.containerId);
        setPhpWebEntryFile(data.entryFile || activeFilename);
        setOutput("__PHP_WEB_PREVIEW__");
      } else {
        let consoleOutput = (data.stdout || "(aucune sortie)") + (data.stderr ? "\n--- Erreurs ---\n" + data.stderr : "");
        if (data.databaseUpdated) {
          consoleOutput += "\n\n💾 Base de données mise à jour";
          
          // Récupérer le dump mis à jour pour le ZIP étudiant
          const resWork = await fetch(`${getApiBase()}/api/work?examId=${examId}`, { headers: authHeaders() });
          if (resWork.ok) {
            const work = await resWork.json();
            if (work?.databaseDump?.content) setDatabaseDumpContent(work.databaseDump.content);
          }
        }
        setOutput(consoleOutput);
      }
    } catch (err: any) {
      setOutput("\u274c " + (err.message || "Erreur inconnue"));
    } finally {
      setIsExecuting(false);
    }
  };

  // ── ZIP download ─────────────────────────────────────────────────────────
  const handleDownloadZip = async () => {
    if (files.length === 0) return showToast("⚠️ Aucun fichier à télécharger !");
    const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const user = userRaw ? JSON.parse(userRaw) : {};
    const matricule = user?.matricule || user?.id || "etudiant";

    const zip = new JSZip();
    const folder = zip.folder(String(matricule));
    for (const file of files) folder?.file(file.filename, file.content);
    if (databaseDumpContent) {
      folder?.file("database.sql", databaseDumpContent);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${matricule}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ ZIP téléchargé !");
  };

  // ── Final submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    showConfirm(
      "Soumission finale",
      "Confirmer la soumission finale ? Vous ne pourrez plus modifier votre code après cette action.",
      "warning",
      async () => {
        try {
          if (activeFile) await saveCode(activeFile.filename, activeFile.content);
          const res = await fetch(`${getApiBase()}/api/work/submit`, {
            method: "POST", headers: authHeaders(), body: JSON.stringify({ examId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          showToast("✅ Travail soumis ! Redirection...");
          setTimeout(() => router.push(`/student/exams/${examId}`), 2000);
        } catch (err: any) {
          showToast("❌ Erreur: " + err.message);
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    );
  };

  // ── Split pane mouse handlers ────────────────────────────────────────────
  const onMouseDownX = () => { dragging.current = true; };
  const onMouseDownY = () => { draggingConsole.current = true; };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(20, Math.min(70, pct)));
    }
    if (draggingConsole.current && rightPanelRef.current) {
      const rect = rightPanelRef.current.getBoundingClientRect();
      const bottomSpace = rect.bottom - e.clientY;
      const newHeight = bottomSpace - 50; // -50px approx for the bottom Action bar
      setConsoleHeight(Math.max(50, Math.min(rect.height - 150, newHeight)));
    }
  };

  const onMouseUp = () => {
    dragging.current = false;
    draggingConsole.current = false;
  };

  // ── Show language modal if none selected ─────────────────────────────────
  if (!loadingInitial && !selectedLanguage) {
    return (
      <div className="h-screen bg-[#0d1117] flex items-center justify-center text-white p-4">
        {toast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 text-white text-sm px-5 py-2 rounded-lg shadow-xl z-50 transition-opacity" style={{ background: "#21262d", border: "1px solid #30363d" }}>
            {toast}
          </div>
        )}
        <div className="max-w-xl w-full bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-blue-400 mb-2">Début de l'examen</h2>
          <p className="text-gray-400 mb-8 text-sm">
            Veuillez choisir le langage avec lequel vous allez passer cet examen.
            <br /><span className="text-red-400 font-semibold">Ce choix est définitif.</span>
          </p>
          <div className="grid grid-cols-2 gap-4">
            {LANGUAGES.map(l => (
              <button
                key={l.key}
                onClick={() => initLanguage(l.key)}
                className="p-4 border border-[#30363d] rounded-lg hover:border-blue-500 hover:bg-[#1f6feb]/10 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-xl font-bold">{l.label}</span>
                <span className="text-xs text-gray-500">Extensions: {l.ext}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const langDef = LANGUAGES.find(l => l.key === selectedLanguage) || LANGUAGES[0];

  // ── Render Main Interface ────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden text-white select-none" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#0d1117" }}>

      {/* Header */}
      <header style={{ background: "#161b22", borderBottom: "1px solid #30363d" }} className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 font-bold">PSE IDE</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-300 text-sm truncate max-w-xs">{loadingInitial ? "Chargement..." : (exam?.titre || `Examen #${examId}`)}</span>
          <span className="bg-[#30363d] px-2 py-0.5 rounded text-xs">{langDef.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {saveStatus === "saving" && <span className="text-yellow-400 animate-pulse">💾 Sauvegarde…</span>}
          {saveStatus === "saved" && <span className="text-green-400">✓ Sauvegardé</span>}
          {saveStatus === "error" && <span className="text-red-400">⚠ Erreur</span>}
          {isExamEnded && <span className="bg-red-600 text-white px-3 py-1 rounded-full font-bold animate-pulse">⏰ Examen terminé</span>}
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 text-white text-sm px-5 py-2 rounded-lg shadow-xl z-50 transition-opacity" style={{ background: "#21262d", border: "1px solid #30363d" }}>
          {toast}
        </div>
      )}

      {/* Split Pane */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

        {/* Panel Gauche: Sujet */}
        <div style={{ width: `${leftPct}%`, borderRight: "1px solid #30363d" }} className="flex flex-col overflow-hidden">
          <div style={{ background: "#161b22", borderBottom: "1px solid #30363d" }} className="px-3 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wider flex-shrink-0">
            📄 Sujet
          </div>
          <div className="flex-1 overflow-hidden bg-[#0d1117]">
            {loadingInitial ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm animate-pulse">Chargement…</div>
            ) : exam?.subject_file ? (
              <iframe src={`${getApiBase()}/static/${exam.subject_file}`} className="w-full h-full border-0" title="Sujet" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center text-gray-500 text-sm">
                <span className="text-4xl">⏳</span> En attente de la publication du sujet...
              </div>
            )}
          </div>
        </div>

        <div style={{ width: "4px", background: "#21262d", cursor: "col-resize" }} className="hover:bg-blue-600 transition-colors flex-shrink-0" onMouseDown={onMouseDownX} />

        {/* Panel Droit: Éditeur multifichiers */}
        <div ref={rightPanelRef} style={{ width: `${100 - leftPct}%` }} className="flex flex-col overflow-hidden">

          {/* File Tabs Toolbar */}
          <div style={{ background: "#161b22", borderBottom: "1px solid #30363d" }} className="flex items-center justify-between pl-2 pr-3 flex-shrink-0">
            <div className="flex items-center overflow-x-auto scroller-hide border-r border-[#30363d]">
              {files.map(f => (
                <div
                  key={f.filename}
                  onClick={() => setActiveFilename(f.filename)}
                  className="group flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-t-2 transition-colors relative"
                  style={{
                    borderTopColor: activeFilename === f.filename ? "#58a6ff" : "transparent",
                    background: activeFilename === f.filename ? "#0d1117" : "transparent",
                    color: activeFilename === f.filename ? "#e6edf3" : "#8b949e",
                    borderRight: "1px solid #30363d"
                  }}
                >
                  📄 {f.filename}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleRenameClick(e, f.filename)}
                      className="hover:text-blue-400 text-gray-500"
                      title="Renommer"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => handleDeleteFile(e, f.filename)}
                      className="hover:text-red-400 text-gray-500"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={handleAddFile} className="px-3 text-gray-400 hover:text-white transition-colors" title="Nouveau fichier">+</button>
            </div>

            <button
              onClick={handleExecute}
              disabled={isExecuting || !activeFile}
              className="flex items-center gap-1 px-3 py-1 my-1 text-xs rounded font-medium transition-colors disabled:opacity-50 bg-[#238636] text-white"
            >
              {isExecuting ? "⏳ Exécution…" : "▶ Exécuter"}
            </button>
          </div>



          {/* SQL Database Info Bar (Only shown if SQL selected) */}
          {selectedLanguage === "sql" && (
            <div style={{ background: "#21262d", borderBottom: "1px solid #30363d" }} className="px-3 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-semibold">🗄️ Base de données:</span>
                {sqlDatabaseFile ? (
                  <div className="flex items-center gap-1 bg-[#0d1117] border border-[#30363d] px-2 py-0.5 rounded text-blue-300">
                    <span className="truncate max-w-[200px]">{sqlDatabaseFile.originalName}</span>
                    <button onClick={handleRemoveSql} className="hover:text-red-400 font-bold ml-1" title="Supprimer la base">×</button>
                  </div>
                ) : (
                  <span className="text-gray-500 italic">Aucune base importée</span>
                )}
              </div>
              {!sqlDatabaseFile && (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={dbInputRef}
                    onChange={handleSqlUpload}
                    className="hidden"
                    accept=".sql,.db,.sqlite,.sqlite3"
                  />
                  <button
                    onClick={() => dbInputRef.current?.click()}
                    className="bg-[#1f6feb] hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors font-medium"
                  >
                    📄 Importer base (.sql/.db)
                  </button>
                </div>
              )}
            </div>
          )}

          <style dangerouslySetInnerHTML={{ __html: `.scroller-hide::-webkit-scrollbar { display: none; }` }} />

          {/* Monaco Editor */}
          <div style={{ flex: "1 1 0", minHeight: 0 }}>
            {activeFile ? (
              <MonacoEditor
                height="100%"
                language={getMonacoLanguage(activeFilename, langDef.monacoLang)}
                value={activeFile.content}
                onChange={v => setFiles(prev => prev.map(f => f.filename === activeFilename ? { ...f, content: v || "" } : f))}
                theme="vs-dark"
                options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600">Aucun fichier sélectionné</div>
            )}
          </div>

          {/* Resizer Vertical pour la console */}
          <div
            style={{ height: "4px", background: "#21262d", cursor: "row-resize", borderTop: "1px solid #30363d", borderBottom: "1px solid #30363d" }}
            className="hover:bg-blue-600 transition-colors flex-shrink-0 z-10"
            onMouseDown={onMouseDownY}
          />

          {/* Console + Entrée Standard */}
          <div style={{ height: `${consoleHeight}px` }} className="flex flex-col flex-shrink-0 bg-[#0d1117]">
            {/* Header bar */}
            <div
              style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}
              className={`px-3 py-1 text-xs text-gray-400 uppercase tracking-wider flex-shrink-0 ${selectedLanguage !== 'html' && selectedLanguage !== 'sql' ? 'grid grid-cols-2' : ''}`}
            >
              <div>🖥 Console {activeFile ? `(${activeFile.filename})` : ""}</div>
              {selectedLanguage !== 'html' && selectedLanguage !== 'sql' && (
                <div className="pl-3 border-l border-[#30363d] flex items-center gap-2">
                  <span>⌨️ Entrée Standard (stdin)</span>
                  <span className="bg-[#21262d] px-1.5 py-0.5 rounded-sm text-[9px] text-gray-500">
                    Obligatoire si saisie attendue
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Output */}
              <div className="flex-1 overflow-auto bg-[#0d1117] p-3 text-sm">
                {output === "__HTML_PREVIEW__" ? (
                  <iframe
                    srcDoc={previewHtml}
                    title="Prévisualisation HTML"
                    className="w-full h-full rounded bg-white shadow-inner"
                    sandbox="allow-scripts allow-same-origin allow-modals"
                  />
                ) : output === "__PHP_WEB_PREVIEW__" && phpWebContainerId ? (
                  <iframe
                    key={phpWebContainerId}
                    src={`${getApiBase()}/api/execute/php-preview/${phpWebContainerId}/${phpWebEntryFile}?token=${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`}
                    title="Prévisualisation PHP"
                    className="w-full h-full rounded bg-white shadow-inner"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                  />
                ) : output ? (
                  <pre className="text-green-300 font-mono whitespace-pre-wrap text-sm">{output}</pre>
                ) : (
                  <span className="text-xs text-[#484f58]">La sortie de l'exécution de {activeFilename} s'affichera ici…</span>
                )}
              </div>

              {/* stdin textarea (hidden for html/sql) */}
              {selectedLanguage !== 'html' && selectedLanguage !== 'sql' && output !== "__PHP_WEB_PREVIEW__" && (
                <div className="w-[40%] border-l border-[#30363d] bg-[#0d1117] flex flex-col p-2">
                  <textarea
                    value={stdinInput}
                    onChange={(e) => setStdinInput(e.target.value)}
                    placeholder={`Saisissez vos entrées ici (une par ligne).\nEx: 5\n10\nElles seront envoyées au programme via stdin.`}
                    className="flex-1 w-full bg-transparent text-gray-300 font-mono text-sm resize-none outline-none placeholder:text-gray-600"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div style={{ background: "#161b22", borderTop: "1px solid #30363d" }} className="flex items-center justify-between gap-2 px-3 py-2 flex-shrink-0">
            <button onClick={() => router.push(`/student/exams/${examId}`)} className="px-4 py-1.5 text-sm rounded font-medium transition-colors bg-[#21262d] text-gray-300 hover:text-white border border-[#30363d] hover:bg-[#30363d]">
              🔙 Retour
            </button>
            <div className="flex gap-2">
              <button onClick={handleChangeLanguage} className="px-4 py-1.5 text-sm rounded font-medium transition-colors bg-[#b3261e] text-white hover:bg-red-600">
                🔄 Changer de langage
              </button>
              <button onClick={handleDownloadZip} className="px-4 py-1.5 text-sm rounded font-medium transition-colors bg-[#6e40c9] text-white">
                📥 Télécharger ZIP
              </button>
              <button onClick={handleSubmit} className="px-4 py-1.5 text-sm rounded font-medium transition-colors bg-[#1f6feb] text-white">
                📤 Soumettre &amp; Passer à la remise
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nouveau Fichier */}
      {showNewFileModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[400px] bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Nom du nouveau fichier</h3>
            <input
              autoFocus
              type="text"
              value={newFileNameInput}
              onChange={e => setNewFileNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmNewFile();
                if (e.key === 'Escape') setShowNewFileModal(false);
              }}
              placeholder={(selectedLanguage === 'php' || selectedLanguage === 'html') ? "ex: index.html, style.css, script.js" : `ex: utils${LANGUAGES.find(l => l.key === selectedLanguage)?.ext || ".sql"}`}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded p-2 text-white outline-none focus:border-blue-500 mb-6"
            />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowNewFileModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors border border-transparent hover:border-[#30363d] rounded">Annuler</button>
              <button onClick={confirmNewFile} className="px-4 py-2 text-sm bg-[#1f6feb] hover:bg-blue-500 text-white rounded transition-colors">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rename File */}
      {showRenameModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-slide-up">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                ✏️ Renommer le fichier
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Ancien nom : <span className="text-gray-200 font-mono">{renameOldName}</span>
              </p>
              <input
                type="text"
                autoFocus
                maxLength={100}
                value={renameNewNameInput}
                onChange={(e) => setRenameNewNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmRenameFile()}
                placeholder="Nouveau nom (ex: solution.py)"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors mb-6"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRenameModal(false)}
                  className="flex-1 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg transition-colors font-medium border border-[#30363d]"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmRenameFile}
                  disabled={isRenaming || !renameNewNameInput.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-bold disabled:opacity-50"
                >
                  {isRenaming ? "Renommer..." : "Confirmer"}
                </button>
              </div>
            </div>
            {/* Note de pied de modale */}
            <div className="bg-[#0d1117]/50 px-6 py-3 border-t border-[#30363d]">
              <p className="text-[10px] text-gray-500 italic">
                Note : Renommer un fichier ne modifie pas la base SQL importée.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
