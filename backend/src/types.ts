/** Plateformes chinoises prises en charge. */
export const PLATFORMS = ['taobao', 'tmall', '1688', 'alibaba', 'jd', 'weidian'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  taobao: 'Taobao',
  tmall: 'Tmall',
  '1688': '1688',
  alibaba: 'Alibaba',
  jd: 'JD.com',
  weidian: 'Weidian',
};

export type SortOrder = 'default' | 'price_asc' | 'price_desc' | 'sales';

export interface SearchParams {
  q: string;
  platform?: Platform;
  category?: string;
  page: number;
  pageSize: number;
  sort: SortOrder;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductSummary {
  /** Identifiant global « plateforme:idArticle ». */
  id: string;
  platform: Platform;
  itemId: string;
  /** Titre traduit (français). */
  title: string;
  /** Titre d'origine (chinois) tel que publié par le vendeur. */
  titleOriginal?: string;
  image: string;
  /** Prix minimum en CNY. */
  price: number;
  /** Prix maximum en CNY quand le prix varie selon le SKU. */
  priceMax?: number;
  /** Ventes (mensuelles ou cumulées selon la plateforme). */
  sales?: number;
  shopName?: string;
  location?: string;
  /** Quantité minimale de commande (1688 / Alibaba). */
  moq?: number;
  category?: string;
}

export interface SkuPropValue {
  vid: string;
  name: string;
  image?: string;
}

export interface SkuProp {
  pid: string;
  name: string;
  values: SkuPropValue[];
}

export interface Sku {
  skuId: string;
  /** Combinaison pid → vid, ex. { "1627207": "28341", "20509": "28315" }. */
  props: Record<string, string>;
  price: number;
  stock: number;
}

export interface PriceTier {
  minQty: number;
  price: number;
}

export interface Seller {
  name: string;
  rating?: number;
  location?: string;
  years?: number;
}

export interface ProductDetail extends ProductSummary {
  images: string[];
  props: SkuProp[];
  skus: Sku[];
  /** Prix dégressifs par quantité (vente en gros). */
  priceTiers?: PriceTier[];
  /** Frais de port intérieurs Chine (vendeur → entrepôt), en CNY. */
  domesticShipping: number;
  /** Poids estimé d'une unité, en kg. */
  weightKg?: number;
  /** Dimensions estimées d'une unité emballée, en cm. */
  packageDims?: { lengthCm: number; widthCm: number; heightCm: number };
  attributes: { name: string; value: string }[];
  descriptionImages: string[];
  descriptionText?: string;
  seller: Seller;
  sourceUrl: string;
  stock: number;
  /** Article sensible (batterie, liquide…) : seules certaines lignes l'acceptent. Inconnu si absent. */
  sensitive?: boolean;
  /** Nom du fournisseur de données (mock, onebound…). */
  provider: string;
  /** Vrai si les données sont fictives (mode démo). */
  isDemoData: boolean;
}

export interface SearchResult {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  provider: string;
  isDemoData: boolean;
  /** Mots-clés réellement envoyés au fournisseur (traduits en chinois). */
  query?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
}
