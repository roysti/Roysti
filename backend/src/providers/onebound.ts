/**
 * Adaptateur pour la passerelle Onebound (万邦, https://open.onebound.cn) :
 * GET https://api-gw.onebound.cn/{api}/{item_get|item_search}/?key=…&secret=…
 *
 * Correspondance des champs établie à partir de réponses brutes réelles publiées
 * (taobao/item_get capturées en octobre 2026, 1688/item_get et item_search en anglais)
 * et de la documentation officielle (paramètres communs, valeurs de tri, codes d'erreur).
 * Taobao/Tmall et 1688 sont donc vérifiés sur des réponses réelles ; JD, Alibaba.com et
 * Weidian (« micro ») suivent le même format d'après la doc, mais aucune réponse brute
 * n'a été vue : le parsing reste défensif.
 *
 * ⚠️ Chez Onebound, les appels en échec sont aussi facturés : l'application met les
 * réponses en cache (voir cached.ts) et n'envoie jamais de paramètre inutile.
 *
 * Variables d'environnement : ONEBOUND_KEY, ONEBOUND_SECRET, ONEBOUND_BASE_URL, ONEBOUND_LANG.
 */
import { buildSourceUrl } from '../lib/linkParser.js';
import { getRates } from '../lib/currency.js';
import { timeoutSignal } from '../lib/env.js';
import type { Platform, PriceTier, ProductDetail, ProductSummary, SearchParams, SearchResult, Sku, SkuProp } from '../types.js';
import { ProviderError, type GetProductOptions, type ProductProvider } from './types.js';
import { arr, buildUrl, normalizeImageUrl, num, obj, parsePropPath, positive, redact, str, type Json } from './util.js';

export { normalizeImageUrl };

export const ONEBOUND_DEFAULT_BASE_URL = 'https://api-gw.onebound.cn';

/** Nom de l'API côté passerelle pour chaque plateforme (Tmall passe par l'API Taobao). */
const API_NAME: Record<Platform, string> = {
  taobao: 'taobao',
  tmall: 'taobao',
  '1688': '1688',
  alibaba: 'alibaba',
  jd: 'jd',
  weidian: 'micro',
};

/**
 * Tri documenté : bid (prix total), bid2 (prix de l'article), _sale (ventes), _credit
 * (réputation) ; le préfixe « _ » trie du plus grand au plus petit.
 */
const SORT: Record<SearchParams['sort'], string | undefined> = {
  default: undefined,
  price_asc: 'bid2',
  price_desc: '_bid2',
  sales: '_sale',
};

/** Langue des titres renvoyés : cn (chinois d'origine, par défaut), en ou ru (traduits par Onebound). */
export type OneboundLang = 'cn' | 'en' | 'ru';

export interface OneboundOptions {
  key: string;
  secret: string;
  baseUrl?: string;
  lang?: OneboundLang;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  /** Nombre de CNY pour 1 USD (Alibaba.com) ; par défaut, le taux du jour (ou de secours). */
  usdToCny?: () => Promise<number>;
}

/** Taux du jour : les taux de l'application sont exprimés pour 1 CNY. */
async function defaultUsdToCny(): Promise<number> {
  const { rates } = await getRates();
  return rates.USD ? 1 / rates.USD : 7.2;
}

/** Onebound renvoie -1 (ou 0) quand le prix est inconnu : on le ramène à 0 (« prix indisponible »). */
const priceOf = (v: unknown): number => Math.max(0, num(v));

/** Pixel de suivi inséré par la passerelle dans les images de description. */
const isTrackingPixel = (url: string) => /(^|\/\/)(www\.)?o0b\.cn\//i.test(url);

/** « 颜色分类:乳白色 » → ['颜色分类', '乳白色'] (seul le premier « : » sépare le nom de la valeur). */
function splitLabel(label: string): [string, string] {
  const i = label.indexOf(':');
  return i < 0 ? ['', label] : [label.slice(0, i), label.slice(i + 1)];
}

