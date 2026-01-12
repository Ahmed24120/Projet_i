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

    const handleResetPassword = async (userId: number) => {
        const newPwd = prompt("Entrez le nouveau mot de passe :");
        if (!newPwd) return;
        const token = localStorage.getItem("token");
        try {
            await apiFetch(`/auth/users/${userId}/reset-password`, {
                method: "POST",
                body: JSON.stringify({ password: newPwd })
            }, token || undefined);
            toast("Mot de passe réinitialisé");
        } catch (e) { toast("Erreur reset password"); }
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Gestion Utilisateurs</h2>
                <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    <Plus className="w-4 h-4" /> Créer
                </Button>
            </div>

            <Card className="p-4 flex gap-4 bg-white/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Rechercher nom, matricule, email..."
                        className="pl-10"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                    />
                </div>
                <select
                    className="border rounded-lg px-3 text-sm"
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                >
                    <option value="all">Tous rôles</option>
                    <option value="student">Étudiants</option>
                    <option value="professor">Professeurs</option>
                    <option value="ADMIN">Admins</option>
                </select>
                <Button variant="outline" onClick={fetchUsers}>Filtrer</Button>
            </Card>

            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Nom</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Matricule</th>
                            <th className="px-6 py-3">Rôle</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-3 font-medium text-gray-900">{u.name}</td>
                                <td className="px-6 py-3 text-gray-500">{u.email}</td>
                                <td className="px-6 py-3 font-mono text-xs">{u.matricule || '-'}</td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                        u.role === 'professor' ? 'bg-blue-100 text-blue-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-right flex justify-end gap-2">
                                    <button onClick={() => openEdit(u)} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="Modifier">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleResetPassword(u.id)} className="p-1 hover:bg-red-50 rounded text-red-600" title="Reset Password">
                                        <Key className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && <div className="p-8 text-center text-gray-400">Aucun utilisateur trouvé</div>}
            </div>

            {/* Modal Create/Edit */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="max-w-md w-full p-6 bg-white animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold mb-4">{editingUser ? "Modifier" : "Créer"} Utilisateur</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500">Nom complet</label>
                                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Email (optionnel / auto)</label>
                                <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Matricule</label>
                                    <Input value={formData.matricule} onChange={e => setFormData({ ...formData, matricule: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Rôle</label>
                                    <select
                                        className="w-full border rounded h-10 px-2 bg-white"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        disabled={!!editingUser} // Disallow role change via edit for safety
                                    >
                                        <option value="student">Étudiant</option>
                                        <option value="professor">Professeur</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Mot de passe</label>
                                    <Input required type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                </div>
                            )}

                            {formData.role === 'student' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Salle / Classe (Optionnel)</label>
                                    <Input value={formData.salle} onChange={e => setFormData({ ...formData, salle: e.target.value })} placeholder="S203" />
                                </div>
                            )}

                            <div className="flex justify-end gap-2 mt-6">
                                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
                                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Enregistrer</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
