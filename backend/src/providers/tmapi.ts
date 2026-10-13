/**
 * Adaptateur TMAPI (https://tmapi.top, jeton dans la console : https://console.tmapi.io/account/center).
 *
 * - 1688 : recherche par mot-clé (/1688/search/items), détail (/1688/item_detail) et images
 *   de description (/1688/item_desc). Correspondance établie à partir de copies de la
 *   documentation officielle (exemples de réponse JSON) et de quatre clients indépendants.
 * - Taobao / Tmall : détail seulement (/taobao/item_detail, /taobao/item_desc). TMAPI ne
 *   propose pas de recherche Taobao par mot-clé ; le format de réponse Taobao a été
 *   reconstitué à partir de clients existants (aucune réponse brute vue) : parsing défensif.
 *
 * Authentification : apiToken en paramètre de requête. Enveloppe : { code: 200, msg, data }.
 * Variables d'environnement : TMAPI_API_TOKEN, TMAPI_BASE_URL, TMAPI_LANGUAGE.
 */
import { buildSourceUrl } from '../lib/linkParser.js';
import { timeoutSignal } from '../lib/env.js';
import type { Platform, PriceTier, ProductDetail, ProductSummary, SearchParams, SearchResult, Sku, SkuProp } from '../types.js';
import { ProviderError, type ProductProvider } from './types.js';
import { arr, buildUrl, normalizeImageUrl, num, obj, parsePropPath, positive, redact, str, type Json } from './util.js';

/** La documentation utilise api.tmapi.io ; https://api.tmapi.top a un certificat qui ne correspond pas toujours. */
export const TMAPI_DEFAULT_BASE_URL = 'https://api.tmapi.io';

const SORT: Record<SearchParams['sort'], string> = {
  default: 'default',
  price_asc: 'price_up',
  price_desc: 'price_down',
  sales: 'sales',
};

/** Langues proposées par TMAPI pour les titres (pas de français). */
export type TmapiLanguage = 'zh' | 'en';

