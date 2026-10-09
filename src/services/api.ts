import { auth } from './firebase';

const DEFAULT_API_URL = 'https://cp5-mobile.onrender.com';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL)
  .replace(/\/+$/, '');

export async function authenticatedApiFetch(path: `/${string}`, init: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sua sessão expirou. Entre novamente.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await currentUser.getIdToken()}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof payload.error === 'string'
  ) {
    return payload.error;
  }
  return fallback;
}
