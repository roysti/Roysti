import { BASE_PRODUCTS, LOCATIONS, SHOP_NAMES, type BaseProduct, type PropTemplate } from '../data/catalog.js';
import { CATEGORIES } from '../data/categories.js';
import { buildSourceUrl } from '../lib/linkParser.js';
import { seededRandom } from '../lib/random.js';
import { PLATFORMS, type Platform, type PriceTier, type ProductDetail, type ProductSummary, type SearchParams, type SearchResult, type Sku, type SkuProp } from '../types.js';
import type { ProductProvider } from './types.js';

const COLORS = [
  ['Noir', '黑色'],
  ['Blanc', '白色'],
  ['Gris', '灰色'],
  ['Bleu marine', '藏青色'],
  ['Beige', '米色'],
  ['Vert olive', '橄榄绿'],
  ['Rose', '粉色'],
  ['Marron', '棕色'],
] as const;

const PRICE_FACTOR: Record<Platform, [number, number]> = {
  taobao: [0.9, 1.15],
  tmall: [1.2, 1.4],
  '1688': [0.45, 0.6],
  alibaba: [0.5, 0.65],
  jd: [1.15, 1.3],
  weidian: [0.85, 1],
};

const DOMESTIC_SHIPPING: Record<Platform, [number, number]> = {
  taobao: [0, 12],
  tmall: [0, 8],
  '1688': [5, 15],
  alibaba: [8, 20],
  jd: [0, 6],
  weidian: [0, 10],
};

