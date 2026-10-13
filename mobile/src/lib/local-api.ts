import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCore, type ApiRequest, type ApiResponse, type Core } from '../../../backend/src/core/api';
import { MockProvider } from '../../../backend/src/providers/mock';
import { Store, type Data } from '../../../backend/src/store/db';
import { mobileRuntime } from './local-runtime';

/**
 * API embarquée : la même logique que le serveur (backend/src/core/api.ts),
 * exécutée directement sur le téléphone avec le catalogue de démonstration.
 * Les données (compte, commandes, colis…) sont conservées dans AsyncStorage.
 */
const STORAGE_KEY = 'roysti.localdb.v1';

let corePromise: Promise<Core> | null = null;

async function loadData(): Promise<Partial<Data> | undefined> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Data>) : undefined;
  } catch {
    return undefined;
  }
}

function getCore(): Promise<Core> {
  corePromise ??= loadData().then((initial) =>
    createCore({
      store: new Store({
        uuid: mobileRuntime.uuid,
        initial,
        persist: (data) => {
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => undefined);
        },
        // Écriture immédiate : l'application peut être fermée à tout moment.
        persistDelayMs: 0,
      }),
      provider: new MockProvider(),
      runtime: mobileRuntime,
      demoMode: true,
    }),
  );
  return corePromise;
}

export async function localRequest(request: ApiRequest): Promise<ApiResponse> {
  const core = await getCore();
  const response = await core.handle(request);
  // Copie profonde : l'interface ne doit jamais partager d'objets avec le stockage
  // (même comportement qu'une vraie réponse réseau).
  return response.body === undefined ? response : { status: response.status, body: JSON.parse(JSON.stringify(response.body)) };
}

/** Efface toutes les données locales (compte, commandes, colis) et recrée le compte démo. */
export async function resetLocalData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  corePromise = null;
}
