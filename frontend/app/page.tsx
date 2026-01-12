import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ShieldCheck, GraduationCap, Users, Play, ArrowRight, Github } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-white font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">

      {/* Modern Background */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-50 rounded-full blur-3xl -z-10 opacity-60"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-3xl -z-10 opacity-60"></div>

      {/* Navbar Minimalist */}
      <nav className="absolute top-0 w-full p-6 md:p-10 flex justify-between items-center max-w-7xl mx-auto z-20">
        {/* <div className="flex items-center gap-2 font-black text-xl tracking-tighter">
          <div className="w-8 h-8 bg-black rounded-lg text-white flex items-center justify-center">i</div>
          Projet_i
        </div> */}
        <div className="flex gap-4">
          {/* Links could go here */}
        </div>
      </nav>

      <main className="container px-6 py-24 mx-auto flex flex-col items-center relative z-10 animate-fade-in-up">

        {/* Hero Section */}
        <div className="text-center mb-20 space-y-8 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-widest hover:bg-white hover:shadow-md transition-all cursor-default">
            <ShieldCheck size={14} className="text-green-500" />
            Plateforme d'Examen Sécurisée v2.0
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-gray-900 leading-[1.1] mb-6">
            L'excellence <br />
            <span className="text-blue-600">sans compromis.</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-500 leading-relaxed max-w-2xl mx-auto font-medium">
            Une expérience d'évaluation fluide, moderne et anti-triche pour propulser vos examens vers le futur.
          </p>
        </div>

        {/* Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">

          {/* Espace Étudiant */}
          <div className="group relative bg-white rounded-[2.5rem] p-8 border border-gray-200 shadow-2xl shadow-gray-200/50 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-100 transition-colors"></div>

            <div className="relative z-10 flex-1 flex flex-col">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200 rotate-3 group-hover:rotate-6 transition-transform">
                <GraduationCap size={32} />
              </div>
              <h2 className="text-2xl font-black mb-3 text-gray-900">Espace Étudiant</h2>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed font-medium flex-1">
                Rejoignez votre session d'examen, soumettez vos travaux et consultez vos résultats.
              </p>
              <Link href="/student/login">
                <Button className="w-full py-6 text-base rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all group-hover:shadow-blue-200/50 flex items-center justify-center gap-2">
                  Connexion <ArrowRight size={18} />
                </Button>
              </Link>
            </div>
          </div>

          {/* Espace Professeur */}
          <div className="group relative bg-white rounded-[2.5rem] p-8 border border-gray-200 shadow-2xl shadow-gray-200/50 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-100 transition-colors"></div>

            <div className="relative z-10 flex-1 flex flex-col">
              <div className="w-16 h-16 bg-white border-2 border-gray-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-gray-200 -rotate-3 group-hover:-rotate-6 transition-transform">
                <Users size={32} />
              </div>
              <h2 className="text-2xl font-black mb-3 text-gray-900">Espace Professeur</h2>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed font-medium flex-1">
                Créez des examens, surveillez les étudiants en direct et gérez les corrections.
              </p>
              <Link href="/professor/login">
                <Button variant="outline" className="w-full py-6 text-base rounded-2xl bg-white text-indigo-600 border-2 border-indigo-50 hover:border-indigo-100 hover:bg-indigo-50 shadow-lg transition-all flex items-center justify-center gap-2">
                  Connexion <Play size={18} fill="currentColor" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Espace Admin (NEW) */}
          <div className="group relative bg-gray-900 rounded-[2.5rem] p-8 border border-gray-800 shadow-2xl shadow-gray-900/20 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gray-800 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-gray-700 transition-colors opacity-50"></div>

            <div className="relative z-10 flex-1 flex flex-col">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-900/50 rotate-3 group-hover:rotate-0 transition-transform">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-black mb-3 text-white">Espace Admin</h2>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed font-medium flex-1">
                Gérez les utilisateurs, surveillez la plateforme et accédez aux archives globales.
              </p>
              <Link href="/admin/login">
                <Button variant="secondary" className="w-full py-6 text-base rounded-2xl bg-white hover:bg-gray-100 text-gray-900 shadow-lg transition-all group-hover:shadow-white/10 flex items-center justify-center gap-2">
                  Connexion <ShieldCheck size={18} />
                </Button>
              </Link>
            </div>
          </div>

        </div>

      </main>

      <footer className="w-full py-8 text-center text-sm font-bold text-gray-400 border-t border-gray-100 mt-auto">
        <div className="flex items-center justify-center gap-6 mb-4">
          <Github size={20} className="hover:text-black cursor-pointer transition-colors" />
        </div>
        <p>© {new Date().getFullYear()} Projet_i. Tous droits réservés.</p>
      </footer>
    </div>
  );
}
