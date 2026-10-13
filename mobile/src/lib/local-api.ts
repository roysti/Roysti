// En premier : configure zod avant l'évaluation des modules du backend qui créent des schémas.
import './zod-setup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCore, type ApiRequest, type ApiResponse, type Core } from '../../../backend/src/core/api';
import { providerFromSettings } from '../../../backend/src/providers/index';
import { MockProvider } from '../../../backend/src/providers/mock';
import type { ProductProvider } from '../../../backend/src/providers/types';
import { Store, type Data } from '../../../backend/src/store/db';
import { mobileRuntime } from './local-runtime';
import { loadProviderSettings, saveProviderSettings, type ProviderSettings } from './provider-settings';

/**
 * API embarquée : la même logique que le serveur (backend/src/core/api.ts),
 * exécutée directement sur le téléphone. Les articles viennent du catalogue de
 * démonstration ou, si une clé a été saisie dans les Réglages, d'une vraie API
 * (Onebound, TMAPI) appelée directement depuis le téléphone.
 * Les données (compte, commandes, colis…) sont conservées dans AsyncStorage.
 */
const STORAGE_KEY = 'roysti.localdb.v1';

let storePromise: Promise<Store> | null = null;
let corePromise: Promise<Core> | null = null;

/** `ok: false` = lecture impossible : on ne doit surtout pas écraser les données existantes. */
async function loadData(): Promise<{ ok: boolean; data?: Partial<Data> }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return { ok: true, data: raw ? (JSON.parse(raw) as Partial<Data>) : undefined };
  } catch (err) {
    console.warn('Données locales illisibles : session temporaire sans enregistrement', err);
    return { ok: false };
  }
}

/** Le stockage est partagé : changer de fournisseur ne recharge pas les données. */
function getStore(): Promise<Store> {
  storePromise ??= loadData().then(
    ({ ok, data }) =>
      new Store({
        uuid: mobileRuntime.uuid,
        initial: data,
        persist: ok
          ? (snapshot) => {
              AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
            }
          : undefined,
        // Écriture immédiate : l'application peut être fermée à tout moment.
        persistDelayMs: 0,
      }),
  );
  return storePromise;
}

/** Réglages invalides ou incomplets : on garde le catalogue de démonstration. */
function safeProvider(settings: ProviderSettings): ProductProvider {
  try {
    return providerFromSettings(settings);
  } catch (err) {
    console.warn('Fournisseur d’articles mal configuré : catalogue de démonstration', err);
    return new MockProvider();
  }
}

function getCore(): Promise<Core> {
  corePromise ??= Promise.all([getStore(), loadProviderSettings()]).then(([store, settings]) =>
    createCore({ store, provider: safeProvider(settings), runtime: mobileRuntime, demoMode: true }),
  );
  return corePromise;
}

export async function localRequest(request: ApiRequest): Promise<ApiResponse> {
  const core = await getCore();
  // Connexion / inscription : le calcul PBKDF2 bloque le fil JS ~1 s sur téléphone.
  // On rend d'abord la main à l'interface pour qu'elle affiche l'indicateur de chargement.
  if (request.path.startsWith('/auth/')) await new Promise((resolve) => setTimeout(resolve, 32));
  const response = await core.handle(request);
  // Copie profonde : l'interface ne doit jamais partager d'objets avec le stockage
  // (même comportement qu'une vraie réponse réseau).
  return response.body === undefined ? response : { status: response.status, body: JSON.parse(JSON.stringify(response.body)) };
}

/** Efface toutes les données locales (compte, commandes, colis) et recrée le compte démo. */
export async function resetLocalData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  storePromise = null;
  corePromise = null;
}

export interface ProviderTestResult {
  message: string;
  sample?: { title: string; price: number; image: string; platform: string };
}

/**
 * Vérifie des réglages avant de les enregistrer : une petite recherche (un appel facturé).
 * Lève une erreur au message lisible si la clé est refusée ou l'API injoignable.
 */
export async function testProviderSettings(settings: ProviderSettings): Promise<ProviderTestResult> {
  const provider = providerFromSettings(settings);
  if (provider.isDemo) return { message: 'Catalogue de démonstration : aucune clé nécessaire.' };
  // Plateforme par défaut du fournisseur (OTAPI bascule sur 1688 si la clé n'est abonnée qu'à « Otapi 1688 »).
  const result = await provider.search({ q: '手机壳', page: 1, pageSize: 1, sort: 'default' });
  const sample = result.items[0];
  return {
    message: sample ? `Connexion réussie : ${result.total.toLocaleString('fr-FR')} articles trouvés.` : 'Connexion réussie, mais la recherche de test est vide.',
    sample: sample ? { title: sample.title, price: sample.price, image: sample.image, platform: sample.platform } : undefined,
  };
}

/** Enregistre les réglages et reconstruit l'API embarquée avec le nouveau fournisseur. */
export async function applyProviderSettings(settings: ProviderSettings): Promise<void> {
  // Réglages incomplets (clé vide…) : erreur explicite plutôt qu'un retour silencieux à la démo.
  providerFromSettings(settings);
  await saveProviderSettings(settings);
  corePromise = null;
}
