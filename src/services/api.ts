import { auth } from './firebase';
import { getApiBaseUrl } from '../config/environment';

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

  return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
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
