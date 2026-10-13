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
  getProduct(platform: Platform, itemId: string): Promise<ProductDetail | null>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}