export interface TmapiOptions {
  token: string;
  baseUrl?: string;
  language?: TmapiLanguage;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

/** Codes documentés (corps { code, msg }). */
const ERRORS: Record<number, { message: string; status: number }> = {
  401: { message: 'Jeton TMAPI refusé ou expiré. Copiez l’apiToken depuis la console TMAPI.', status: 401 },
  422: { message: 'Paramètre refusé par TMAPI', status: 400 },
  439: { message: 'Abonnement TMAPI expiré ou solde insuffisant.', status: 402 },
  503: { message: 'Trop de requêtes simultanées chez TMAPI. Réessayez dans un instant.', status: 429 },
};
/** 417 (échec de récupération) et 499 (délai dépassé) : la doc conseille de réessayer. */
const RETRYABLE = new Set([417, 499]);

/** product_props : tableau d'objets à une seule clé [{ "材质": "棉" }]. */
function mapAttributes(raw: unknown): { name: string; value: string }[] {
  return arr(raw).flatMap((o) =>
    Object.entries(obj(o))
      .map(([name, value]) => ({ name, value: str(value) }))
      .filter((a) => a.name && a.value),
  );
}

function mapProps(raw: unknown): SkuProp[] {
  return arr(raw)
    .map((p) => {
      const prop = obj(p);
      return {
        pid: str(prop.pid),
        name: str(prop.prop_name) || str(prop.pid),
        values: arr(prop.values)
          .map((v) => {
            const value = obj(v);
            return { vid: str(value.vid), name: str(value.name), image: normalizeImageUrl(value.imageUrl) || undefined };
          })
          .filter((v) => v.vid !== ''),
      };
    })
    .filter((p) => p.pid !== '' && p.values.length > 0);
}

function mapSkuList(raw: unknown, fallbackPrice: number): Sku[] {
  return arr(raw).map((s, i) => {
    const sku = obj(s);
    return {
      skuId: str(sku.skuid ?? sku.sku_id) || String(i),
      props: parsePropPath(sku.props_ids),
      price: num(sku.sale_price, fallbackPrice) || fallbackPrice,
      stock: num(sku.stock ?? sku.quantity),
    };
  });
}

/** Paliers 1688 : tiered_price_info.prices (ou sku_price_range.sku_param) [{ beginAmount, price }]. */
function mapTiers(data: Json): PriceTier[] | undefined {
  const source = arr(obj(data.tiered_price_info).prices).length ? obj(data.tiered_price_info).prices : obj(data.sku_price_range).sku_param;
  const tiers = arr(source)
    .map((t) => ({ minQty: num(obj(t).beginAmount), price: num(obj(t).price) }))
    .filter((t) => t.minQty > 0 && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
  return tiers.length > 1 ? tiers : undefined;
}

export function mapTmapiItem(platform: Platform, itemId: string, data: Json, descriptionImages: string[] = []): ProductDetail {
  const priceInfo = obj(data.price_info);
  const basePrice = num(priceInfo.price_min, num(priceInfo.price));
  const skus = mapSkuList(data.skus, basePrice);
  const priceTiers = platform === '1688' ? mapTiers(data) : undefined;
  const prices = [...skus.map((s) => s.price), ...(priceTiers ?? []).map((t) => t.price)].filter((p) => p > 0);
  const price = prices.length ? Math.min(...prices) : basePrice;
  const maxPrice = prices.length ? Math.max(...prices) : num(priceInfo.price_max, price);
  const images = arr(data.main_imgs).map(normalizeImageUrl).filter(Boolean);
  const shop = obj(data.shop_info);
  const delivery = obj(data.delivery_info);
  const location = str(delivery.location) || undefined;
  const pkg = obj(obj(arr(data.skus)[0]).package_info);
  const weight = positive(pkg.weight) ?? positive(delivery.unit_weight);
  const dims =
    positive(pkg.length) && positive(pkg.width) && positive(pkg.height)
      ? { lengthCm: num(pkg.length), widthCm: num(pkg.width), heightCm: num(pkg.height) }
      : undefined;
  const skuStock = skus.reduce((sum, s) => sum + s.stock, 0);
  const moq = positive(obj(data.tiered_price_info).begin_num) ?? positive(obj(data.sku_price_range).begin_num);

  return {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title: str(data.title),
    titleOriginal: str(data.title_origin) || undefined,
    image: images[0] ?? '',
    images,
    price,
    priceMax: maxPrice > price ? maxPrice : undefined,
    sales: positive(obj(data.sale_info).sale_quantity_90days) ?? positive(data.sale_count),
    shopName: str(shop.shop_name) || undefined,
    location,
    moq: platform === '1688' ? moq : undefined,
    props: mapProps(data.sku_props),
    skus,
    priceTiers,
    domesticShipping: num(delivery.delivery_fee),
    weightKg: weight,
    packageDims: dims,
    attributes: mapAttributes(data.product_props),
    descriptionImages,
    descriptionText: undefined,
    seller: { name: str(shop.shop_name ?? shop.seller_login_id) || 'Vendeur', location },
    sourceUrl: str(data.product_url) || buildSourceUrl(platform, itemId),
    stock: skus.length ? skuStock : num(data.stock ?? obj(data.sku_price_range).stock),
    provider: 'tmapi',
    isDemoData: false,
  };
}

export function mapTmapiSearchItem(raw: unknown): ProductSummary | null {
  const i = obj(raw);
  const itemId = str(i.item_id);
  if (!itemId) return null;
  const shop = obj(i.shop_info);
  const priceInfo = obj(i.price_info);
  return {
    id: `1688:${itemId}`,
    platform: '1688',
    itemId,
    title: str(i.title),
    titleOriginal: str(i.title_origin) || undefined,
    image: normalizeImageUrl(i.img),
    price: num(i.price, num(priceInfo.sale_price ?? priceInfo.price)),
    sales: positive(obj(i.sale_info).sale_quantity_int) ?? positive(obj(i.sale_info).sale_quantity_90days),
    shopName: str(shop.company_name ?? shop.login_id) || undefined,
    location: arr(obj(i.delivery_info).area_from).map(str).join(' ') || undefined,
    moq: positive(i.moq ?? i.quantity_begin),
  };
}

export class TmapiProvider implements ProductProvider {
  readonly name = 'tmapi';
  readonly isDemo = false;
  readonly platforms: readonly Platform[] = ['1688', 'taobao', 'tmall'];
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: TmapiOptions) {
    this.baseUrl = options.baseUrl || TMAPI_DEFAULT_BASE_URL;
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    // La doc recommande 60 s (code 499 sinon).
    this.timeoutMs = options.timeoutMs ?? 60000;
  }

  /** Renvoie null pour un article introuvable (code 404). */
  private async call(path: string, params: Record<string, string | number | undefined>, attempt = 1): Promise<Json | null> {
    const url = buildUrl(this.baseUrl, path, { apiToken: this.options.token, ...params });
    let res: Response;
    try {
      res = await this.fetcher(url, { signal: timeoutSignal(this.timeoutMs), headers: { Accept: 'application/json' } });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ProviderError(`TMAPI injoignable : ${redact(reason, this.options.token)}`, 504);
    }
    let json: Json = {};
    try {
      json = obj(await res.json());
    } catch {
      if (res.ok) throw new ProviderError('Réponse TMAPI illisible');
    }
    const code = num(json.code, res.ok ? 200 : res.status);
    if (code === 200) return obj(json.data);
    if (code === 404) return null;
    if (RETRYABLE.has(code) && attempt === 1) return this.call(path, params, 2);
    const known = ERRORS[code];
    const detail = redact(str(json.msg ?? json.message), this.options.token);
    if (known) throw new ProviderError(code === 422 && detail ? `${known.message} : ${detail}` : known.message, known.status);
    throw new ProviderError(`Erreur TMAPI ${code}${detail ? ` : ${detail}` : ''}`);
  }

  async getProduct(platform: Platform, itemId: string): Promise<ProductDetail | null> {
    if (!this.platforms.includes(platform)) throw new ProviderError(`TMAPI ne couvre pas ${platform} (1688, Taobao et Tmall seulement).`, 400);
    const api = platform === '1688' ? '1688' : 'taobao';
    const language = this.options.language ?? 'zh';
    const [detail, desc] = await Promise.allSettled([
      this.call(`/${api}/item_detail`, { item_id: itemId, ...(api === '1688' ? { language } : {}) }),
      this.call(`/${api}/item_desc`, { item_id: itemId }),
    ]);
    if (detail.status === 'rejected') throw detail.reason;
    if (!detail.value || (!str(detail.value.item_id) && !str(detail.value.title))) return null;
    const descriptionImages = desc.status === 'fulfilled' ? arr(desc.value?.detail_imgs).map(normalizeImageUrl).filter(Boolean) : [];
    return mapTmapiItem(platform, itemId, detail.value, descriptionImages);
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (params.platform && params.platform !== '1688') {
      throw new ProviderError('TMAPI ne propose pas la recherche Taobao/Tmall : cherchez sur 1688, ou collez le lien d’un article Taobao.', 400);
    }
    const pageSize = Math.min(params.pageSize, 20);
    const data = await this.call('/1688/search/items', {
      keyword: params.q,
      page: params.page,
      page_size: pageSize,
      sort: SORT[params.sort],
      price_start: params.minPrice,
      price_end: params.maxPrice,
    });
    const items = arr(data?.items)
      .map(mapTmapiSearchItem)
      .filter((i): i is ProductSummary => i !== null);
    const total = num(data?.total_count, items.length);
    return {
      items,
      page: params.page,
      pageSize,
      total,
      hasMore: data?.has_next_page === true || (data?.has_next_page === undefined && params.page * pageSize < total),
      provider: this.name,
      isDemoData: false,
    };
  }
}
