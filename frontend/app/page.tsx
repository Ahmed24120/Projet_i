import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background selection:bg-primary/20">

      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-accent/20 rounded-full blur-[80px] -z-10" />

      <main className="container px-4 py-16 mx-auto flex flex-col items-center z-10 animate-fade-in">

        {/* Hero Section */}
        <div className="text-center mb-16 space-y-6 max-w-3xl">
          <div className="inline-block px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold uppercase tracking-wider mb-4 animate-slide-up">
            Plateforme d'Examen Sécurisée
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            Simplifiez vos <span className="text-primary">évaluations</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Une expérience d'examen fluide, moderne et anti-triche pour les étudiants et les professeurs.
          </p>
        </div>

        {/* Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">

          {/* Espace Étudiant */}
          <Card glass hover className="p-8 flex flex-col items-center text-center space-y-6 border-t-4 border-t-primary">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-2">
              🎓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Espace Étudiant</h2>
              <p className="text-muted-foreground mt-2">
                Rejoignez un examen, consultez vos résultats et gérez votre profil.
              </p>
            </div>
            <Link href="/student/login">
              <Button size="lg" className="w-full">
                Connexion Étudiant
              </Button>
            </Link>
          </Card>

          {/* Espace Professeur */}
          <Card glass hover className="p-8 flex flex-col items-center text-center space-y-6 border-t-4 border-t-secondary-foreground">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-3xl mb-2">
              👨‍🏫
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Espace Professeur</h2>
              <p className="text-muted-foreground mt-2">
                Créez des examens, surveillez en temps réel et analysez les performances.
              </p>
            </div>
            <Link href="/professor/login">
              <Button variant="secondary" size="lg" className="w-full">
                Connexion Professeur
              </Button>
            </Link>
          </Card>

        </div>

      </main>

      <footer className="absolute bottom-6 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Projet_i. Tous droits réservés.
      </footer>
    </div>
  );
}
