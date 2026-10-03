export type User = {
  id: string; email: string; firstName: string; lastName: string;
  role: "ADMIN" | "CASHIER"; isActive: boolean; lastLoginAt: string | null;
};
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options, credentials: "include",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && !["/auth/login", "/auth/me"].includes(path)) window.dispatchEvent(new Event("session-expired"));
    const result = await response.json().catch(() => null);
    throw new ApiError(response.status, result?.error?.message ?? "The request could not be completed.", result?.error?.details);
  }
  return response.status === 204 ? undefined as T : response.json();
}
