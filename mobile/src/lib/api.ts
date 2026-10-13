import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { localRequest } from './local-api';

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
 * « local » : l'API est exécutée dans l'application (hors ligne, catalogue de démo).
 * « remote » : l'application appelle un serveur Roysti (backend/) via HTTP.
 */
export type ApiMode = 'local' | 'remote';

/** Mode par défaut : distant seulement si une URL est fournie au build (EXPO_PUBLIC_API_URL). */
export const defaultApiMode: ApiMode = process.env.EXPO_PUBLIC_API_URL ? 'remote' : 'local';

/**
 * URL de l'API distante par défaut :
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

const state = {
  mode: defaultApiMode,
  baseUrl: defaultApiUrl(),
  token: null as string | null,
  onUnauthorized: null as (() => void) | null,
};

export const apiConfig = {
  get mode() {
    return state.mode;
  },
  setMode(mode: ApiMode) {
    state.mode = mode;
  },
  get baseUrl() {
    return state.baseUrl;
  },
  setBaseUrl(url: string | null) {
    state.baseUrl = (url || defaultApiUrl()).replace(/\/+$/, '');
  },
  setToken(token: string | null) {
    state.token = token;
  },
  /** Appelé quand l'API refuse le jeton en cours (session expirée, données réinitialisées…). */
  setOnUnauthorized(callback: (() => void) | null) {
    state.onUnauthorized = callback;
  },
};

function fail(status: number, message: string | undefined, code: string | undefined): never {
  if (status === 401 && state.token && code === 'unauthorized') state.onUnauthorized?.();
  throw new ApiError(message ?? `Erreur ${status}`, status, code);
}

type Query = Record<string, string | number | boolean | undefined | null>;

function cleanQuery(query: Query = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') out[key] = String(value);
  }
  return out;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const method = options.method ?? (options.body ? 'POST' : 'GET');
  const query = cleanQuery(options.query);

  if (state.mode === 'local') {
    const res = await localRequest({ method, path, query, body: options.body, token: state.token ?? undefined });
    if (res.status >= 400) {
      const err = (res.body ?? {}) as { error?: string; code?: string };
      fail(res.status, err.error, err.code);
    }
    return res.body as T;
  }

  const search = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${state.baseUrl}${path}${search ? `?${search}` : ''}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(`Impossible de joindre le serveur (${state.baseUrl}). Vérifiez qu'il est démarré, ou revenez au mode « intégré » dans Réglages.`, 0, 'network');
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) fail(res.status, json.error, json.code);
  return json as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Une erreur est survenue');
