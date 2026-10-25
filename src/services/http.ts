
import { localRequest } from './localApi';

/**
 * Base URL of your PHP API running under XAMPP.
 * Put this in a .env file at the project root to override:
 *   VITE_API_BASE_URL=http://localhost/relieftrack-api
 */
const DEFAULT_API_BASE_URL = 'http://localhost/relieftrack-api';
export const API_BASE_URL =
import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
export const USE_LOCAL_DATA = (import.meta.env.VITE_DATA_MODE ?? 'local') !== 'api';
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (USE_LOCAL_DATA) {
    try {
      return await localRequest<T>(path, init);
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError(cause instanceof Error ? cause.message : 'Local demo request failed.', 0);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.method?.toUpperCase() === 'POST' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      },
      credentials: 'include',
      ...init
    });
  } catch {
    throw new ApiError('Cannot reach the server. Make sure XAMPP (Apache & MySQL) is running.', 0);
  }

  const text = await response.text();
  let payload: ApiEnvelope<T> | null = null;

  try {
    payload = text ? JSON.parse(text) as ApiEnvelope<T> : null;
  } catch {
    throw new ApiError('The server did not return valid JSON. Check your PHP file for warnings.', response.status);
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.message ?? `Request failed (${response.status})`, response.status);
  }

  return payload.data as T;
}

export const http = {
  get: <T,>(path: string, signal?: AbortSignal) => request<T>(path, signal ? { signal } : undefined),
  post: <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })
};