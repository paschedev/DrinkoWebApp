// Las llamadas van a /api en el mismo dominio; Next.js las reenvía al backend.
// Al ser el mismo dominio, el navegador manda la cookie del cliente sola.

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }

  // status 0: la respuesta no llegó (sin señal o tardó demasiado).
  get isNetworkError() {
    return this.status === 0;
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisá la señal y probá de nuevo.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;
    throw new ApiError(res.status, message ?? 'Algo salió mal. Probá de nuevo.');
  }
  return data as T;
}
