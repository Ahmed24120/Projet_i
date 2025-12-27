import "./globals.css";
import { ToastHost } from "@/components/ui/Toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
        <ToastHost />
        {children}
      </body>
    </html>
  );
}
