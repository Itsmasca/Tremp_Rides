import { API_TIMEOUT_MS, API_URL } from '@/constants/api';

// Error con el mensaje que manda el backend (o uno genérico en español)
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

// NestJS devuelve { message: string | string[] } en los errores de validación
function extractMessage(data: any, status: number): string {
  const m = data?.message;
  if (Array.isArray(m)) return m.join('\n');
  if (typeof m === 'string' && m.trim()) return m;
  if (status === 401) return 'Correo o contraseña incorrectos';
  if (status === 409) return 'Ese correo ya está registrado';
  return `Error del servidor (${status})`;
}

export async function request<T>(path: string, { method = 'GET', body, token }: Options = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e: any) {
    const timedOut = e?.name === 'AbortError';
    throw new ApiError(
      0,
      timedOut
        ? 'El servidor tardó demasiado en responder. Intenta de nuevo.'
        : 'No se pudo conectar con el servidor. Revisa tu conexión o que el backend esté encendido.',
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) throw new ApiError(res.status, extractMessage(data, res.status));
  return data as T;
}
