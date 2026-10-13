/**
 * Adaptateur pour une passerelle d'API tierce de type « Onebound » (api-gw.onebound.cn),
 * qui expose des méthodes item_get / item_search pour Taobao, 1688, JD, Alibaba…
 *
 * ⚠️ À VÉRIFIER AVEC VOTRE CLÉ : la correspondance des champs ci-dessous suit le format
 * de réponse couramment documenté par ces passerelles (item.num_iid, item.title,
 * item.skus.sku[], items.item[]…), mais elle n'a pas pu être testée contre l'API réelle
 * lors du développement. Contrôlez une réponse brute avant la mise en production
 * et ajustez `mapItem` / `mapSearchItem` si besoin. Le parsing est volontairement défensif.
 *
 * Variables d'environnement : ONEBOUND_KEY, ONEBOUND_SECRET, ONEBOUND_BASE_URL (optionnel).
 */
import { buildSourceUrl } from '../lib/linkParser.js';
import type { Platform, ProductDetail, ProductSummary, SearchParams, SearchResult, Sku, SkuProp } from '../types.js';
import { ProviderError, type ProductProvider } from './types.js';
import { env, timeoutSignal } from '../lib/env.js';

type Json = Record<string, unknown>;

/** Nom de l'API côté passerelle pour chaque plateforme (Tmall passe par l'API Taobao). */
const API_NAME: Partial<Record<Platform, string>> = {
  taobao: 'taobao',
  tmall: 'taobao',
  '1688': '1688',
  alibaba: 'alibaba',
  jd: 'jd',
};

