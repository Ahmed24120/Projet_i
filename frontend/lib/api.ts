const baseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Generic API fetch helper
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

/**
 * Professor login
 */
export async function loginProfessor(
  email: string,
  password: string
) {
  return apiFetch<{ token: string }>(`/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      role: "professor",
    }),
  });
}

/**
 * Student login
 */
export async function loginStudent(
  email: string,
  password: string
) {
  return apiFetch<{ token: string }>(`/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      role: "student",
    }),
  });
}
