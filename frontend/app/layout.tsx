import "./globals.css";
import { ToastHost } from "@/components/ui/Toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 font-sans">
        <ToastHost />
        {children}
      </body>
    </html>
  );
}
