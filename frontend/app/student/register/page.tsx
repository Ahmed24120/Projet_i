"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import NetworkDetector from "@/components/NetworkDetector";

export default function StudentRegister() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        prenom: "",
        nom: "",
        matricule: "",
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await registerUser({ ...formData, role: "student" });
            if (res?.token) {
                // Ne pas connecter automatiquement
                // localStorage.setItem("token", res.token);

                toast("Compte créé avec succès ! Connectez-vous maintenant. 🚀");
                router.push("/student/login");
            }
        } catch (err: any) {
            toast(err?.message || "Erreur lors de l'inscription");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            <NetworkDetector role="student" />

            {/* Background Decor */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] opacity-40 animate-float"></div>
            </div>

            <div className="w-full max-w-lg p-4 z-10 animate-fade-in">
                <Card glass className="p-8 shadow-2xl border-white/20">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-foreground mb-2">Inscription Étudiant</h1>
                        <p className="text-muted-foreground text-sm">Créez votre compte pour accéder aux examens</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Prénom"
                                value={formData.prenom}
                                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                                required
                            />
                            <Input
                                label="Nom"
                                value={formData.nom}
                                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                required
                            />
                        </div>

                        <Input
                            label="Matricule (ID)"
                            value={formData.matricule}
                            onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                            required
                            fullWidth
                        />

                        <Input
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            fullWidth
                        />

                        <Input
                            label="Mot de passe"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            fullWidth
                        />

                        <Button
                            type="submit"
                            isLoading={loading}
                            className="w-full mt-6"
                        >
                            S'inscrire
                        </Button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-border text-center">
                        <Link href="/student/login" className="text-sm font-medium text-primary hover:underline">
                            Déjà un compte ? Connectez-vous
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
