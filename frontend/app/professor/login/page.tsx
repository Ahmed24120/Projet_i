"use client";
import React, { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, type Transition } from "framer-motion";
import Link from "next/link";
import { loginProfessor } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import NetworkDetector from "@/components/NetworkDetector";

const T = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as const,
} satisfies Transition;

export default function ProfessorLoginPage() {
  const router = useRouter();

  // reveal animation when page loads
  const [revealing, setRevealing] = useState(true);
  useEffect(() => {
    router.prefetch("/student/login");
    const id = setTimeout(() => setRevealing(false), 300);
    return () => clearTimeout(id);
  }, [router]);

  const [switching, setSwitching] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!email || !password || !roomNumber) {
      toast("Veuillez remplir tous les champs");
      return;
    }

    if (password.length < 8) {
      toast("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    try {
      setLoading(true);
      const data = await loginProfessor(email, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user)); // Fix: Store user data
      localStorage.setItem("roomNumber", roomNumber);
      toast("Connexion réussie ! 👨‍🏫");
      router.push("/professor/dashboard");
    } catch (err: any) {
      toast(err?.message || "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  }

  function goToStudent() {
    if (switching) return;
    setSwitching(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden font-sans">
      <NetworkDetector role="professor" />

      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] opacity-50 -translate-y-1/2 translate-x-1/4 animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/20 rounded-full blur-[100px] opacity-50 translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative flex w-full max-w-5xl bg-white dark:bg-slate-900/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/10 z-10 mx-4 min-h-[600px]">

        {/* LEFT SIDE: Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center relative z-20">
          <div className="text-center md:text-left mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-2xl mb-4 text-primary">
              👨‍🏫
            </div>
            <h2 className="text-3xl font-bold text-foreground">Espace Professeur</h2>
            <p className="text-sm text-muted-foreground mt-2">Gérez vos classes et examens en toute sécurité.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Professionnel"
              type="email"
              placeholder="professeur@aerobase.mr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />

            <Input
              label="Numéro de la salle (Surveillance)"
              placeholder="Ex: 101"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
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
              isLoading={loading || switching}
              className="w-full"
              size="lg"
            >
              Se Connecter
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center md:hidden flex flex-col gap-3">
            <Link href="/professor/register" className="text-sm font-medium text-primary hover:underline">
              Créer un compte professeur
            </Link>
            <button
              onClick={goToStudent}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              disabled={switching}
            >
              Vous êtes étudiant ? Accédez à l'espace étudiant
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: Decoration (Hidden on Mobile) */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-12 flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-6 leading-tight">L'excellence académique à portée de main.</h1>
            <p className="text-lg text-slate-300 mb-10 leading-relaxed">
              Une plateforme unifiée pour créer, surveiller et noter vos examens avec une efficacité inégalée.
            </p>

            <Link href="/professor/register">
              <button className="mb-4 w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 rounded-xl font-medium transition-all">
                Créer un compte professeur
              </button>
            </Link>

            <button
              type="button"
              onClick={goToStudent}
              className="group flex items-center gap-3 w-fit px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all font-medium"
              disabled={switching}
            >
              <span className="bg-white text-slate-900 w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">🎓</span>
              <span>Espace Étudiant</span>
            </button>
          </div>
        </div>

        {/* TRANSITION OVERLAY */}
        {(switching || revealing) && (
          <motion.div
            style={{ willChange: "transform" }}
            className="absolute inset-0 z-50 bg-primary"
            initial={{
              scaleX: revealing ? 1 : 0,
              transformOrigin: "left", // Reveal from left
            }}
            animate={{
              scaleX: switching ? 1 : 0,
              transformOrigin: "left", // Cover towards right logic if needed, but simple scaleX works
            }}
            transition={T}
            onAnimationComplete={() => {
              if (switching) router.push("/student/login");
            }}
          />
        )}
      </div>

      <div className="absolute bottom-4 text-center text-xs text-muted-foreground/50">
        © {new Date().getFullYear()} Projet_i. Tous droits réservés.
      </div>
    </div>
  );
}
