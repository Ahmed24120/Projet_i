"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Plus, Edit2, Key } from "lucide-react";
import { toast } from "@/components/ui/Toast";

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [loading, setLoading] = useState(false);

    // Edit State
    const [editingUser, setEditingUser] = useState<any>(null); // if null -> Create mode
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: "", email: "", matricule: "", role: "student", password: "", salle: "" });

    // Reset Password State
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUserId, setResetUserId] = useState<number | null>(null);
    const [newPassword, setNewPassword] = useState("");

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const query = new URLSearchParams();
            if (search) query.append("search", search);
            if (roleFilter !== "all") query.append("role", roleFilter);

            const res = await apiFetch<any[]>(`/auth/users?${query.toString()}`, {}, token || undefined);
            setUsers(res);
        } catch {
            toast("Erreur chargement utilisateurs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [roleFilter]); // Search triggers manually or with debounce usually, here basic

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem("token");
        try {
            if (editingUser) {
                // Update
                await apiFetch(`/auth/users/${editingUser.id}`, {
                    method: "PUT",
                    body: JSON.stringify(formData)
                }, token);
                toast("Utilisateur mis à jour");
            } else {
                // Create
                if (!formData.password) return toast("Mot de passe requis pour création");
                await apiFetch(`/auth/users`, {
                    method: "POST",
                    body: JSON.stringify(formData)
                }, token);
                toast("Utilisateur créé");
            }
            setShowModal(false);
            fetchUsers();
        } catch (e: any) {
            toast("Erreur: " + (e.error || e.message));
        }
    };

    const handleResetPassword = (userId: number) => {
        setResetUserId(userId);
        setNewPassword("");
        setShowResetModal(true);
    };

    const handleResetSubmit = async () => {
        if (!resetUserId || !newPassword) return;
        const token = localStorage.getItem("token");
        try {
            await apiFetch(`/auth/users/${resetUserId}/reset-password`, {
                method: "POST",
                body: JSON.stringify({ password: newPassword })
            }, token || undefined);
            toast("Mot de passe réinitialisé avec succès 🚀");
            setShowResetModal(false);
        } catch (e) { toast("Erreur lors de la réinitialisation"); }
    };

    const openCreate = () => {
        setEditingUser(null);
        setFormData({ name: "", email: "", matricule: "", role: "student", password: "", salle: "" });
        setShowModal(true);
    };

    const openEdit = (u: any) => {
        setEditingUser(u);
        setFormData({
            name: u.name,
            email: u.email,
            matricule: u.matricule || "",
            role: u.role,
            password: "", // No password edit here directly
            salle: "" // We don't fetch salle in list currently, so leave empty or require explicit input
        });
        setShowModal(true);
    };

    return (
        <div className="space-y-8 p-2">
            {/* Ambient Background Elements (Consistent with Dashboard) */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-[100px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-black text-gray-800 tracking-tight leading-tight">Gestion Utilisateurs</h2>
                    <p className="text-gray-500 font-medium mt-1">Gérez les comptes, rôles et accès de la plateforme.</p>
                </div>
                <Button
                    onClick={openCreate}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-xl px-6 py-6 font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Nouveau Compte
                </Button>
            </div>

            {/* Controls Bar */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, matricule ou email..."
                        className="w-full bg-white/50 border border-transparent focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-2xl pl-12 pr-4 py-3 outline-none transition-all font-medium placeholder:text-gray-400"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="bg-white/50 border border-transparent hover:bg-white focus:border-indigo-300 rounded-2xl px-4 py-3 outline-none font-medium text-gray-600 cursor-pointer transition-all appearance-none min-w-[150px]"
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                    >
                        <option value="all">Tous les rôles</option>
                        <option value="student">Étudiants</option>
                        <option value="professor">Professeurs</option>
                        <option value="ADMIN">Admins</option>
                    </select>
                    <Button
                        onClick={fetchUsers}
                        variant="outline"
                        className="rounded-2xl border-transparent bg-white/50 hover:bg-white hover:text-indigo-600 font-bold px-6"
                    >
                        Filtrer
                    </Button>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nom & Identité</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Contact</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Matricule</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Rôle</th>
                                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((u, i) => (
                                <tr
                                    key={u.id}
                                    className="group hover:bg-indigo-50/30 transition-colors duration-200"
                                    style={{ animationDelay: `${i * 50}ms` }}
                                >
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md ${u.role === 'ADMIN' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                                                u.role === 'professor' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                                                    'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                                }`}>
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-gray-700">{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 font-medium text-gray-600">{u.email}</td>
                                    <td className="px-8 py-4">
                                        {u.matricule ? (
                                            <span className="bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1 rounded-lg text-xs font-mono font-bold">
                                                {u.matricule}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className={`px-3 py-1.5 rounded-full text-xs uppercase font-bold tracking-wide shadow-sm inline-flex items-center gap-1.5 ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                            u.role === 'professor' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${u.role === 'ADMIN' ? 'bg-purple-500' :
                                                u.role === 'professor' ? 'bg-blue-500' :
                                                    'bg-emerald-500'
                                                }`}></span>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEdit(u)}
                                            className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100 transition-all active:scale-95"
                                            title="Modifier"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleResetPassword(u.id)}
                                            className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-red-600 hover:border-red-200 hover:shadow-lg hover:shadow-red-100 transition-all active:scale-95"
                                            title="Réinitialiser le mot de passe"
                                        >
                                            <Key className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {users.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Aucun utilisateur trouvé</h3>
                        <p className="text-gray-500">Essayez de modifier vos filtres ou votre recherche.</p>
                    </div>
                )}
            </div>

            {/* Modern Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)} />

                    <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800">{editingUser ? "Modifier Profil" : "Nouveau Compte"}</h3>
                                <p className="text-sm text-gray-500">Remplissez les informations ci-dessous.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                <span className="text-gray-500 font-bold">✕</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 ml-1 uppercase tracking-wider">Nom complet</label>
                                <Input
                                    required
                                    className="bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl py-6"
                                    placeholder="Ex: John Doe"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 ml-1 uppercase tracking-wider">Email</label>
                                <Input
                                    className="bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl py-6"
                                    placeholder="email@exemple.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1 uppercase tracking-wider">Matricule</label>
                                    <Input
                                        className="bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl py-6 font-mono"
                                        placeholder="PREFIX-123"
                                        value={formData.matricule}
                                        onChange={e => setFormData({ ...formData, matricule: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1 uppercase tracking-wider">Rôle</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3.5 appearance-none font-bold outline-none"
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            disabled={!!editingUser}
                                        >
                                            <option value="student">Étudiant</option>
                                            <option value="professor">Professeur</option>
                                            <option value="ADMIN">Administrateur</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!editingUser && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1 uppercase tracking-wider">Mot de passe</label>
                                    <Input
                                        required
                                        type="password"
                                        className="bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl py-6"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            )}

                            {formData.role === 'student' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1 uppercase tracking-wider">Salle / Classe (Optionnel)</label>
                                    <Input
                                        className="bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl py-6"
                                        placeholder="Ex: S203"
                                        value={formData.salle}
                                        onChange={e => setFormData({ ...formData, salle: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 rounded-xl py-6 font-bold hover:bg-red-50 hover:text-red-600"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-indigo-200 transition-transform active:scale-95"
                                >
                                    {editingUser ? "Sauvegarder les modifications" : "Créer l'utilisateur"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Password Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowResetModal(false)} />
                    <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Key className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800">Nouveau Mot de Passe</h3>
                            <p className="text-sm text-gray-500">Entrez le nouveau mot de passe pour cet utilisateur.</p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleResetSubmit(); }} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 ml-1 uppercase tracking-wider">Mot de passe</label>
                                <Input
                                    autoFocus
                                    required
                                    type="text"
                                    className="bg-gray-50 border-gray-200 focus:bg-white focus:border-red-500 rounded-xl py-6 text-center text-lg font-bold tracking-widest"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowResetModal(false)}
                                    className="flex-1 rounded-xl py-4 font-bold hover:bg-gray-100"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-[2] bg-red-600 hover:bg-red-700 text-white rounded-xl py-4 font-bold shadow-lg shadow-red-200 transition-transform active:scale-95"
                                >
                                    Réinitialiser
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