/**
 * Propriétés de SKU à partir de props_list { "1627207:28341": "颜色:黑色" }, ou à défaut
 * de props_name « pid:vid:nom:valeur;… ». Images : props_img (objet, parfois tableau vide)
 * ou prop_imgs.prop_img[] { properties, url }.
 */
export function mapSkus(item: Json): { props: SkuProp[]; skus: Sku[] } {
  const images = new Map<string, string>();
  for (const [path, url] of Object.entries(obj(item.props_img))) images.set(path, normalizeImageUrl(url));
  for (const raw of arr(obj(item.prop_imgs).prop_img)) {
    const p = obj(raw);
    if (str(p.properties) && !images.get(str(p.properties))) images.set(str(p.properties), normalizeImageUrl(p.url));
  }

  const labels: [string, string][] = Object.entries(obj(item.props_list)).map(([path, label]) => [path, str(label)]);
  if (!labels.length) {
    for (const part of str(item.props_name).split(';')) {
      const [pid, vid, ...rest] = part.split(':');
      if (pid && vid && rest.length) labels.push([`${pid}:${vid}`, rest.join(':')]);
    }
  }

  const propMap = new Map<string, SkuProp>();
  for (const [path, label] of labels) {
    const [pid, vid] = path.split(':');
    if (!pid || !vid) continue;
    const [name, value] = splitLabel(label);
    const prop = propMap.get(pid) ?? { pid, name: name || pid, values: [] };
    if (!prop.values.some((v) => v.vid === vid)) prop.values.push({ vid, name: value || label, image: images.get(path) || undefined });
    propMap.set(pid, prop);
  }

  const fallbackPrice = priceOf(item.price);
  const skus: Sku[] = arr(obj(item.skus).sku).map((raw, i) => {
    const s = obj(raw);
    return {
      skuId: str(s.sku_id) || String(i),
      props: parsePropPath(s.properties),
      price: priceOf(s.price) || fallbackPrice,
      stock: num(s.quantity),
    };
  });

  return { props: [...propMap.values()], skus };
}

