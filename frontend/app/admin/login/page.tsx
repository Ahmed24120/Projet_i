"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { ShieldCheck } from "lucide-react";
import NetworkDetector from "@/components/NetworkDetector";

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!email || !password) return toast("Remplissez tous les champs");

        try {
            setLoading(true);
            const data = await loginAdmin(email, password);
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            toast("Admin connecté 🚀");
            router.push("/admin");
        } catch (err: any) {
            toast(err?.message || "Échec connexion admin");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden font-sans">
            {/* Note: NetworkDetector needs a role, but we can potentially omit or pass a dummy if not needed for admin, 
                 or we can pass 'professor' as a fallback to avoid errors if it strictly types role. 
                 Let's assume we don't need strict cheat detection here. */}

            {/* Animated Background (Light Theme) */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100 rounded-full blur-[100px] opacity-60 -translate-y-1/2 translate-x-1/4 animate-float"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full blur-[100px] opacity-60 translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative flex w-full max-w-5xl bg-white backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/10 z-10 mx-4 min-h-[600px]">

                {/* LEFT SIDE: Form */}
                <div className="w-full md:w-1/2 p-10 flex flex-col justify-center relative z-20">
                    <div className="text-center md:text-left mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-2xl mb-4 text-indigo-600">
                            <ShieldCheck size={24} />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">Espace Admin</h2>
                        <p className="text-sm text-gray-500 mt-2">Connectez-vous pour gérer la plateforme.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Email Admin"
                            type="text"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder=""
                            required
                            fullWidth
                        />
                        <Input
                            label="Mot de passe"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            fullWidth
                        />

                        <div className="flex items-center justify-between text-sm">
                            <a href="#" className="text-indigo-600 hover:underline font-medium transition-all ml-auto">
                                Mot de passe oublié ?
                            </a>
                        </div>

                        <Button
                            type="submit"
                            isLoading={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-indigo-200"
                            size="lg"
                        >
                            Se Connecter
                        </Button>
                    </form>
                </div>

                {/* RIGHT SIDE: Decoration (Hidden on Mobile) */}
                <div className="hidden md:flex w-1/2 bg-gradient-to-br from-indigo-600 to-blue-500 text-white p-12 flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10">
                        <h1 className="text-4xl font-black mb-6 leading-tight">Administration Centralisée.</h1>
                        <p className="text-lg text-indigo-100 mb-10 leading-relaxed font-medium opacity-90">
                            Gérez les utilisateurs, surveillez les examens en temps réel et assurez le bon fonctionnement de la plateforme.
                        </p>

                        <div className="flex flex-col gap-4">
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <ShieldCheck className="text-white" size={20} />
                                    <span className="font-bold text-sm text-white">Système Sécurisé</span>
                                </div>
                                <p className="text-xs text-indigo-100">Accès restreint aux administrateurs autorisés uniquement.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => router.push('/professor/login')}
                                    className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all font-bold text-center"
                                >
                                    <span className="bg-white text-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">👨‍🏫</span>
                                    <span className="text-sm">Espace Professeur</span>
                                </button>

                                <button
                                    onClick={() => router.push('/student/login')}
                                    className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all font-bold text-center"
                                >
                                    <span className="bg-white text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">🎓</span>
                                    <span className="text-sm">Espace Étudiant</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div className="absolute bottom-4 text-center text-xs text-muted-foreground/50">
                © {new Date().getFullYear()} Projet_i. Tous droits réservés.
            </div>
        </div>
    );
}
