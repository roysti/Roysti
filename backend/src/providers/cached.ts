import type { Platform, ProductDetail, SearchParams, SearchResult } from '../types.js';
import type { ProductProvider } from './types.js';

interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

export interface CacheOptions {
  /** Durée de vie d'une recherche (ms). */
  searchTtlMs?: number;
  /** Durée de vie d'une fiche article (ms). */
  productTtlMs?: number;
  /** Nombre maximal d'entrées conservées (les plus anciennes sont évincées). */
  maxEntries?: number;
  now?: () => number;
}

/**
 * Cache mémoire devant un fournisseur payant : les API (Onebound, TMAPI…) facturent
 * chaque appel, y compris ceux en échec. Les requêtes identiques simultanées partagent
 * le même appel, et les erreurs ne sont jamais mises en cache.
 */
export class CachedProvider implements ProductProvider {
  private readonly entries = new Map<string, Entry<unknown>>();
  private readonly searchTtlMs: number;
  private readonly productTtlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    readonly inner: ProductProvider,
    options: CacheOptions = {},
  ) {
    this.searchTtlMs = options.searchTtlMs ?? 10 * 60_000;
    this.productTtlMs = options.productTtlMs ?? 30 * 60_000;
    this.maxEntries = options.maxEntries ?? 300;
    this.now = options.now ?? (() => Date.now());
  }

  get name() {
    return this.inner.name;
  }
  get isDemo() {
    return this.inner.isDemo;
  }
  get platforms() {
    return this.inner.platforms;
  }

  get size() {
    return this.entries.size;
  }

  /** Copie indépendante : un appelant qui modifierait le résultat ne doit pas altérer le cache. */
  private remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    return this.shared(key, ttlMs, load).then((v) => (v === null || v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)));
  }

  private shared<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = this.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > now) {
      // Réinsertion : l'entrée devient la plus récente (éviction LRU).
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit.value as Promise<T>;
    }
    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + ttlMs });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return value;
  }

  search(params: SearchParams): Promise<SearchResult> {
    const key = `s:${JSON.stringify([params.platform ?? '', params.q, params.category ?? '', params.page, params.pageSize, params.sort, params.minPrice ?? '', params.maxPrice ?? ''])}`;
    return this.remember(key, this.searchTtlMs, () => this.inner.search(params));
  }

  getProduct(platform: Platform, itemId: string): Promise<ProductDetail | null> {
    return this.remember(`p:${platform}:${itemId}`, this.productTtlMs, () => this.inner.getProduct(platform, itemId));
  }

  clear() {
    this.entries.clear();
  }
}