/** Paliers 1688 : priceRange = [["1","14.50"],["500","14.00"]] (quantité minimale, prix unitaire). */
export function mapPriceTiers(item: Json): PriceTier[] | undefined {
  const tiers = arr(item.priceRange)
    .map((t) => {
      const pair = arr(t);
      return { minQty: num(pair[0]), price: priceOf(pair[1]) };
    })
    .filter((t) => t.minQty > 0 && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
  return tiers.length > 1 ? tiers : undefined;
}

/**
 * @param usdToCny taux de conversion appliqué quand l'article est en dollars
 *   (Alibaba.com : currency_code « USD ») ; les prix de l'application sont en CNY.
 */
export function mapItem(platform: Platform, itemId: string, item: Json, provider = 'onebound', usdToCny?: number): ProductDetail {
  const { props, skus } = mapSkus(item);
  const images = arr(item.item_imgs)
    .map((i) => normalizeImageUrl(obj(i).url))
    .filter(Boolean);
  const mainImage = normalizeImageUrl(item.pic_url) || images[0] || '';
  const priceTiers = mapPriceTiers(item);
  const prices = skus.map((s) => s.price).filter((p) => p > 0);
  const tierPrices = (priceTiers ?? []).map((t) => t.price);
  const allPrices = prices.length ? prices : tierPrices;
  const price = allPrices.length ? Math.min(...allPrices) : priceOf(item.price);
  // orginal_price est un prix barré, pas un maximum : seul l'écart entre SKU/paliers compte.
  const maxPrice = allPrices.length ? Math.max(...allPrices) : price;
  const seller = obj(item.seller_info);
  const attributes = arr(item.props)
    .map((p) => ({ name: str(obj(p).name), value: str(obj(p).value) }))
    .filter((a) => a.name && a.value);
  const title = str(item.title);
  const titleOriginal = str(item.title_cn ?? item.title_origin);
  const location = str(item.location) || undefined;
  const skuStock = skus.reduce((sum, k) => sum + k.stock, 0);

  const detail: ProductDetail = {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title,
    titleOriginal: titleOriginal && titleOriginal !== title ? titleOriginal : undefined,
    image: mainImage,
    images: images.length ? images : mainImage ? [mainImage] : [],
    price,
    priceMax: maxPrice > price ? maxPrice : undefined,
    sales: positive(item.sales) ?? positive(item.total_sold),
    shopName: str(seller.shop_name ?? item.nick) || undefined,
    location,
    moq: positive(item.min_num),
    props,
    skus,
    priceTiers,
    // post_fee / express_fee valent 0, '' ou null quand le port est offert ou non renseigné.
    domesticShipping: positive(item.express_fee) ?? positive(item.post_fee) ?? 0,
    weightKg: positive(item.item_weight),
    attributes,
    descriptionImages: arr(item.desc_img)
      .map(normalizeImageUrl)
      .filter((u) => u && !isTrackingPixel(u)),
    descriptionText: undefined,
    seller: {
      name: str(seller.shop_name ?? seller.title ?? seller.nick ?? item.nick) || 'Vendeur',
      location,
    },
    sourceUrl: str(item.detail_url) || buildSourceUrl(platform, itemId),
    stock: skus.length ? skuStock : num(item.num),
    provider,
    isDemoData: false,
  };
  return str(item.currency_code).toUpperCase() === 'USD' && usdToCny ? convertDetail(detail, usdToCny) : detail;
}

const toCny = (usd: number, rate: number) => Math.round(usd * rate * 100) / 100;

/** Alibaba.com affiche ses prix en dollars : conversion en CNY au taux du jour (indicatif). */
function convertDetail(p: ProductDetail, rate: number): ProductDetail {
  return {
    ...p,
    price: toCny(p.price, rate),
    priceMax: p.priceMax === undefined ? undefined : toCny(p.priceMax, rate),
    skus: p.skus.map((s) => ({ ...s, price: toCny(s.price, rate) })),
    priceTiers: p.priceTiers?.map((t) => ({ ...t, price: toCny(t.price, rate) })),
    attributes: [...p.attributes, { name: 'Prix d’origine', value: `en dollars US, convertis au taux de 1 USD = ${rate.toFixed(4)} CNY` }],
  };
}

export function mapSearchItem(platform: Platform, raw: unknown, usdToCny?: number): ProductSummary | null {
  const i = obj(raw);
  const itemId = str(i.num_iid);
  if (!itemId) return null;
  const rate = usdToCny ?? 1;
  const price = priceOf(i.promotion_price) || priceOf(i.price);
  const original = priceOf(i.orginal_price ?? i.price);
  return {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title: str(i.title),
    image: normalizeImageUrl(i.pic_url),
    price: Math.round(price * rate * 100) / 100,
    priceMax: original > price ? Math.round(original * rate * 100) / 100 : undefined,
    sales: positive(i.sales),
    shopName: str(i.nick ?? i.seller_nick) || undefined,
    location: str(i.area ?? i.location) || undefined,
  };
}

/** Codes d'erreur documentés par Onebound (error_code). */
const ERRORS: Record<string, { message: string; status: number }> = {
  '4005': { message: 'Clé ou secret Onebound refusés (4005). Vérifiez vos identifiants.', status: 401 },
  '4013': { message: 'Quota Onebound épuisé (4013). Rechargez votre compte ou attendez le renouvellement.', status: 429 },
  '5000': { message: 'Erreur inconnue chez Onebound (5000). Réessayez plus tard.', status: 502 },
};

export class OneboundProvider implements ProductProvider {
  readonly name = 'onebound';
  readonly isDemo = false;
  readonly platforms: readonly Platform[] = ['taobao', 'tmall', '1688', 'jd', 'alibaba', 'weidian'];
  private readonly baseUrl: string;
  private readonly lang: OneboundLang;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly usdToCny: () => Promise<number>;

  constructor(private readonly options: OneboundOptions) {
    this.baseUrl = options.baseUrl || ONEBOUND_DEFAULT_BASE_URL;
    this.lang = options.lang ?? 'cn';
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 20000;
    this.usdToCny = options.usdToCny ?? defaultUsdToCny;
  }

  /** Renvoie null quand Onebound répond « aucun résultat / article introuvable » (code 2000). */
  private async call(platform: Platform, method: 'item_get' | 'item_search' | 'item_search_tmall', params: Record<string, string | number | undefined>): Promise<Json | null> {
    const url = buildUrl(this.baseUrl, `/${API_NAME[platform]}/${method}/`, {
      key: this.options.key,
      secret: this.options.secret,
      lang: this.lang,
      ...params,
    });
    let res: Response;
    try {
      res = await this.fetcher(url, { signal: timeoutSignal(this.timeoutMs), headers: { Accept: 'application/json' } });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ProviderError(`Onebound injoignable : ${redact(reason, this.options.key, this.options.secret)}`, 504);
    }
    if (!res.ok) throw new ProviderError(`Onebound indisponible (HTTP ${res.status})`);
    let json: Json;
    try {
      json = obj(await res.json());
    } catch {
      throw new ProviderError('Réponse Onebound illisible');
    }
    const code = str(json.error_code);
    if (code === '0000' || (!code && !str(json.error))) return json;
    if (code === '2000') return null;
    const known = ERRORS[code];
    if (known) throw new ProviderError(known.message, known.status);
    const reason = redact(str(json.reason || json.error), this.options.key, this.options.secret);
    throw new ProviderError(`Erreur Onebound ${code || ''} ${reason}`.replace(/\s+/g, ' ').trim());
  }

  async getProduct(platform: Platform, itemId: string, options?: GetProductOptions): Promise<ProductDetail | null> {
    // cache=no : Onebound sert sinon une copie qui peut dater de plusieurs heures (data_update).
    const json = await this.call(platform, 'item_get', {
      num_iid: itemId,
      ...(platform === '1688' ? {} : { is_promotion: 1 }),
      ...(options?.fresh ? { cache: 'no' } : {}),
    });
    const item = obj(json?.item);
    if (!str(item.num_iid) && !str(item.title)) return null;
    const rate = str(item.currency_code).toUpperCase() === 'USD' ? await this.usdToCny() : undefined;
    return mapItem(platform, itemId, item, this.name, rate);
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const platform = params.platform ?? 'taobao';
    // Alibaba.com est en dollars : filtres de prix convertis à l'aller, prix des résultats au retour.
    const rate = platform === 'alibaba' ? await this.usdToCny() : undefined;
    const toProviderPrice = (cny?: number) => (cny === undefined || !rate ? cny : Math.round((cny / rate) * 100) / 100);
    // taobao/item_search mélange Taobao et Tmall : item_search_tmall ne renvoie que des boutiques Tmall.
    const json = await this.call(platform, platform === 'tmall' ? 'item_search_tmall' : 'item_search', {
      q: params.q,
      page: params.page,
      page_size: params.pageSize,
      sort: SORT[params.sort],
      start_price: toProviderPrice(params.minPrice),
      end_price: toProviderPrice(params.maxPrice),
    });
    const items = obj(json?.items);
    const list = arr(items.item)
      .map((i) => mapSearchItem(platform, i, rate))
      .filter((i): i is ProductSummary => i !== null);
    const total = num(items.real_total_results ?? items.total_results, list.length);
    const pageCount = num(items.pagecount, 0);
    // La passerelle ne permet pas de dépasser 100 pages.
    const lastPage = Math.min(100, pageCount || Math.ceil(total / params.pageSize));
    return {
      items: list,
      page: params.page,
      pageSize: params.pageSize,
      total,
      hasMore: list.length > 0 && params.page < lastPage,
      provider: this.name,
      isDemoData: false,
    };
  }
}
