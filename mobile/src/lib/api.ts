import Constants from 'expo-constants';
import { Platform } from 'react-native';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * URL de l'API par défaut :
 * 1. EXPO_PUBLIC_API_URL si défini ;
 * 2. sur le web, même hôte que la page, port 4000 ;
 * 3. sur téléphone en développement, l'IP de l'ordinateur qui sert Metro (hostUri) ;
 * 4. sinon localhost (10.0.2.2 pour l'émulateur Android).
 */
export function defaultApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:4000/api`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000/api`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api';
}

const state = { baseUrl: defaultApiUrl(), token: null as string | null };

export const apiConfig = {
  get baseUrl() {
    return state.baseUrl;
  },
  setBaseUrl(url: string | null) {
    state.baseUrl = (url || defaultApiUrl()).replace(/\/+$/, '');
  },
  setToken(token: string | null) {
    state.token = token;
  },
};

type Query = Record<string, string | number | boolean | undefined | null>;

export async function api<T>(path: string, options: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const url = `${state.baseUrl}${path}${params.size ? `?${params}` : ''}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(`Impossible de joindre le serveur (${state.baseUrl}). Vérifiez que l'API est démarrée et l'adresse dans Réglages.`, 0, 'network');
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(json.error ?? `Erreur ${res.status}`, res.status, json.code);
  return json as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Une erreur est survenue');
