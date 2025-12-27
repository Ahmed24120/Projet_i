"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginStudent } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import NetworkDetector from "@/components/NetworkDetector";

export default function StudentLogin() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("token")) {
      router.push("/student/exams");
    }
  }, [router]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) {
      toast("يرجى تعبئة جميع الحقول!");
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
        toast("تم تسجيل الدخول بنجاح! 🚀");
        router.push("/student/exams");
      }
    } catch (err: any) {
      toast("فشل الدخول: تحقق من البيانات");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      <NetworkDetector role="student" />
      {/* خلفية جمالية */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-50 translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md p-4 z-10 animate-fade-in">
        <Card className="shadow-2xl border-0 !p-8 backdrop-blur-sm bg-white/90">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg text-white text-3xl font-bold">
              🎓
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">فضاء الطالب</h1>
            <p className="text-gray-500 text-sm">قم بتسجيل الدخول للوصول إلى امتحاناتك</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 transition-colors group-focus-within:text-blue-600">
                  رقم القيد أو البريد الإلكتروني
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثال: 12345678"
                    className="pl-4 pr-10 py-3 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-right text-gray-900"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">👤</span>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 transition-colors group-focus-within:text-blue-600">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-4 pr-10 py-3 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-right text-gray-900"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors" />
                <span className="text-gray-600 group-hover:text-gray-800 transition-colors">تذكرني</span>
              </label>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-all">
                نسيت كلمة المرور؟
              </a>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" color="white" />
                  <span>جاري التحقق...</span>
                </div>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link href="/professor/login" className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors">
              هل أنت أستاذ؟ سجل الدخول من هنا
            </Link>
          </div>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2025 نظام الامتحانات الآمن. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}
