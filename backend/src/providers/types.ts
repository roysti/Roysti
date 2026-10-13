import type { Platform, ProductDetail, SearchParams, SearchResult } from '../types.js';

/**
 * Source de données produits. L'application ne dépend que de cette interface :
 * on peut brancher un catalogue de démo, une API tierce (Onebound, TMAPI, OTAPI…)
 * ou l'API officielle Taobao Open Platform si vous obtenez un accès.
 */
export interface ProductProvider {
  readonly name: string;
  readonly isDemo: boolean;
  readonly platforms: readonly Platform[];
  search(params: SearchParams): Promise<SearchResult>;
  /** `fresh` : données à jour exigées (paiement) — pas de cache, ni chez nous ni chez le fournisseur. */
  getProduct(platform: Platform, itemId: string, options?: GetProductOptions): Promise<ProductDetail | null>;
}

export interface GetProductOptions {
  fresh?: boolean;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}
