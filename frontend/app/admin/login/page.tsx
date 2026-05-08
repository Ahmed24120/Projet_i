"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAdmin } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import NetworkDetector from "@/components/NetworkDetector";
import { ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (!email || !password) {
            toast("Veuillez remplir tous les champs");
            return;
        }

        try {
            setLoading(true);
            const data = await loginAdmin(email, password);

            if (data.user.role !== "ADMIN") {
                throw new Error("Accès refusé : Ce compte n'est pas administrateur.");
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            toast("Connexion réussie ! 🛡️");
            router.push("/admin");
        } catch (err: any) {
            toast(err?.message || "Échec de la connexion");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden font-sans">
            <NetworkDetector role="admin" />

            {/* Animated Background */}
            <div className="absolute inset-0 z-0 bg-gray-50">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-100 rounded-full blur-[100px] opacity-50 -translate-y-1/2 translate-x-1/4 animate-float"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full blur-[100px] opacity-50 translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative flex w-full max-w-5xl bg-white backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/10 z-10 mx-4 min-h-[600px]">

                {/* LEFT SIDE: Form */}
                <div className="w-full md:w-1/2 p-10 flex flex-col justify-center relative z-20">
                    <div className="text-center md:text-left mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-50 text-2xl mb-4 text-purple-600">
                            <ShieldCheck size={28} />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">Espace Admin</h2>
                        <p className="text-sm text-gray-500 mt-2">Plateforme de supervision et de gestion.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Email ou Identifiant"
                            type="text"
                            placeholder=""
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            fullWidth
                        />

                        <Input
                            label="Mot de passe"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            fullWidth
                        />

                        <Button
                            type="submit"
                            isLoading={loading}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-purple-200"
                            size="lg"
                        >
                            Connexion Admin
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center flex flex-col gap-3">
                        <Link href="/" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
                            Retour au portail
                        </Link>
                    </div>
                </div>

                {/* RIGHT SIDE: Decoration */}
                <div className="hidden md:flex w-1/2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-12 flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-900/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10">
                        <h1 className="text-4xl font-black mb-6 leading-tight">Supervision Globale.</h1>
                        <p className="text-lg text-purple-100 mb-10 leading-relaxed font-medium opacity-90">
                            Accédez à une vue d'ensemble de tous les examens, gérez les utilisateurs et assurez le bon déroulement des épreuves.
                        </p>

                        <div className="flex gap-4 mt-6">
                            <Link href="/student/login">
                                <button className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all font-bold text-white">
                                    <span className="bg-white text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">🎓</span>
                                    <span>Espace Étudiant</span>
                                </button>
                            </Link>

                            <Link href="/professor/login">
                                <button className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all font-bold text-white">
                                    <span className="bg-white text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">👨‍🏫</span>
                                    <span>Espace Professeur</span>
                                </button>
                            </Link>
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
