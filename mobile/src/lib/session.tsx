import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, apiConfig } from './api';
import type { MeResponse, Meta } from './types';

const KEYS = { token: 'roysti.token', currency: 'roysti.currency', apiUrl: 'roysti.apiUrl' };

interface Session {
  ready: boolean;
  token: string | null;
  currency: string;
  apiUrl: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  setApiUrl: (url: string | null) => Promise<void>;
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

  useEffect(() => {
    (async () => {
      const [t, c, u] = await Promise.all([read(KEYS.token), read(KEYS.currency), read(KEYS.apiUrl)]);
      apiConfig.setToken(t);
      apiConfig.setBaseUrl(u);
      setToken(t);
      if (c) setCurrencyState(c);
      setApiUrlState(u);
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

  return (
    <SessionContext.Provider value={{ ready, token, currency, apiUrl, signIn, signOut, setCurrency, setApiUrl }}>
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
