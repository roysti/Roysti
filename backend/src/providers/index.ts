import { config } from '../config.js';
import { env } from '../lib/env.js';
import { CachedProvider } from './cached.js';
import { MockProvider } from './mock.js';
import { OneboundProvider, type OneboundLang } from './onebound.js';
import { TmapiProvider, type TmapiLanguage } from './tmapi.js';
import type { ProductProvider } from './types.js';

export type ProviderName = 'mock' | 'onebound' | 'tmapi';
export const PROVIDER_NAMES: readonly ProviderName[] = ['mock', 'onebound', 'tmapi'];

/** Réglages d'un fournisseur d'articles (variables d'environnement côté serveur, Réglages côté téléphone). */
export interface ProviderSettings {
  provider: ProviderName;
  onebound?: { key: string; secret: string; baseUrl?: string; lang?: OneboundLang };
  tmapi?: { token: string; baseUrl?: string; language?: TmapiLanguage };
}

export class ProviderConfigError extends Error {}

/** Crée le fournisseur décrit par les réglages ; les vrais fournisseurs passent par le cache. */
export function providerFromSettings(settings: ProviderSettings, fetcher?: typeof fetch): ProductProvider {
  if (settings.provider === 'onebound') {
    const o = settings.onebound;
    if (!o?.key?.trim() || !o.secret?.trim()) throw new ProviderConfigError('Onebound nécessite une clé (key) et un secret.');
    return new CachedProvider(new OneboundProvider({ key: o.key.trim(), secret: o.secret.trim(), baseUrl: o.baseUrl?.trim() || undefined, lang: o.lang, fetcher }));
  }
  if (settings.provider === 'tmapi') {
    const t = settings.tmapi;
    if (!t?.token?.trim()) throw new ProviderConfigError('TMAPI nécessite un apiToken.');
    return new CachedProvider(new TmapiProvider({ token: t.token.trim(), baseUrl: t.baseUrl?.trim() || undefined, language: t.language, fetcher }));
  }
  return new MockProvider();
}

const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

/** Réglages lus dans l'environnement du serveur (PRODUCT_PROVIDER, ONEBOUND_*, TMAPI_*). */
export function settingsFromEnv(name = config.provider): ProviderSettings {
  const provider = oneOf(name, PROVIDER_NAMES);
  if (!provider) throw new ProviderConfigError(`PRODUCT_PROVIDER inconnu : ${name} (valeurs possibles : ${PROVIDER_NAMES.join(', ')})`);
  return {
    provider,
    onebound: {
      key: env('ONEBOUND_KEY') ?? '',
      secret: env('ONEBOUND_SECRET') ?? '',
      baseUrl: env('ONEBOUND_BASE_URL'),
      lang: oneOf(env('ONEBOUND_LANG'), ['cn', 'en', 'ru'] as const),
    },
    tmapi: {
      token: env('TMAPI_API_TOKEN') ?? '',
      baseUrl: env('TMAPI_BASE_URL'),
      language: oneOf(env('TMAPI_LANGUAGE'), ['zh', 'en'] as const),
    },
  };
}

export function createProvider(name = config.provider): ProductProvider {
  return providerFromSettings(settingsFromEnv(name));
}

export { CachedProvider, MockProvider, OneboundProvider, TmapiProvider };
export type { ProductProvider };
