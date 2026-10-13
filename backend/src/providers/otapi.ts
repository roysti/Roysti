/**
 * Adaptateur OTAPI (OpenTrade Commerce) via RapidAPI : la voie la plus simple pour un
 * particulier hors de Chine (compte RapidAPI + carte bancaire ; palier BASIC gratuit,
 * environ 20 requêtes/jour d'après la page de tarifs d'« Otapi 1688 », dépassement facturé).
 *
 * - Taobao / Tmall : hôte taobao-tmall1.p.rapidapi.com (API « Taobao Tmall »).
 * - 1688 : hôte otapi-1688.p.rapidapi.com (API « Otapi 1688 »), identifiants préfixés « abb- ».
 * Méthodes : BatchSearchItemsFrame (recherche) et BatchGetItemFullInfo (fiche).
 *
 * Correspondance vérifiée sur une réponse brute Taobao d'OTAPI (Item : Attributes,
 * ConfiguredItems, Promotions, Price.OriginalPrice en CNY…) ; enveloppe de recherche
 * vérifiée sur une réponse brute d'un autre hôte OTAPI de RapidAPI (même éditeur, même schéma).
 * Les paliers 1688 (QuantityRanges) n'ont pas été vus en réponse brute : parsing défensif.
 *
 * Variables d'environnement : RAPIDAPI_KEY, OTAPI_HOST_TAOBAO, OTAPI_HOST_1688, OTAPI_LANGUAGE.
 */
import { buildSourceUrl } from '../lib/linkParser.js';
import { timeoutSignal } from '../lib/env.js';
import type { Platform, PriceTier, ProductDetail, ProductSummary, SearchParams, SearchResult, Sku, SkuProp } from '../types.js';
import { ProviderError, type ProductProvider } from './types.js';
import { arr, buildUrl, normalizeImageUrl, num, obj, positive, redact, str, type Json } from './util.js';

export const OTAPI_DEFAULT_HOSTS = { taobao: 'taobao-tmall1.p.rapidapi.com', '1688': 'otapi-1688.p.rapidapi.com' } as const;

