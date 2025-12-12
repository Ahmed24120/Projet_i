export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function api<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function loginProfessor(email: string, password: string) {
  return api<{ token: string; user: { id: number; role: string; name?: string } }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password, role: "professor" }),
    }
  );
}
