"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Search, Plus, Edit2, RotateCcw, Save, X, User, Shield, GraduationCap, School, Trash2, Archive, RefreshCcw } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/components/ui/Toast";

export default function AdminUsersPage() {
    const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterRole, setFilterRole] = useState("");
    const [modalOpen, setModalOpen] = useState(false);

    // Edit/Create State
    const [editingUser, setEditingUser] = useState<any | null>(null); // null = create mode
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        matricule: "",
        role: "student",
        password: "",
        salle: ""
    });

    // Modal State for Confirmations
    const [resetModal, setResetModal] = useState<{ open: boolean; userId: number | null }>({ open: false, userId: null });
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; userId: number | null }>({ open: false, userId: null });
    const [restoreModal, setRestoreModal] = useState<{ open: boolean; userId: number | null }>({ open: false, userId: null });
    const [newPasswordValue, setNewPasswordValue] = useState("");

    const fetchUsers = async () => {
        setLoading(true);
        try {
            let endpoint = viewMode === 'active' ? "/auth/users?" : "/auth/users/trash?";
            let q = endpoint;
            if (filterRole && viewMode === 'active') q += `role=${filterRole}&`;
            if (search) q += `search=${search}`;
            const res = await apiFetch<any[]>(q);
            setUsers(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setUsers([]); // Clear previous list to avoid flicker
        fetchUsers();
    }, [filterRole, viewMode]);

    // Handle Search Debounce
    useEffect(() => {
        const timer = setTimeout(fetchUsers, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleOpenCreate = () => {
        setEditingUser(null);
        setFormData({ name: "", email: "", matricule: "", role: "student", password: "", salle: "" });
        setModalOpen(true);
    };

    const handleEdit = (u: any) => {
        setEditingUser(u);
        setFormData({
            name: u.name,
            email: u.email,
            matricule: u.matricule || "",
            role: u.role,
            password: "",
            salle: ""
        });
        setModalOpen(true);
    };

    // 1. Password Reset
    const requestResetPassword = (id: number) => {
        setNewPasswordValue("");
        setResetModal({ open: true, userId: id });
    };

    const executeResetPassword = async () => {
        if (!resetModal.userId || !newPasswordValue) return;
        try {
            await apiFetch(`/auth/users/${resetModal.userId}/reset-password`, {
                method: "POST",
                body: JSON.stringify({ password: newPasswordValue })
            });
            toast("Mot de passe réinitialisé ! 🔐");
            setResetModal({ open: false, userId: null });
        } catch (e: any) {
            toast(e.message || "Erreur de réinitialisation");
        }
    };

    // 2. Delete User (Soft)
    const requestDelete = (id: number) => {
        setDeleteModal({ open: true, userId: id });
    };

    const executeDelete = async () => {
        if (!deleteModal.userId) return;
        try {
            await apiFetch(`/auth/users/${deleteModal.userId}`, { method: "DELETE" });
            toast("Utilisateur déplacé dans la corbeille 🗑️");
            setDeleteModal({ open: false, userId: null });
            fetchUsers();
        } catch (e: any) {
            toast(e.message || "Erreur lors de la suppression");
        }
    };

    // 3. Restore User
    const requestRestore = (id: number) => {
        setRestoreModal({ open: true, userId: id });
    };

    const executeRestore = async () => {
        if (!restoreModal.userId) return;
        try {
            await apiFetch(`/auth/users/${restoreModal.userId}/restore`, { method: "POST" });
            toast("Utilisateur restauré avec succès ♻️");
            setRestoreModal({ open: false, userId: null });
            fetchUsers();
        } catch (e: any) {
            toast(e.message || "Erreur lors de la restauration");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Create/Update logic remains same
            if (editingUser) {
                await apiFetch(`/auth/users/${editingUser.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        matricule: formData.matricule,
                        salle: formData.salle
                    })
                });
                toast("Utilisateur mis à jour !");
            } else {
                await apiFetch("/auth/users", {
                    method: "POST",
                    body: JSON.stringify({
                        ...formData,
                        password: formData.password || Math.random().toString(36).slice(-8)
                    })
                });
                toast("Utilisateur créé avec succès !");
            }
            setModalOpen(false);
            fetchUsers();
        } catch (e: any) {
            toast(e.message || "Erreur sauvegarde");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestion Utilisateurs</h1>
                    <p className="text-gray-500 font-medium">Administrez les comptes et accès.</p>
                </div>

                <div className="flex gap-3">
                    {/* Toggle Trash View */}
                    <button
                        onClick={() => setViewMode(viewMode === 'active' ? 'trash' : 'active')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border shadow-sm
                            ${viewMode === 'trash'
                                ? 'bg-orange-100 text-orange-700 border-orange-200'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                        {viewMode === 'active' ? <Archive size={20} /> : <User size={20} />}
                        {viewMode === 'active' ? 'Corbeille' : 'utilisateurs Actifs'}
                    </button>

                    {viewMode === 'active' && (
                        <button
                            onClick={handleOpenCreate}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
                        >
                            <Plus size={20} /> Nouvel Utilisateur
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className={`p-5 rounded-2xl shadow-sm border flex flex-col md:flex-row gap-4 transition-colors
                ${viewMode === 'trash' ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-gray-100'}`}>
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder={viewMode === 'trash' ? "Rechercher un utilisateur supprimé..." : "Rechercher par nom, matricule ou email..."}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                {viewMode === 'active' && (
                    <select
                        className="border-none bg-gray-100 hover:bg-gray-200 rounded-xl px-6 py-3 font-medium cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-blue-100"
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                    >
                        <option value="">Tous les rôles</option>
                        <option value="student">Étudiants</option>
                        <option value="professor">Professeurs</option>
                        <option value="ADMIN">Administrateurs</option>
                    </select>
                )}
            </div>

            {/* Warning Banner for Trash */}
            {viewMode === 'trash' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 text-orange-800 animate-slide-up">
                    <Archive size={24} className="text-orange-500" />
                    <div>
                        <span className="font-bold">Mode Corbeille :</span> Les utilisateurs ici ne peuvent plus se connecter. Restaurez-les pour réactiver leur accès.
                    </div>
                </div>
            )}

            {/* Modern List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/80 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-5 text-gray-400 font-bold text-xs uppercase tracking-wider">Utilisateur</th>
                            <th className="px-6 py-5 text-gray-400 font-bold text-xs uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-5 text-gray-400 font-bold text-xs uppercase tracking-wider">Rôle</th>
                            <th className="px-6 py-5 text-gray-400 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.map(u => (
                            <tr key={u.id} className={`group transition-colors ${viewMode === 'trash' ? 'hover:bg-orange-50/50' : 'hover:bg-blue-50/30'}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm transition-opacity
                                            ${viewMode === 'trash' ? 'bg-gray-100 text-gray-400 opacity-50' :
                                                u.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' :
                                                    u.role === 'professor' ? 'bg-indigo-100 text-indigo-600' :
                                                        'bg-blue-100 text-blue-600'}`}>
                                            {u.role === 'ADMIN' ? <Shield size={18} /> :
                                                u.role === 'professor' ? <GraduationCap size={18} /> :
                                                    <User size={18} />}
                                        </div>
                                        <div className={viewMode === 'trash' ? 'opacity-50' : ''}>
                                            <div className="font-bold text-gray-900">{u.name}</div>
                                            {u.matricule && <div className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded inline-block mt-1">{u.matricule}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-500">{u.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                                        ${viewMode === 'trash' ? 'bg-gray-100 text-gray-500' :
                                            u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                u.role === 'professor' ? 'bg-indigo-100 text-indigo-700' :
                                                    'bg-green-100 text-green-700'}`}>
                                        {u.role}
                                    </span>
                                    {viewMode === 'trash' && u.deleted_at && (
                                        <div className="text-[10px] text-gray-400 mt-1">Supprimé le {new Date(u.deleted_at).toLocaleDateString()}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {viewMode === 'active' ? (
                                            <>
                                                <button onClick={() => handleEdit(u)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => requestResetPassword(u.id)} className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Réinitialiser MDP">
                                                    <RotateCcw size={18} />
                                                </button>
                                                <button onClick={() => requestDelete(u.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer (Corbeille)">
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => requestRestore(u.id)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded-lg shadow-sm font-bold text-xs" title="Restaurer cet utilisateur">
                                                <RefreshCcw size={14} /> Restaurer
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {loading && <tr><td colSpan={4} className="p-12 text-center text-gray-400 animate-pulse">Chargement des données...</td></tr>}
                        {!loading && users.length === 0 && (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-400">
                                {viewMode === 'active' ? "Aucun utilisateur actif trouvé." : "La corbeille est vide."}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modals from previous steps (Create/Edit, Reset Password) -> Omitted here for brevity in Replace, but I need to include them. 
               Since I am doing a FULL WRITE, I must include EVERYTHING.
            */}

            {/* Create/Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-xl text-gray-900">{editingUser ? "Modifier Profil" : "Nouveau Compte"}</h3>
                            <button onClick={() => setModalOpen(false)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Rôle</label>
                                    <div className="relative">
                                        <select
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all appearance-none font-medium"
                                            disabled={!!editingUser}
                                        >
                                            <option value="student">Étudiant</option>
                                            <option value="professor">Professeur</option>
                                            <option value="ADMIN">Administrateur</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Matricule</label>
                                    <input
                                        type="text"
                                        value={formData.matricule}
                                        onChange={e => setFormData({ ...formData, matricule: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-mono"
                                        placeholder="Ex: 24120"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nom Complet</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                    placeholder="Prénom Nom"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                    placeholder="exemple@supnum.mr"
                                    required
                                />
                            </div>
                            {!editingUser && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Mot de passe <span className="font-normal text-gray-400 text-xs">(Optionnel)</span></label>
                                    <input
                                        type="text"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-mono"
                                        placeholder="Généré automatiquement si vide"
                                    />
                                </div>
                            )}
                            {formData.role === 'student' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Salle / Classe</label>
                                    <div className="relative">
                                        <School className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={formData.salle}
                                            onChange={e => setFormData({ ...formData, salle: e.target.value })}
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                            placeholder="Ex: Salle 101"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="pt-4 flex gap-4">
                                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-6 py-3 text-gray-600 font-bold bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Annuler</button>
                                <button type="submit" className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2">
                                    <Save size={20} /> Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RESET PASSWORD MODAL */}
            {resetModal.open && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-slide-up border border-gray-100">
                        <div className="flex items-center gap-3 mb-4 text-orange-600">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                <RotateCcw size={24} />
                            </div>
                            <h3 className="font-bold text-xl text-gray-900">Réinitialisation</h3>
                        </div>
                        <p className="text-gray-500 mb-6 text-sm">Veuillez entrer le nouveau mot de passe pour cet utilisateur. Cette action est immédiate.</p>
                        <div className="space-y-4">
                            <input
                                type="text"
                                autoFocus
                                value={newPasswordValue}
                                onChange={(e) => setNewPasswordValue(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-center text-lg tracking-widest"
                                placeholder="Nouveau MDP"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setResetModal({ open: false, userId: null })} className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Annuler</button>
                                <button onClick={executeResetPassword} disabled={!newPasswordValue} className="py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Confirmer</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            <ConfirmModal
                isOpen={deleteModal.open}
                title="Supprimer l'utilisateur ?"
                message="Voulez-vous vraiment supprimer cet utilisateur ? Il sera déplacé dans la corbeille et ne pourra plus se connecter."
                type="danger"
                confirmText="Oui, Supprimer"
                onConfirm={executeDelete}
                onCancel={() => setDeleteModal({ open: false, userId: null })}
            />

            {/* RESTORE CONFIRMATION MODAL */}
            <ConfirmModal
                isOpen={restoreModal.open}
                title="Restaurer l'utilisateur ?"
                message="L'utilisateur retrouvera immédiatement l'accès à son compte."
                type="info"
                confirmText="Restaurer l'accès"
                onConfirm={executeRestore}
                onCancel={() => setRestoreModal({ open: false, userId: null })}
            />
        </div>
    );
}
