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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden font-sans">
      <NetworkDetector role="student" />

      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-[100px] opacity-60 -translate-y-1/2 translate-x-1/4 animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-100 rounded-full blur-[100px] opacity-60 translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative flex w-full max-w-5xl bg-white backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/10 z-10 mx-4 min-h-[600px]">

        {/* LEFT SIDE: Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center relative z-20">
          <div className="text-center md:text-left mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-2xl mb-4 text-blue-600">
              🎓
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Espace Étudiant</h2>
            <p className="text-sm text-gray-500 mt-2">Connectez-vous pour accéder à vos examens.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-input text-blue-600 focus:ring-blue-500 transition-colors" />
                <span className="text-gray-500 group-hover:text-gray-900 transition-colors">Se souvenir de moi</span>
              </label>
              <a href="#" className="text-blue-600 hover:underline font-medium transition-all">
                Mot de passe oublié ?
              </a>
            </div>

            <Button
              type="submit"
              isLoading={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-blue-200"
              size="lg"
            >
              Se Connecter
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center md:hidden flex flex-col gap-3">
            <Link href="/student/register" className="text-sm font-bold text-blue-600 hover:underline">
              Pas encore de compte ? Inscrivez-vous
            </Link>
            <Link href="/professor/login" className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors">
              Vous êtes professeur ? Connectez-vous ici
            </Link>
          </div>
        </div>

        {/* RIGHT SIDE: Decoration (Hidden on Mobile) */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-br from-blue-600 to-indigo-500 text-white p-12 flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-900/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10">
            <h1 className="text-4xl font-black mb-6 leading-tight">Votre réussite commence ici.</h1>
            <p className="text-lg text-blue-100 mb-10 leading-relaxed font-medium opacity-90">
              Accédez à vos examens, soumettez vos travaux et suivez votre progression dans un environnement sécurisé.
            </p>

            <Link href="/student/register">
              <button className="mb-4 w-full bg-white/20 hover:bg-white/30 border border-white/20 text-white py-4 rounded-xl font-bold transition-all backdrop-blur-sm shadow-sm">
                Pas encore de compte ? Inscrivez-vous
              </button>
            </Link>

            <Link href="/professor/login" className="no-underline block w-fit">
              <button
                type="button"
                className="group flex items-center gap-3 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all font-bold"
              >
                <span className="bg-white text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">👨‍🏫</span>
                <span>Espace Professeur</span>
              </button>
            </Link>
          </div>
        </div>

      </div>

      <div className="absolute bottom-4 text-center text-xs text-muted-foreground/50">
        © {new Date().getFullYear()} Projet_i. Tous droits réservés.
      </div>
    </div>
  );
}
