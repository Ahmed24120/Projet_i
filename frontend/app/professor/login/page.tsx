"use client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { loginProfessor } from "@/lib/api";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
// import { motion } from "framer-motion";

import { motion, type Transition } from "framer-motion";

const T = {
  duration: 0.18,
  ease: [0.4, 0, 0.2, 1] as const,
} satisfies Transition;


export default function ProfessorLoginPage() {
  const router = useRouter();

  // reveal animation when page loads (optional but makes it smooth)
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
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  setError(null);

  if (!email || !password) {
    setError("Please fill in all fields.");
    return;
  }

  try {
    const data = await loginProfessor(email, password);
    localStorage.setItem("token", data.token);
    router.push("/professor/dashboard");
  } catch (err: any) {
    setError(err?.message || "Login failed");
  }
}


  function goToStudent() {
    if (switching) return;
    setSwitching(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#C6D7E6] to-[#DCEEFE] p-4">
      <div className="relative flex w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* LEFT SIDE (unchanged style) */}
        <div className="w-1/2 bg-gradient-to-br from-purple-400 to-purple-600 text-white p-10 flex flex-col justify-center rounded-r-[80px]">
          <h1 className="text-4xl font-bold mb-3">Hello, Welcome!</h1>
          <p className="text-lg opacity-90 mb-8">Please log in to continue</p>

          <button
            type="button"
            onClick={goToStudent}
            className="w-fit px-10 py-3 rounded-xl border border-white/50 text-white hover:bg-white/10 transition"
            disabled={switching}
          >
            Student
          </button>
        </div>

        {/* RIGHT SIDE (unchanged style) */}
        <div className="w-1/2 p-10 flex flex-col justify-center text-black">
          <h2 className="text-3xl font-semibold mb-6 text-center">Login</h2>

          {error && (
            <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
  <label className="block text-sm font-medium text-black mb-1">Email</label>
      <Input
      type="email"
      placeholder="professor@example.com"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-black focus:ring-purple-500"
      required
  />
</div>


            <div>
  <label className="block text-sm font-medium text-black mb-1">Password</label>

  <div className="relative">
    <Input
      type={showPassword ? "text" : "password"}
      placeholder="••••••••"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-black focus:ring-purple-500 pr-12"
      required
    />

    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
      disabled={switching}
    >
      👁
    </button>
  </div>
</div>



            <Button
  type="submit"
  className="w-full bg-purple-600 hover:bg-purple-700 border-0 py-3 rounded-xl text-lg"
  disabled={switching}
>
  Login
</Button>

          </form>
        </div>

        {/* ✅ PURPLE COVER OVERLAY (fixes the “broken seconds”) */}
        {(switching || revealing) && (
          <motion.div
            style={{ willChange: "transform" }}
            className="absolute inset-0 z-50 bg-gradient-to-br from-purple-400 to-purple-600 rounded-3xl"
            initial={{
              scaleX: revealing ? 1 : 0.5, // on load: full cover then reveal
              transformOrigin: "left",
              opacity: 1,
            }}
            animate={{
              scaleX: switching ? 1 : 0, // on switch: cover all, otherwise reveal away
              opacity: 1,
            }}
            transition={T}
            onAnimationComplete={() => {
              if (switching) router.push("/student/login");
            }}
          />
        )}
      </div>
    </div>
  );
}