export interface OtapiOptions {
  rapidApiKey: string;
  taobaoHost?: string;
  host1688?: string;
  /** Langue des titres (en par défaut ; le titre chinois d'origine est toujours fourni). */
  language?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

/** « https://img.alicdn.com/imgextra///img.alicdn.com/imgextra/i2/… » → URL unique. */
export function fixOtapiImage(url: unknown): string {
  const u = str(url).trim();
  const i = u.lastIndexOf('///');
  return normalizeImageUrl(i >= 0 ? `https://${u.slice(i + 3)}` : u);
}

/** Prix en CNY (OriginalPrice) ; les autres champs (MarginPrice, ConvertedPrice) incluent une marge ou une conversion. */
const cny = (price: unknown): number => Math.max(0, num(obj(price).OriginalPrice));
const featured = (item: Json, ...names: string[]) => {
  const values = arr(item.FeaturedValues).map(obj);
  for (const name of names) {
    const v = values.find((f) => str(f.Name) === name);
    if (v) return positive(v.Value);
  }
  return undefined;
};
const stripPrefix = (id: unknown) => str(id).replace(/^abb-/, '');
const isTmall = (item: Json) => arr(item.Features).some((f) => str(f).toLowerCase() === 'tmall');

/** Images de la description HTML (<img src="…">). */
function descriptionImages(html: unknown): string[] {
  const out: string[] = [];
  for (const m of str(html).matchAll(/<img[^>]+src=["']?([^"' >]+)/gi)) {
    const url = fixOtapiImage(m[1]);
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

export function mapOtapiItem(platform: Platform, itemId: string, item: Json): ProductDetail {
  const attributes = arr(item.Attributes).map(obj);
  const propMap = new Map<string, SkuProp>();
  for (const a of attributes.filter((x) => x.IsConfigurator === true)) {
    const pid = str(a.Pid);
    const vid = str(a.Vid);
    if (!pid || !vid) continue;
    const prop = propMap.get(pid) ?? { pid, name: str(a.PropertyName) || str(a.OriginalPropertyName) || pid, values: [] };
    if (!prop.values.some((v) => v.vid === vid)) {
      prop.values.push({ vid, name: str(a.Value) || str(a.OriginalValue), image: fixOtapiImage(a.ImageUrl ?? a.MiniImageUrl) || undefined });
    }
    propMap.set(pid, prop);
  }

  // Prix promotionnel par SKU quand il existe (Promotions[].ConfiguredItems[]).
  const promo = new Map<string, number>();
  for (const p of arr(item.Promotions).map(obj)) {
    for (const c of arr(p.ConfiguredItems).map(obj)) {
      const price = cny(c.Price);
      const id = str(c.Id);
      if (price > 0 && (!promo.has(id) || price < promo.get(id)!)) promo.set(id, price);
    }
  }
  const basePrice = cny(item.Price);
  const promoBase = Math.min(...arr(item.Promotions).map((p) => cny(obj(p).Price) || Infinity));
  const itemPrice = Number.isFinite(promoBase) && promoBase > 0 && promoBase < basePrice ? promoBase : basePrice;

  const skus: Sku[] = arr(item.ConfiguredItems).map((raw, i) => {
    const c = obj(raw);
    const props: Record<string, string> = {};
    for (const conf of arr(c.Configurators).map(obj)) if (str(conf.Pid) && str(conf.Vid)) props[str(conf.Pid)] = str(conf.Vid);
    const regular = cny(c.Price) || basePrice;
    const special = promo.get(str(c.Id));
    return { skuId: str(c.Id) || String(i), props, price: special && special < regular ? special : regular, stock: num(c.Quantity) };
  });

  const tiers: PriceTier[] = arr(item.QuantityRanges)
    .map((r) => ({ minQty: num(obj(r).MinQuantity), price: cny(obj(r).Price) }))
    .filter((t) => t.minQty > 0 && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
  const priceTiers = tiers.length > 1 ? tiers : undefined;

  const available = skus.filter((s) => s.stock > 0 && s.price > 0).map((s) => s.price);
  const prices = available.length ? available : [...skus.map((s) => s.price), ...tiers.map((t) => t.price)].filter((p) => p > 0);
  const price = prices.length ? Math.min(...prices) : itemPrice;
  const maxPrice = prices.length ? Math.max(...prices) : price;

  const images = arr(item.Pictures)
    .map((p) => fixOtapiImage(obj(obj(p).Large).Url || obj(p).Url))
    .filter(Boolean);
  const mainImage = fixOtapiImage(item.MainPictureUrl) || images[0] || '';
  const physical = obj(item.PhysicalParameters);
  const location = str(obj(item.Location).State) || str(obj(item.Location).City) || undefined;
  const shopName = str(item.VendorDisplayName) || str(item.VendorName) || undefined;
  const moq = positive(item.FirstLotQuantity);

  return {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title: str(item.Title) || str(item.OriginalTitle),
    titleOriginal: str(item.OriginalTitle) && str(item.OriginalTitle) !== str(item.Title) ? str(item.OriginalTitle) : undefined,
    image: mainImage,
    images: images.length ? images : mainImage ? [mainImage] : [],
    price,
    priceMax: maxPrice > price ? maxPrice : undefined,
    sales: featured(item, 'SalesInLast30Days', 'TotalSales'),
    shopName,
    location,
    moq: moq && moq > 1 ? moq : undefined,
    props: [...propMap.values()],
    skus,
    priceTiers,
    domesticShipping: cny(obj(item.Price).DeliveryPrice) || cny(obj(arr(item.DeliveryCosts)[0]).Price),
    weightKg: positive(obj(item.ActualWeightInfo).Weight) ?? positive(physical.Weight),
    packageDims:
      positive(physical.Length) && positive(physical.Width) && positive(physical.Height)
        ? { lengthCm: num(physical.Length), widthCm: num(physical.Width), heightCm: num(physical.Height) }
        : undefined,
    attributes: attributes
      .filter((a) => a.IsConfigurator !== true)
      .map((a) => ({ name: str(a.PropertyName) || str(a.OriginalPropertyName), value: str(a.Value) || str(a.OriginalValue) }))
      .filter((a) => a.name && a.value),
    descriptionImages: descriptionImages(item.Description),
    descriptionText: undefined,
    seller: { name: shopName ?? 'Vendeur', location },
    sourceUrl: str(item.ExternalItemUrl) || str(item.TaobaoItemUrl) || buildSourceUrl(platform, itemId),
    stock: skus.length ? skus.reduce((s, k) => s + k.stock, 0) : num(item.MasterQuantity),
    provider: 'otapi',
    isDemoData: false,
  };
}

export function mapOtapiSearchItem(host: 'taobao' | '1688', raw: unknown): ProductSummary | null {
  const i = obj(raw);
  const itemId = stripPrefix(i.Id);
  if (!/^\d+$/.test(itemId)) return null;
  const platform: Platform = host === '1688' ? '1688' : isTmall(i) ? 'tmall' : 'taobao';
  const regular = cny(i.Price);
  const promo = cny(i.PromotionPrice);
  return {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title: str(i.Title) || str(i.OriginalTitle),
    titleOriginal: str(i.OriginalTitle) && str(i.OriginalTitle) !== str(i.Title) ? str(i.OriginalTitle) : undefined,
    image: fixOtapiImage(i.MainPictureUrl),
    price: promo > 0 && promo < regular ? promo : regular,
    priceMax: promo > 0 && promo < regular ? regular : undefined,
    sales: featured(i, 'SalesInLast30Days', 'TotalSales'),
    shopName: str(i.VendorDisplayName) || str(i.VendorName) || undefined,
    location: str(obj(i.Location).State) || str(obj(i.Location).City) || undefined,
    moq: host === '1688' ? positive(i.FirstLotQuantity) : undefined,
  };
}

export class OtapiProvider implements ProductProvider {
  readonly name = 'otapi';
  readonly isDemo = false;
  readonly platforms: readonly Platform[] = ['taobao', 'tmall', '1688'];
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: OtapiOptions) {
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    // OTAPI peut mettre 15 à 20 s à répondre.
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  private host(platform: Platform): { key: 'taobao' | '1688'; host: string } {
    if (platform === '1688') return { key: '1688', host: this.options.host1688 || OTAPI_DEFAULT_HOSTS['1688'] };
    return { key: 'taobao', host: this.options.taobaoHost || OTAPI_DEFAULT_HOSTS.taobao };
  }

  /** Pas de nouvelle tentative automatique : chaque appel compte dans le quota RapidAPI. */
  private async call(platform: Platform, method: string, params: Record<string, string | number | undefined>): Promise<Json | null> {
    const { host } = this.host(platform);
    const url = buildUrl(`https://${host}`, `/${method}`, { language: this.options.language || 'en', ...params });
    let res: Response;
    try {
      res = await this.fetcher(url, {
        signal: timeoutSignal(this.timeoutMs),
        headers: { Accept: 'application/json', 'x-rapidapi-key': this.options.rapidApiKey, 'x-rapidapi-host': host },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ProviderError(`OTAPI (RapidAPI) injoignable : ${redact(reason, this.options.rapidApiKey)}`, 504);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        `Clé RapidAPI refusée ou abonnement manquant : abonnez-vous à l’API ${platform === '1688' ? '« Otapi 1688 »' : '« Taobao Tmall » (OpenTrade Commerce)'} sur RapidAPI.`,
        401,
      );
    }
    if (res.status === 429) throw new ProviderError('Quota RapidAPI atteint pour aujourd’hui (ou trop de requêtes). Réessayez plus tard.', 429);
    let json: Json;
    try {
      json = obj(await res.json());
    } catch {
      throw new ProviderError(`Réponse OTAPI illisible (HTTP ${res.status})`);
    }
    if (!res.ok && !str(json.ErrorCode)) throw new ProviderError(`OTAPI indisponible (HTTP ${res.status})`);
    const code = str(json.ErrorCode);
    if (code.toLowerCase() === 'ok') return obj(json.Result);
    const sub = str(obj(json.SubErrorCode).Value);
    if (code === 'NotAvailable' && sub === 'ItemIsNotComplete') {
      throw new ProviderError('Article en cours de récupération chez OTAPI : réessayez dans une minute.', 503);
    }
    if (/notfound/i.test(code) || /notfound/i.test(sub)) return null;
    throw new ProviderError(`Erreur OTAPI ${code}${str(json.ErrorDescription) ? ` : ${redact(str(json.ErrorDescription), this.options.rapidApiKey)}` : ''}`);
  }

  async getProduct(platform: Platform, itemId: string): Promise<ProductDetail | null> {
    if (!this.platforms.includes(platform)) throw new ProviderError(`OTAPI ne couvre pas ${platform} (Taobao, Tmall et 1688 seulement).`, 400);
    const result = await this.call(platform, 'BatchGetItemFullInfo', { itemId: platform === '1688' ? `abb-${itemId}` : itemId });
    const item = obj(result?.Item ?? result?.OtapiItemFullInfo);
    if (!str(item.Id) && !str(item.Title)) return null;
    if (item.HasError === true && /notfound/i.test(str(item.ErrorCode))) return null;
    return mapOtapiItem(platform, itemId, item);
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const platform = params.platform ?? 'taobao';
    if (!this.platforms.includes(platform)) throw new ProviderError(`OTAPI ne couvre pas ${platform} (Taobao, Tmall et 1688 seulement).`, 400);
    const { key } = this.host(platform);
    const pageSize = Math.min(params.pageSize, 50);
    const framePosition = (params.page - 1) * pageSize;
    // Seuls Default et Popularity:Desc sont attestés pour OrderBy ; les tris et filtres de prix
    // (dont la devise n'est pas documentée) sont appliqués ici, sur la page reçue.
    const result = await this.call(platform, 'BatchSearchItemsFrame', {
      framePosition,
      frameSize: pageSize,
      ItemTitle: params.q,
      OrderBy: params.sort === 'sales' ? 'Popularity:Desc' : undefined,
    });
    const page = obj(obj(result?.Items).Items);
    let items = arr(page.Content)
      .map((i) => mapOtapiSearchItem(key, i))
      .filter((i): i is ProductSummary => i !== null);
    const fetched = items.length;
    if (params.minPrice !== undefined) items = items.filter((i) => i.price >= params.minPrice!);
    if (params.maxPrice !== undefined) items = items.filter((i) => i.price <= params.maxPrice!);
    if (params.sort === 'price_asc') items.sort((a, b) => a.price - b.price);
    if (params.sort === 'price_desc') items.sort((a, b) => b.price - a.price);
    const total = num(page.TotalCount, items.length);
    const maxPages = num(obj(result?.Items).MaximumPageCount, 0);
    return {
      items,
      page: params.page,
      pageSize,
      total,
      hasMore: fetched > 0 && framePosition + fetched < total && (!maxPages || params.page < maxPages),
      provider: this.name,
      isDemoData: false,
    };
  }
}