const ID_FORMAT: Record<Platform, { prefix: string; length: number }> = {
  taobao: { prefix: '7', length: 12 },
  tmall: { prefix: '6', length: 12 },
  '1688': { prefix: '7', length: 12 },
  alibaba: { prefix: '1600', length: 13 },
  jd: { prefix: '100', length: 12 },
  weidian: { prefix: '7', length: 10 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function makeId(platform: Platform, seed: string): string {
  const { prefix, length } = ID_FORMAT[platform];
  return prefix + seededRandom(`id:${platform}:${seed}`).digits(length - prefix.length);
}

function buildProps(template: PropTemplate, seed: string, cat: string): { props: SkuProp[]; adjust: (sel: Record<string, string>) => number } {
  const rnd = seededRandom(`props:${seed}`);
  const colorCount = rnd.int(3, 5);
  const start = rnd.int(0, COLORS.length - 1);
  const colorProp: SkuProp = {
    pid: '1627207',
    name: 'Couleur',
    values: Array.from({ length: colorCount }, (_, i) => {
      const [fr, zh] = COLORS[(start + i) % COLORS.length]!;
      return { vid: String(28320 + ((start + i) % COLORS.length)), name: `${fr} (${zh})`, image: `mock://${cat}/${seed}-c${i}` };
    }),
  };
  const sizeProp = (pid: string, name: string, labels: string[]): SkuProp => ({
    pid,
    name,
    values: labels.map((label, i) => ({ vid: String(28400 + i), name: label })),
  });
  const indexOf = (prop: SkuProp, sel: Record<string, string>) => prop.values.findIndex((v) => v.vid === sel[prop.pid]);

  switch (template) {
    case 'apparel': {
      const size = sizeProp('20509', 'Taille', ['S', 'M', 'L', 'XL', 'XXL']);
      return { props: [colorProp, size], adjust: (sel) => (indexOf(size, sel) >= 3 ? 1.05 : 1) };
    }
    case 'shoes': {
      const size = sizeProp('20549', 'Pointure', ['38', '39', '40', '41', '42', '43', '44']);
      return { props: [colorProp, size], adjust: () => 1 };
    }
    case 'color':
      return { props: [colorProp], adjust: () => 1 };
    case 'phone': {
      const model = sizeProp('122216', 'Modèle', ['Pour iPhone 15', 'Pour iPhone 16', 'Pour iPhone 16 Pro', 'Pour Galaxy S24', 'Pour Redmi Note 13']);
      return { props: [colorProp, model], adjust: () => 1 };
    }
    case 'capacity': {
      const cap = sizeProp('122217', 'Capacité', ['10 000 mAh', '20 000 mAh']);
      return { props: [colorProp, cap], adjust: (sel) => (indexOf(cap, sel) === 1 ? 1.35 : 1) };
    }
    case 'size': {
      const size = sizeProp('122218', 'Taille', ['Petit', 'Moyen', 'Grand']);
      return { props: [size], adjust: (sel) => 1 + Math.max(0, indexOf(size, sel)) * 0.3 };
    }
    case 'none':
      return { props: [], adjust: () => 1 };
  }
}

function combinations(props: SkuProp[]): Record<string, string>[] {
  return props.reduce<Record<string, string>[]>(
    (acc, prop) => acc.flatMap((combo) => prop.values.map((v) => ({ ...combo, [prop.pid]: v.vid }))),
    [{}],
  );
}

function titleFor(base: BaseProduct, platform: Platform): { title: string; original?: string } {
  switch (platform) {
    case '1688':
      return { title: `${base.fr} – prix usine`, original: `厂家直销 ${base.zh}` };
    case 'alibaba':
      return { title: `${base.fr} – vente en gros export` };
    case 'tmall':
      return { title: base.fr, original: `【官方旗舰店】${base.zh}` };
    case 'jd':
      return { title: base.fr, original: `【京东自营】${base.zh}` };
    default:
      return { title: base.fr, original: base.zh };
  }
}

function buildProduct(base: BaseProduct, platform: Platform, itemId = makeId(platform, base.key), demoTitle?: string): ProductDetail {
  const seed = `${platform}:${itemId}`;
  const rnd = seededRandom(seed);
  const [fMin, fMax] = PRICE_FACTOR[platform];
  const price = round2(Math.max(0.1, base.price * rnd.between(fMin, fMax)));
  const { props, adjust } = buildProps(base.props, seed, base.cat);

  const skus: Sku[] = combinations(props)
    .filter((c) => Object.keys(c).length > 0)
    .map((sel, i) => ({
      skuId: `${itemId}${String(i).padStart(3, '0')}`,
      props: sel,
      price: round2(price * adjust(sel)),
      stock: rnd.next() < 0.08 ? 0 : rnd.int(5, 800),
    }));
  const prices = skus.length ? skus.map((s) => s.price) : [price];

  const wholesale = platform === '1688' || platform === 'alibaba';
  const moq = platform === 'alibaba' ? rnd.pick([50, 100, 200, 500]) : platform === '1688' ? rnd.pick([1, 2, 3, 5, 10]) : 1;
  const priceTiers: PriceTier[] | undefined = wholesale
    ? [
        { minQty: moq, price },
        { minQty: moq * 10, price: round2(price * 0.93) },
        { minQty: moq * 50, price: round2(price * 0.86) },
      ]
    : undefined;

  const [sMin, sMax] = DOMESTIC_SHIPPING[platform];
  const freeShipping = (platform === 'taobao' || platform === 'tmall' || platform === 'jd') && rnd.next() < 0.5;
  const shopName = rnd.pick(SHOP_NAMES[base.cat] ?? ['优选好店']) + (platform === 'tmall' ? '旗舰店' : '');
  const location = rnd.pick(LOCATIONS[base.cat] ?? ['浙江 义乌']);
  const { title, original } = titleFor(base, platform);
  const category = CATEGORIES.find((c) => c.id === base.cat);

  return {
    id: `${platform}:${itemId}`,
    platform,
    itemId,
    title: demoTitle ?? title,
    titleOriginal: demoTitle ? undefined : original,
    image: `mock://${base.cat}/${seed}-0`,
    images: Array.from({ length: 5 }, (_, i) => `mock://${base.cat}/${seed}-${i}`),
    price: Math.min(...prices),
    priceMax: Math.max(...prices) > Math.min(...prices) ? Math.max(...prices) : undefined,
    sales: rnd.int(platform === 'alibaba' ? 10 : 50, platform === '1688' ? 30000 : 12000),
    shopName,
    location,
    moq: wholesale ? moq : undefined,
    category: base.cat,
    props,
    skus,
    priceTiers,
    domesticShipping: freeShipping ? 0 : round2(rnd.between(sMin, sMax)),
    weightKg: base.weightKg,
    packageDims: { lengthCm: base.dims[0], widthCm: base.dims[1], heightCm: base.dims[2] },
    attributes: [
      ...base.attrs.map(([name, value]) => ({ name, value })),
      { name: 'Catégorie', value: category?.name ?? base.cat },
      { name: "Lieu d'expédition", value: location },
      { name: 'Poids estimé', value: `${base.weightKg} kg` },
      ...(base.sensitive ? [{ name: 'Article sensible', value: 'Oui (batterie / liquide) – lignes spéciales requises' }] : []),
    ],
    descriptionImages: Array.from({ length: 3 }, (_, i) => `mock://${base.cat}/${seed}-d${i}`),
    descriptionText: `${base.fr}. Fiche de démonstration générée automatiquement.`,
    seller: {
      name: shopName,
      rating: round2(rnd.between(4.5, 5)),
      location,
      years: rnd.int(1, 15),
    },
    sourceUrl: buildSourceUrl(platform, itemId),
    stock: skus.length ? skus.reduce((s, k) => s + k.stock, 0) : rnd.int(10, 2000),
    sensitive: base.sensitive ?? false,
    provider: 'mock',
    isDemoData: true,
  };
}

function toSummary(p: ProductDetail): ProductSummary {
  return {
    id: p.id,
    platform: p.platform,
    itemId: p.itemId,
    title: p.title,
    titleOriginal: p.titleOriginal,
    image: p.image,
    price: p.price,
    priceMax: p.priceMax,
    sales: p.sales,
    shopName: p.shopName,
    location: p.location,
    moq: p.moq,
    category: p.category,
  };
}

interface IndexedProduct {
  product: ProductDetail;
  base: BaseProduct;
  /** Titre et mots-clés propres à l'article (poids fort). */
  titleText: string;
  /** Catégorie, boutique… (poids faible). */
  haystack: string;
}

const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

/** Mot exact du titre : 4, début de mot du titre : 3, ailleurs dans le titre : 2, catégorie/boutique : 1. */
function tokenScore(i: IndexedProduct, token: string): number {
  const words = i.titleText.split(WORD_SPLIT);
  if (words.includes(token)) return 4;
  if (words.some((w) => w.startsWith(token))) return 3;
  if (i.titleText.includes(token)) return 2;
  return i.haystack.includes(token) ? 1 : 0;
}

export class MockProvider implements ProductProvider {
  readonly name = 'mock';
  readonly isDemo = true;
  readonly platforms = PLATFORMS;
  private readonly index: IndexedProduct[];

  constructor() {
    this.index = BASE_PRODUCTS.flatMap((base) =>
      base.platforms.map((platform) => {
        const product = buildProduct(base, platform);
        const category = CATEGORIES.find((c) => c.id === base.cat);
        const titleText = normalize([base.fr, base.zh, base.key.replace(/-/g, ' '), ...(base.keywords ?? [])].join(' '));
        const haystack = normalize([titleText, category?.name, ...(category?.keywords ?? []), product.shopName].join(' '));
        return { product, base, titleText, haystack };
      }),
    );
  }

  /** Tous les produits du catalogue (utilisé pour la page d'accueil). */
  all(): ProductDetail[] {
    return this.index.map((i) => i.product);
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const tokens = normalize(params.q).split(/\s+/).filter(Boolean);
    let matches = this.index
      .filter((i) => !params.platform || i.product.platform === params.platform)
      .filter((i) => !params.category || i.base.cat === params.category)
      .filter((i) => params.minPrice === undefined || i.product.price >= params.minPrice)
      .filter((i) => params.maxPrice === undefined || i.product.price <= params.maxPrice)
      .map((i) => ({ i, matched: tokens.filter((t) => i.haystack.includes(t)).length, score: tokens.length ? tokens.reduce((s, t) => s + tokenScore(i, t), 0) : 1 }))
      .filter((m) => m.score > 0);

    // Si la requête contient plusieurs mots, on garde d'abord les résultats qui en contiennent le plus.
    if (tokens.length > 1) {
      const best = Math.max(0, ...matches.map((m) => m.matched));
      matches = matches.filter((m) => m.matched >= Math.min(best, Math.ceil(tokens.length / 2)));
    }

    const sorted = matches.sort((a, b) => {
      switch (params.sort) {
        case 'price_asc':
          return a.i.product.price - b.i.product.price;
        case 'price_desc':
          return b.i.product.price - a.i.product.price;
        case 'sales':
          return (b.i.product.sales ?? 0) - (a.i.product.sales ?? 0);
        default:
          return b.score - a.score || (b.i.product.sales ?? 0) - (a.i.product.sales ?? 0);
      }
    });

    const start = (params.page - 1) * params.pageSize;
    const page = sorted.slice(start, start + params.pageSize).map((m) => toSummary(m.i.product));
    return {
      items: page,
      page: params.page,
      pageSize: params.pageSize,
      total: sorted.length,
      hasMore: start + params.pageSize < sorted.length,
      provider: this.name,
      isDemoData: true,
    };
  }

  async getProduct(platform: Platform, itemId: string): Promise<ProductDetail | null> {
    const found = this.index.find((i) => i.product.platform === platform && i.product.itemId === itemId);
    if (found) return found.product;
    // Lien inconnu du catalogue de démo : on génère une fiche fictive clairement signalée.
    const candidates = BASE_PRODUCTS.filter((b) => b.platforms.includes(platform));
    const base = seededRandom(`unknown:${platform}:${itemId}`).pick(candidates.length ? candidates : BASE_PRODUCTS);
    const label = platform === '1688' ? '1688' : platform.charAt(0).toUpperCase() + platform.slice(1);
    return buildProduct(base, platform, itemId, `Article ${label} n° ${itemId} (données de démonstration)`);
  }
}

export const featuredFrom = (products: ProductDetail[], limit = 20): ProductSummary[] => {
  const byPlatform = new Map<Platform, ProductDetail[]>();
  for (const p of [...products].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0))) {
    byPlatform.set(p.platform, [...(byPlatform.get(p.platform) ?? []), p]);
  }
  const out: ProductSummary[] = [];
  while (out.length < limit && [...byPlatform.values()].some((l) => l.length)) {
    for (const list of byPlatform.values()) {
      const next = list.shift();
      if (next && out.length < limit) out.push(toSummary(next));
    }
  }
  return out;
};
