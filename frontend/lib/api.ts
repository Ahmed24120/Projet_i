const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
  return "http://localhost:3001";
};

export const baseUrl = getBaseUrl();

/**
 * Generic API fetch helper
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  // Auto-detect token from localStorage if in browser and not provided
  let authToken = token;
  if (!authToken && typeof window !== "undefined") {
    authToken = localStorage.getItem("token") || undefined;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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
 * Admin login
 */
export async function loginAdmin(
  email: string,
  password: string
) {
  return apiFetch<{ token: string; user: any }>(`/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      role: "ADMIN",
    }),
  });
}

/**
 * Professor login
 */
export async function loginProfessor(
  email: string,
  password: string
) {
  return apiFetch<{ token: string; user: any }>(`/auth/login`, {
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
/**
 * User Registration
 */
export async function registerUser(data: any) {
  return apiFetch<{ token: string; user: any }>(`/auth/register`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
