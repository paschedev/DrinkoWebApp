// Las llamadas van a /api en el mismo dominio; Next.js las reenvía al backend.
// Al ser el mismo dominio, el navegador manda la cookie del cliente sola.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;
    throw new ApiError(res.status, message ?? 'Algo salió mal. Probá de nuevo.');
  }
  return data as T;
}
