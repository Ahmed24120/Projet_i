"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function ProfessorLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    console.log("Login attempt:", email, password);
    router.push("/professor/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#C6D7E6] to-[#DCEEFE] p-4">
      <div className="flex w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* LEFT SIDE */}
        <div className="w-1/2 bg-gradient-to-br from-purple-400 to-purple-600 text-white p-10 flex flex-col justify-center rounded-r-[80px]">
          <h1 className="text-4xl font-bold mb-3">Hello, Welcome!</h1>
          <p className="text-lg opacity-90">Please log in to continue</p>
        </div>

        {/* RIGHT SIDE */}
        <div className="w-1/2 p-10 flex flex-col justify-center text-black">
          <h2 className="text-3xl font-semibold mb-6 text-center">Login</h2>

          {error && (
            <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="professor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-black focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 
                        4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 
                        9.97 0 012.046-3.368M6.7 6.7A9.953 9.953 0 0112 
                        5c4.477 0 8.268 2.943 9.542 7a9.96 9.96 0 
                        01-4.043 5.148M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-medium text-lg transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
