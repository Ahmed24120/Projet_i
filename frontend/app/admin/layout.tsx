"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, LogOut, Shield } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        if (pathname === "/admin/login") return; // Skip check on login page

        // Basic Client-side Protection
        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");

        if (!token || !userStr) {
            router.replace("/admin/login");
            return;
        }

        try {
            const user = JSON.parse(userStr);
            if (user.role !== "ADMIN") {
                throw new Error("Not Admin");
            }
            setAuthorized(true);
        } catch (e) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            router.replace("/admin/login");
        }
    }, [pathname, router]);

    const handleLogout = () => {
        // Prevent layout from reacting to token removal before redirect
        setAuthorized(false);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/admin/login");
    };

    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    if (!authorized) return null; // Or a loading spinner

    const navItems = [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { label: "Utilisateurs", href: "/admin/users", icon: Users },
        { label: "Examens", href: "/admin/exams", icon: FileText },
    ];

    return (
        <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
            {/* Sidebar */}
            <aside className={`bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 flex flex-col ${sidebarOpen ? "w-64" : "w-20"}`}>
                <div className="h-16 flex items-center justify-center border-b border-gray-100">
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xl cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <Shield size={24} />
                        {sidebarOpen && <span>ADMIN</span>}
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${isActive
                                    ? "bg-blue-50 text-blue-600 shadow-sm"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                            >
                                <item.icon size={20} />
                                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                            </a>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all ${!sidebarOpen && "justify-center"}`}
                    >
                        <LogOut size={20} />
                        {sidebarOpen && <span className="font-medium">Déconnexion</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative">
                <div className="max-w-7xl mx-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
