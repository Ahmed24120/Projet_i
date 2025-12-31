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

export default function ProfessorRegister() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        prenom: "",
        nom: "",
        email: "",
        password: "",
        secretCode: "",
    });
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await registerUser({ ...formData, role: "professor" });
            if (res?.token) {
                // Ne pas connecter automatiquement
                // localStorage.setItem("token", res.token);
                toast("Compte Professeur créé ! Connectez-vous maintenant. 👨‍🏫");
                router.push("/professor/login");
            }
        } catch (err: any) {
            toast(err?.message || "Erreur lors de l'inscription");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            <NetworkDetector role="professor" />

            {/* Background Decor */}
            <div className="absolute inset-0 z-0">
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-[100px] opacity-40 animate-float"></div>
            </div>

            <div className="w-full max-w-lg p-4 z-10 animate-fade-in">
                <Card glass className="p-8 shadow-2xl border-white/20">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-foreground mb-2">Inscription Professeur</h1>
                        <p className="text-muted-foreground text-sm">Créez votre compte enseignant sécurisé</p>
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
                            label="Email Professionnel"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
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

                        <Input
                            label="Code Secret (Autorisation)"
                            type="password"
                            value={formData.secretCode}
                            onChange={(e) => setFormData({ ...formData, secretCode: e.target.value })}
                            placeholder="Ex: PSN..."
                            required
                            fullWidth
                            className="border-primary/30 focus:border-primary"
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
                        <Link href="/professor/login" className="text-sm font-medium text-primary hover:underline">
                            Déjà inscrit ? Connectez-vous ici
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
