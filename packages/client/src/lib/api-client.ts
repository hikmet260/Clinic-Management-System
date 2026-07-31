const API_BASE = '/api';

export const TOKEN_KEY = 'clinic_token';
export const USER_KEY = 'clinic_user';

export const UNAUTHORIZED_EVENT = 'clinic:unauthorized';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
    }
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      // ignore unparseable error bodies
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => api<T>(path, { method: 'DELETE' }),
};
