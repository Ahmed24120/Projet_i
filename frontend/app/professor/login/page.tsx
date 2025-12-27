"use client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { loginProfessor } from "@/lib/api";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, type Transition } from "framer-motion";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { toast } from "@/components/ui/Toast";
import NetworkDetector from "@/components/NetworkDetector";

const T = {
  duration: 0.18,
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ... imports remain the same

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      toast("يرجى ملء جميع الحقول");
      return;
    }

    // Validation
    if (!email.endsWith("@aerobase.mr") && !email.endsWith("@supnum.mr")) {
      toast("البريد الإلكتروني يجب أن ينتهي بـ @aerobase.mr أو @supnum.mr");
      return;
    }

    if (password.length < 8) {
      toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    try {
      setLoading(true);
      const data = await loginProfessor(email, password);
      localStorage.setItem("token", data.token);
      toast("تم تسجيل الدخول بنجاح! 👨‍🏫");
      router.push("/professor/dashboard");
    } catch (err: any) {
      toast(err?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  function goToStudent() {
    if (switching) return;
    setSwitching(true);
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden font-sans">
      <NetworkDetector role="professor" />
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative flex w-full max-w-4xl bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/50 z-10 mx-4">

        {/* RIGHT SIDE: Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center text-gray-800 relative z-20">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg text-white text-3xl font-bold animate-pulse-glow">
              👨‍🏫
            </div>
            <h2 className="text-3xl font-black mb-2 text-gray-900">فضاء الأساتذة</h2>
            <p className="text-sm text-gray-500">قم بتسجيل الدخول لإدارة الامتحانات</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 transition-colors group-focus-within:text-purple-600">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="professor@aerobase.mr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-4 pr-10 py-3 rounded-xl border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-right"
                    required
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📧</span>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 transition-colors group-focus-within:text-purple-600">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-4 pr-10 py-3 rounded-xl border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-right"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 transition-colors" />
                <span className="text-gray-600 group-hover:text-gray-800 transition-colors">تذكرني</span>
              </label>
              <a href="#" className="text-purple-600 hover:text-purple-700 font-semibold hover:underline transition-all">
                نسيت كلمة المرور؟
              </a>
            </div>

            <Button
              type="submit"
              disabled={loading || switching}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" color="white" />
                  <span>جاري الدخول...</span>
                </div>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center md:hidden">
            <button
              onClick={goToStudent}
              className="text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors"
              disabled={switching}
            >
              هل أنت طالب؟ انتقل إلى فضاء الطالب
            </button>
          </div>
        </div>

        {/* LEFT SIDE: Decoration (Hidden on Mobile) */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-12 flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10">
            <h1 className="text-4xl font-black mb-6 leading-tight">مرحباً بك في منصة الامتحانات</h1>
            <p className="text-lg text-purple-100 mb-10 leading-relaxed opacity-90">
              قم بإدارة امتحاناتك، مراقبة الطلاب، وتقييم النتائج بكل سهولة وأمان عبر منصتنا المتطورة.
            </p>

            <button
              type="button"
              onClick={goToStudent}
              className="group flex items-center gap-3 w-fit px-8 py-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all font-semibold"
              disabled={switching}
            >
              <span className="bg-white text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">🎓</span>
              <span>الدخول كطالب</span>
            </button>
          </div>
        </div>

        {/* TRANSITION OVERLAY */}
        {(switching || revealing) && (
          <motion.div
            style={{ willChange: "transform" }}
            className="absolute inset-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600"
            initial={{
              scaleX: revealing ? 1 : 0,
              transformOrigin: "right", // Change origin for Arabic/RTL feel if needed, but 'right' works for transitioning FROM student login
              opacity: 1,
            }}
            animate={{
              scaleX: switching ? 1 : 0, // Cover screen on switch
              opacity: 1,
            }}
            transition={T}
            onAnimationComplete={() => {
              if (switching) router.push("/student/login");
            }}
          />
        )}
      </div>

      <div className="absolute bottom-4 text-center text-xs text-gray-400">
        © 2025 نظام الامتحانات الآمن. جميع الحقوق محفوظة.
      </div>
    </div>
  );
}
