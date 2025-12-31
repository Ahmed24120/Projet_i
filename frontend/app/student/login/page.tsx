"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginStudent } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import NetworkDetector from "@/components/NetworkDetector";

export default function StudentLogin() {
  const router = useRouter();

  // useEffect removed to allow access to login page even if token exists
  // useEffect(() => {
  //   if (localStorage.getItem("token")) {
  //     router.push("/student/exams");
  //   }
  // }, [router]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password || !roomNumber) {
      toast("Veuillez remplir tous les champs !");
      return;
    }

    try {
      setLoading(true);
      const res = await loginStudent(identifier, password);
      if (res?.token) {
        localStorage.setItem("token", res.token);
        if ((res as any).user) {
          localStorage.setItem("user", JSON.stringify((res as any).user));
        }
        localStorage.setItem("roomNumber", roomNumber);
        toast("Connexion réussie ! 🚀");
        router.push("/student/exams");
      }
    } catch (err: any) {
      toast("Échec de la connexion : Vérifiez vos identifiants");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <NetworkDetector role="student" />

      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] opacity-50 -translate-y-1/2 translate-x-1/4 animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-[100px] opacity-50 translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md p-4 z-10 animate-fade-in">
        <Card glass className="p-8 shadow-2xl border-white/20">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-3xl">
              🎓
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Espace Étudiant</h1>
            <p className="text-muted-foreground text-sm">Connectez-vous pour accéder à vos examens</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Input
                label="Numéro de la salle (Ex: 101)"
                type="text"
                required
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="101"
                fullWidth
              />

              <Input
                label="ID ou Email"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Ex : 12345678"
                fullWidth
              />

              <Input
                label="Mot de passe"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                fullWidth
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-input text-primary focus:ring-ring transition-colors" />
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">Se souvenir de moi</span>
              </label>
              <a href="#" className="text-primary hover:underline font-medium transition-all">
                Mot de passe oublié ?
              </a>
            </div>

            <Button
              type="submit"
              isLoading={loading}
              className="w-full"
            >
              Se Connecter
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center flex flex-col gap-2">
            <Link href="/student/register" className="text-sm font-medium text-primary hover:underline">
              Pas encore de compte ? Inscrivez-vous
            </Link>
            <Link href="/professor/login" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
              Vous êtes professeur ? Connectez-vous ici
            </Link>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          © {new Date().getFullYear()} Projet_i. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