const SORT: Record<SearchParams['sort'], string> = {
  default: '',
  price_asc: 'price',
  price_desc: '_price',
  sales: '_sale',
};

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Les CDN Alibaba renvoient souvent des URL sans schéma (//img.alicdn.com/...). */
export function normalizeImageUrl(url: unknown): string {
  const u = str(url).trim();
  if (!u) return '';
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`;
  return u;
}

/**
 * Convertit les SKU au format « pid:vid;pid:vid » et props_list
 * { "1627207:28341": "颜色:黑色" } en propriétés structurées.
 */
export function mapSkus(item: Json): { props: SkuProp[]; skus: Sku[] } {
  const propsList = obj(item.props_list);
  const propsImg = obj(item.props_img);
  const propMap = new Map<string, SkuProp>();

  for (const [path, label] of Object.entries(propsList)) {
    const [pid, vid] = path.split(':');
    if (!pid || !vid) continue;
    const [name, value] = str(label).split(':');
    const prop = propMap.get(pid) ?? { pid, name: name || pid, values: [] };
    if (!prop.values.some((v) => v.vid === vid)) {
      prop.values.push({ vid, name: value || str(label), image: normalizeImageUrl(propsImg[path]) || undefined });
    }
    propMap.set(pid, prop);
  }

  const skus: Sku[] = arr(obj(item.skus).sku).map((raw, i) => {
    const s = obj(raw);
    const props: Record<string, string> = {};
    for (const pair of str(s.properties).split(';')) {
      const [pid, vid] = pair.split(':');
      if (pid && vid) props[pid] = vid;
    }
    return {
      skuId: str(s.sku_id) || String(i),
      props,
      price: num(s.price, num(item.price)),
      stock: num(s.quantity),
    };
  });

  return { props: [...propMap.values()], skus };
}

export function mapItem(platform: Platform, itemId: string, item: Json): ProductDetail {
  const { props, skus } = mapSkus(item);
  const images = arr(item.item_imgs)
    .map((i) => normalizeImageUrl(obj(i).url))
    .filter(Boolean);
  const mainImage = normalizeImageUrl(item.pic_url) || images[0] || '';
  const prices = skus.map((s) => s.price).filter((p) => p > 0);
  const price = prices.length ? Math.min(...prices) : num(item.price);
  const maxPrice = prices.length ? Math.max(...prices) : num(item.orginal_price ?? item.original_price, price);
  const seller = obj(item.seller_info);
  const attributes = arr(item.props)
    .map((p) => ({ name: str(obj(p).name), value: str(obj(p).value) }))
    .filter((a) => a.name);

  return {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title: str(item.title),
    titleOriginal: str(item.title_cn ?? item.title) || undefined,
    image: mainImage,
    images: images.length ? images : mainImage ? [mainImage] : [],
    price,
    priceMax: maxPrice > price ? maxPrice : undefined,
    sales: num(item.sales ?? item.total_sold, 0) || undefined,
    shopName: str(seller.shop_name ?? item.nick) || undefined,
    location: str(item.location) || undefined,
    moq: num(item.min_num, 0) || undefined,
    props,
    skus,
    // Les paliers de prix 1688 ne sont pas mappés : leur format n'a pas pu être vérifié.
    priceTiers: undefined,
    domesticShipping: num(item.post_fee ?? item.express_fee, 0),
    weightKg: num(item.item_weight, 0) || undefined,
    attributes,
    descriptionImages: arr(item.desc_img).map(normalizeImageUrl).filter(Boolean),
    descriptionText: undefined,
    seller: {
      name: str(seller.shop_name ?? seller.nick ?? item.nick) || 'Vendeur',
      location: str(item.location) || undefined,
    },
    sourceUrl: str(item.detail_url) || buildSourceUrl(platform, itemId),
    stock: num(item.num, skus.reduce((s, k) => s + k.stock, 0)),
    provider: 'onebound',
    isDemoData: false,
  };
}

export function mapSearchItem(platform: Platform, raw: unknown): ProductSummary | null {
  const i = obj(raw);
  const itemId = str(i.num_iid);
  if (!itemId) return null;
  return {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title: str(i.title),
    image: normalizeImageUrl(i.pic_url),
    price: num(i.promotion_price, num(i.price)) || num(i.price),
    sales: num(i.sales, 0) || undefined,
    shopName: str(i.nick ?? i.seller_nick) || undefined,
    location: str(i.area ?? i.location) || undefined,
  };
}

export class OneboundProvider implements ProductProvider {
  readonly name = 'onebound';
  readonly isDemo = false;
  readonly platforms: readonly Platform[] = ['taobao', 'tmall', '1688', 'alibaba', 'jd'];

  constructor(
    private readonly key: string,
    private readonly secret: string,
    private readonly baseUrl = env('ONEBOUND_BASE_URL') ?? 'https://api-gw.onebound.cn',
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async call(platform: Platform, method: string, params: Record<string, string | number | undefined>): Promise<Json> {
    const api = API_NAME[platform];
    if (!api) throw new ProviderError(`Plateforme ${platform} non prise en charge par ce fournisseur`, 400);
    const url = new URL(`/${api}/${method}/`, this.baseUrl);
    url.searchParams.set('key', this.key);
    url.searchParams.set('secret', this.secret);
    url.searchParams.set('lang', 'zh-CN');
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));

    const res = await this.fetcher(url, { signal: timeoutSignal(15000) });
    if (!res.ok) throw new ProviderError(`Fournisseur indisponible (HTTP ${res.status})`);
    const json = obj(await res.json());
    const error = str(json.error ?? json.error_code);
    if (error && error !== '0000') throw new ProviderError(`Erreur fournisseur : ${error} ${str(json.reason)}`.trim());
    return json;
  }

  async getProduct(platform: Platform, itemId: string): Promise<ProductDetail | null> {
    const json = await this.call(platform, 'item_get', { num_iid: itemId, is_promotion: 1 });
    const item = obj(json.item);
    if (!str(item.num_iid ?? item.title)) return null;
    return mapItem(platform, itemId, item);
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const platform = params.platform ?? 'taobao';
    const json = await this.call(platform, 'item_search', {
      q: params.q,
      page: params.page,
      page_size: params.pageSize,
      sort: SORT[params.sort],
      start_price: params.minPrice,
      end_price: params.maxPrice,
      cat: params.category,
    });
    const items = obj(json.items);
    const list = arr(items.item)
      .map((i) => mapSearchItem(platform, i))
      .filter((i): i is ProductSummary => i !== null);
    const total = num(items.real_total_results ?? items.total_results, list.length);
    return {
      items: list,
      page: params.page,
      pageSize: params.pageSize,
      total,
      hasMore: params.page * params.pageSize < total,
      provider: this.name,
      isDemoData: false,
    };
  }
}
