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

// Mensajes que ve el usuario. Nunca mostramos el texto crudo del servidor
// (por ejemplo "Cannot POST /auth/login" o mensajes de validación en inglés).
function friendlyMessage(status: number): string {
  if (status === 400) return 'Revisa los datos e intenta de nuevo';
  if (status === 401) return 'Correo o contraseña incorrectos';
  if (status === 409) return 'Ese correo ya está registrado';
  if (status === 404) return 'El servicio no está disponible por ahora. Intenta más tarde.';
  if (status === 429) return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  return 'Hubo un problema con el servidor. Intenta de nuevo en un momento.';
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

  if (!res.ok) {
    // El detalle técnico queda en la consola para depurar, no en pantalla
    console.warn(`[api] ${method} ${path} -> ${res.status}`, text.slice(0, 300));
    throw new ApiError(res.status, friendlyMessage(res.status));
  }

  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, friendlyMessage(500));
  }
}
