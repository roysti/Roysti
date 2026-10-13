import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, apiConfig, defaultApiMode, type ApiMode } from './api';
import { resetLocalData } from './local-api';
import type { MeResponse, Meta } from './types';

const KEYS = { token: 'roysti.token', currency: 'roysti.currency', apiUrl: 'roysti.apiUrl', apiMode: 'roysti.apiMode' };

interface Session {
  ready: boolean;
  token: string | null;
  currency: string;
  apiUrl: string | null;
  apiMode: ApiMode;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  setApiUrl: (url: string | null) => Promise<void>;
  /** Change la source des données ; la session est fermée car les comptes diffèrent. */
  setApiMode: (mode: ApiMode) => Promise<void>;
  /** Mode intégré : efface les données locales et recrée le compte démo. */
  resetLocal: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

async function read(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null) {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée…) : la session reste en mémoire.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currency, setCurrencyState] = useState('EUR');
  const [apiUrl, setApiUrlState] = useState<string | null>(null);
  const [apiMode, setApiModeState] = useState<ApiMode>(defaultApiMode);

  useEffect(() => {
    (async () => {
      const [t, c, u, m] = await Promise.all([read(KEYS.token), read(KEYS.currency), read(KEYS.apiUrl), read(KEYS.apiMode)]);
      const mode: ApiMode = m === 'local' || m === 'remote' ? m : defaultApiMode;
      apiConfig.setToken(t);
      apiConfig.setBaseUrl(u);
      apiConfig.setMode(mode);
      setToken(t);
      if (c) setCurrencyState(c);
      setApiUrlState(u);
      setApiModeState(mode);
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(
    async (newToken: string) => {
      apiConfig.setToken(newToken);
      setToken(newToken);
      await write(KEYS.token, newToken);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    apiConfig.setToken(null);
    setToken(null);
    await write(KEYS.token, null);
    queryClient.clear();
  }, [queryClient]);

  const setCurrency = useCallback(async (value: string) => {
    setCurrencyState(value);
    await write(KEYS.currency, value);
  }, []);

  const setApiUrl = useCallback(
    async (url: string | null) => {
      const cleaned = url?.trim() || null;
      apiConfig.setBaseUrl(cleaned);
      setApiUrlState(cleaned);
      await write(KEYS.apiUrl, cleaned);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const clearSession = useCallback(async () => {
    apiConfig.setToken(null);
    setToken(null);
    await write(KEYS.token, null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    // Jeton refusé par l'API : on ferme la session pour réafficher l'écran de connexion.
    apiConfig.setOnUnauthorized(() => {
      clearSession();
    });
    return () => apiConfig.setOnUnauthorized(null);
  }, [clearSession]);

  const setApiMode = useCallback(
    async (mode: ApiMode) => {
      apiConfig.setMode(mode);
      setApiModeState(mode);
      await write(KEYS.apiMode, mode);
      await clearSession();
    },
    [clearSession],
  );

  const resetLocal = useCallback(async () => {
    await resetLocalData();
    await clearSession();
  }, [clearSession]);

  return (
    <SessionContext.Provider value={{ ready, token, currency, apiUrl, apiMode, signIn, signOut, setCurrency, setApiUrl, setApiMode, resetLocal }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession doit être utilisé dans SessionProvider');
  return ctx;
}

export function useMe() {
  const { token } = useSession();
  return useQuery({
    queryKey: ['me', token],
    queryFn: () => api<MeResponse>('/me'),
    enabled: !!token,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/meta'), staleTime: 60 * 60 * 1000 });
}
