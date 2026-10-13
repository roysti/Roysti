import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCore } from '../src/core/api.js';
import { nodeRuntime } from '../src/core/nodeRuntime.js';
import { providerQuery, translateQuery } from '../src/lib/query.js';
import { CachedProvider } from '../src/providers/cached.js';
import { ProviderConfigError, providerFromSettings, settingsFromEnv } from '../src/providers/index.js';
import { MockProvider } from '../src/providers/mock.js';
import { OneboundProvider } from '../src/providers/onebound.js';
import { TmapiProvider } from '../src/providers/tmapi.js';
import { ProviderError, type ProductProvider } from '../src/providers/types.js';
import { Store } from '../src/store/db.js';
import type { Platform, ProductDetail, SearchParams, SearchResult } from '../src/types.js';

process.env.RATES_OFFLINE = 'true';

/** Faux fetch : enregistre les URL appelées et répond avec la fonction fournie. */
function fakeFetch(respond: (url: string) => { status?: number; body: unknown } | Error) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const r = respond(url);
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { fetcher, calls };
}

const query = (url: string) => Object.fromEntries(new URL(url).searchParams);
const params = (p: Partial<SearchParams> = {}): SearchParams => ({ q: '手机壳', page: 1, pageSize: 20, sort: 'default', ...p });

// Structure identique aux réponses réelles de taobao/item_get (valeurs fictives).
const ONEBOUND_TAOBAO = {
  item: {
    num_iid: '700000000001',
    title: '纯棉短袖T恤男夏季宽松',
    price: '39.00',
    orginal_price: '59.00',
    nick: '示例服饰店',
    num: 1527,
    pic_url: '//img.alicdn.com/imgextra/i4/main.jpg',
    detail_url: 'https://item.taobao.com/item.htm?id=700000000001',
    item_imgs: [{ url: '//img.alicdn.com/imgextra/i4/main.jpg' }, { url: '//img.alicdn.com/imgextra/i2/second.jpg' }],
    item_weight: 0,
    location: '浙江杭州',
    post_fee: 0,
    express_fee: 8,
    props: [
      { name: '品牌', value: '示例' },
      { name: '材质', value: '棉' },
      { name: '空属性', value: '' },
    ],
    props_name: '1627207:28321:颜色分类:白色;1627207:28341:颜色分类:黑色;20509:28315:尺码:M',
    skus: {
      sku: [
        { price: 39, orginal_price: 59, properties: '1627207:28321;20509:28315', quantity: 200, sku_id: '5000000000001' },
        { price: 42.5, orginal_price: 59, properties: '1627207:28341;20509:28315', quantity: 0, sku_id: '5000000000002' },
      ],
    },
    props_list: { '1627207:28321': '颜色分类:白色', '1627207:28341': '颜色分类:黑色', '20509:28315': '尺码:M' },
    props_img: { '1627207:28321': 'http://img.alicdn.com/imgextra/i1/white.jpg' },
    prop_imgs: { prop_img: [{ properties: '1627207:28341', url: 'http://img.alicdn.com/imgextra/i1/black.jpg' }] },
    seller_info: { nick: '示例服饰店', zhuy: 'https://shop1.taobao.com/', shop_name: '示例服饰店' },
    tmall: false,
    total_sold: 0,
    sales: 320,
    desc_img: ['https://img.alicdn.com/imgextra/d1.jpg', '//img.alicdn.com/imgextra/d2.jpg'],
  },
  error: '',
  reason: '',
  error_code: '0000',
};

// Structure identique aux réponses réelles de 1688/item_get (props_img en tableau vide, priceRange).
const ONEBOUND_1688 = {
  item: {
    num_iid: '600000000002',
    title: '紫外线传感器模块',
    price: '14.50',
    pic_url: 'https://cbu01.alicdn.com/img/ibank/main.jpg',
    item_imgs: [{ url: 'https://cbu01.alicdn.com/img/ibank/main.jpg' }],
    props: [{ name: '品牌', value: '示例' }],
    skus: { sku: [{ price: '14.50', properties: '0:0', properties_name: '0:0:规格型号:紫外线模块', quantity: '499980', sku_id: '4900000000001' }] },
    props_list: { '0:0': '规格型号:紫外线模块' },
    seller_info: { nick: '示例电子', title: '深圳市示例电子有限公司', shop_name: '示例电子' },
    min_num: '2',
    location: '广东省 深圳市',
    priceRange: [
      ['1', '14.50'],
      ['500', '14.00'],
      ['50000', '10.00'],
    ],
    props_img: [],
    desc_img: [],
    sales: 20,
  },
  error_code: '0000',
};

describe('adaptateur Onebound (format des réponses réelles)', () => {
  it('appelle /taobao/item_get/ avec la clé, la langue et l’identifiant', async () => {
    const { fetcher, calls } = fakeFetch(() => ({ body: ONEBOUND_TAOBAO }));
    const provider = new OneboundProvider({ key: 'k-123', secret: 's-456', fetcher });
    const p = await provider.getProduct('tmall', '700000000001');
    assert.ok(p);
    const url = new URL(calls[0]!);
    assert.equal(url.origin + url.pathname, 'https://api-gw.onebound.cn/taobao/item_get/', 'Tmall passe par l’API Taobao');
    assert.deepEqual(query(calls[0]!), { key: 'k-123', secret: 's-456', lang: 'cn', num_iid: '700000000001', is_promotion: '1' });
  });

  it('convertit un article Taobao : SKU, images, prix, stock', async () => {
    const { fetcher } = fakeFetch(() => ({ body: ONEBOUND_TAOBAO }));
    const p = (await new OneboundProvider({ key: 'k', secret: 's', fetcher }).getProduct('taobao', '700000000001'))!;
    assert.equal(p.title, '纯棉短袖T恤男夏季宽松');
    assert.equal(p.image, 'https://img.alicdn.com/imgextra/i4/main.jpg');
    assert.equal(p.images.length, 2);
    assert.equal(p.price, 39);
    assert.equal(p.priceMax, 42.5);
    assert.equal(p.stock, 200, 'somme des stocks des SKU');
    assert.equal(p.sales, 320);
    assert.equal(p.domesticShipping, 8);
    assert.equal(p.weightKg, undefined, 'poids 0 = inconnu');
    assert.equal(p.shopName, '示例服饰店');
    assert.equal(p.location, '浙江杭州');
    assert.equal(p.provider, 'onebound');
    assert.equal(p.isDemoData, false);
    assert.deepEqual(
      p.props.map((x) => [x.pid, x.name, x.values.map((v) => [v.vid, v.name, v.image])]),
      [
        [
          '1627207',
          '颜色分类',
          [
            ['28321', '白色', 'https://img.alicdn.com/imgextra/i1/white.jpg'],
            ['28341', '黑色', 'https://img.alicdn.com/imgextra/i1/black.jpg'],
          ],
        ],
        ['20509', '尺码', [['28315', 'M', undefined]]],
      ],
    );
    assert.deepEqual(p.skus[1], { skuId: '5000000000002', props: { '1627207': '28341', '20509': '28315' }, price: 42.5, stock: 0 });
    assert.deepEqual(p.attributes, [
      { name: '品牌', value: '示例' },
      { name: '材质', value: '棉' },
    ]);
    assert.deepEqual(p.descriptionImages, ['https://img.alicdn.com/imgextra/d1.jpg', 'https://img.alicdn.com/imgextra/d2.jpg']);
    assert.equal(p.sourceUrl, 'https://item.taobao.com/item.htm?id=700000000001');
  });

  it('reconstruit les propriétés depuis props_name quand props_list manque', async () => {
    const { props_list: _omit, ...item } = ONEBOUND_TAOBAO.item;
    const { fetcher } = fakeFetch(() => ({ body: { ...ONEBOUND_TAOBAO, item } }));
    const p = (await new OneboundProvider({ key: 'k', secret: 's', fetcher }).getProduct('taobao', '700000000001'))!;
    assert.deepEqual(
      p.props.map((x) => x.values.length),
      [2, 1],
    );
  });

  it('convertit un article 1688 : paliers de prix et minimum de commande', async () => {
    const { fetcher, calls } = fakeFetch(() => ({ body: ONEBOUND_1688 }));
    const p = (await new OneboundProvider({ key: 'k', secret: 's', fetcher }).getProduct('1688', '600000000002'))!;
    assert.equal(new URL(calls[0]!).pathname, '/1688/item_get/');
    assert.equal(query(calls[0]!).is_promotion, undefined);
    assert.deepEqual(p.priceTiers, [
      { minQty: 1, price: 14.5 },
      { minQty: 500, price: 14 },
      { minQty: 50000, price: 10 },
    ]);
    assert.equal(p.moq, 2);
    assert.equal(p.price, 14.5, 'prix des SKU (le palier le plus bas exige 50 000 pièces)');
    assert.equal(p.stock, 499980);
    assert.equal(p.props[0]?.values[0]?.image, undefined);
  });

  it('cherche avec les valeurs de tri documentées et lit le nombre de pages', async () => {
    const { fetcher, calls } = fakeFetch(() => ({
      body: {
        items: {
          page: '1',
          real_total_results: '360000',
          total_results: '360000',
          page_size: 2,
          pagecount: '200',
          item: [
            { title: '高腰阔腿裤', pic_url: 'https://img.alicdn.com/a.jpg', promotion_price: '50.00', orginal_price: '60.00', price: '60.00', sales: 0, num_iid: '756775095301' },
            { title: '无标识', price: '9' },
          ],
        },
        error_code: '0000',
      },
    }));
    const provider = new OneboundProvider({ key: 'k', secret: 's', fetcher, lang: 'en' });
    const r = await provider.search(params({ platform: 'jd', sort: 'price_asc', minPrice: 10, pageSize: 2 }));
    const q = query(calls[0]!);
    assert.equal(new URL(calls[0]!).pathname, '/jd/item_search/');
    assert.equal(q.sort, 'bid2');
    assert.equal(q.start_price, '10');
    assert.equal(q.lang, 'en');
    assert.equal(q.end_price, undefined, 'aucun paramètre vide n’est envoyé');
    assert.equal(r.items.length, 1);
    assert.deepEqual(
      { price: r.items[0]?.price, priceMax: r.items[0]?.priceMax, sales: r.items[0]?.sales, platform: r.items[0]?.platform },
      { price: 50, priceMax: 60, sales: undefined, platform: 'jd' },
    );
    assert.equal(r.total, 360000);
    assert.equal(r.hasMore, true);
    await provider.search(params({ sort: 'price_desc', platform: 'weidian' }));
    assert.equal(query(calls[1]!).sort, '_bid2');
    assert.equal(new URL(calls[1]!).pathname, '/micro/item_search/');
    await provider.search(params({ sort: 'sales' }));
    assert.equal(query(calls[2]!).sort, '_sale');
  });

  it('traite les codes d’erreur documentés', async () => {
    const reply = (code: string, reason = '') => fakeFetch(() => ({ body: { error: code === '0000' ? '' : 'x', reason, error_code: code } })).fetcher;
    assert.equal(await new OneboundProvider({ key: 'k', secret: 's', fetcher: reply('2000') }).getProduct('taobao', '1234'), null);
    const empty = await new OneboundProvider({ key: 'k', secret: 's', fetcher: reply('2000') }).search(params());
    assert.deepEqual([empty.items.length, empty.hasMore], [0, false]);
    await assert.rejects(new OneboundProvider({ key: 'k', secret: 's', fetcher: reply('4005') }).search(params()), (e: ProviderError) => e.status === 401 && /4005/.test(e.message));
    await assert.rejects(new OneboundProvider({ key: 'k', secret: 's', fetcher: reply('4013') }).search(params()), (e: ProviderError) => e.status === 429);
    await assert.rejects(new OneboundProvider({ key: 'k', secret: 's', fetcher: reply('4999', 'boom') }).search(params()), /4999 boom/);
    const http = fakeFetch(() => ({ status: 500, body: {} })).fetcher;
    await assert.rejects(new OneboundProvider({ key: 'k', secret: 's', fetcher: http }).search(params()), (e: ProviderError) => e.status === 502);
  });

  it('ne divulgue jamais la clé dans les messages d’erreur', async () => {
    const { fetcher } = fakeFetch((url) => new Error(`getaddrinfo ENOTFOUND ${url}`));
    await assert.rejects(new OneboundProvider({ key: 'secret-key-1', secret: 'secret-2', fetcher }).search(params()), (e: Error) => {
      assert.ok(!e.message.includes('secret-key-1') && !e.message.includes('secret-2'), e.message);
      return e instanceof ProviderError && e.status === 504;
    });
  });
});

// Structure des exemples de la documentation TMAPI (valeurs fictives).
const TMAPI_1688 = {
  code: 200,
  msg: 'success',
  data: {
    item_id: 800000000003,
    product_url: 'https://detail.1688.com/offer/800000000003.html',
    title: '女式长款睡袍',
    currency: 'CNY',
    product_props: [{ 产品类别: '睡衣' }, { 面料名称: '网纱' }],
    main_imgs: ['https://cbu01.alicdn.com/img/ibank/1.jpg', 'https://cbu01.alicdn.com/img/ibank/2.jpg'],
    sale_count: '175',
    sale_info: { sale_quantity_90days: 175 },
    price_info: { price: '25.90', price_min: '25.90', price_max: '29.89', origin_price_min: null },
    tiered_price_info: {
      begin_num: 2,
      prices: [
        { beginAmount: '1', price: '29.89' },
        { beginAmount: '100', price: '27.60' },
        { beginAmount: '300', price: '25.90' },
      ],
    },
    shop_info: { shop_name: '示例服装厂', shop_url: 'https://winport.m.1688.com/x' },
    delivery_info: { location: '江苏省连云港市', delivery_fee: 4, unit_weight: 0 },
    sku_props: [
      { pid: '0', prop_name: '颜色', values: [{ vid: '0', name: '黄色', imageUrl: '//cbu01.alicdn.com/y.jpg' }, { vid: '1', name: '白色', imageUrl: '' }] },
      { pid: '1', prop_name: '尺码', values: [{ vid: '0', name: 'S', imageUrl: '' }] },
    ],
    skus: [
      { skuid: '5674557541674', sale_price: '29.89', origin_price: null, stock: 4975, props_ids: '0:0;1:0', props_names: '颜色:黄色;尺码:S', package_info: { weight: 0.12, length: 0, width: 0, height: 0 } },
      { skuid: '5674557541675', sale_price: '29.89', stock: 25, props_ids: '0:1;1:0', props_names: '颜色:白色;尺码:S' },
    ],
    stock: 5000,
  },
};

describe('adaptateur TMAPI', () => {
  it('lit le détail 1688 et les images de description', async () => {
    const { fetcher, calls } = fakeFetch((url) =>
      url.includes('/item_desc') ? { body: { code: 200, msg: 'success', data: { detail_imgs: ['https://cbu01.alicdn.com/d.jpg'] } } } : { body: TMAPI_1688 },
    );
    const p = (await new TmapiProvider({ token: 'tok', fetcher }).getProduct('1688', '800000000003'))!;
    const detailCall = calls.find((c) => c.includes('/item_detail'))!;
    assert.equal(new URL(detailCall).origin, 'https://api.tmapi.io');
    assert.deepEqual(query(detailCall), { apiToken: 'tok', item_id: '800000000003', language: 'zh' });
    assert.equal(p.title, '女式长款睡袍');
    assert.equal(p.price, 25.9, 'palier le plus bas');
    assert.equal(p.priceMax, 29.89);
    assert.equal(p.moq, 2);
    assert.equal(p.priceTiers?.length, 3);
    assert.equal(p.stock, 5000);
    assert.equal(p.weightKg, 0.12);
    assert.equal(p.packageDims, undefined, 'dimensions nulles = inconnues');
    assert.equal(p.domesticShipping, 4);
    assert.equal(p.sales, 175);
    assert.equal(p.props[0]?.values[0]?.image, 'https://cbu01.alicdn.com/y.jpg');
    assert.equal(p.props[0]?.values[1]?.image, undefined);
    assert.deepEqual(p.skus[1], { skuId: '5674557541675', props: { '0': '1', '1': '0' }, price: 29.89, stock: 25 });
    assert.deepEqual(p.attributes, [
      { name: '产品类别', value: '睡衣' },
      { name: '面料名称', value: '网纱' },
    ]);
    assert.deepEqual(p.descriptionImages, ['https://cbu01.alicdn.com/d.jpg']);
    assert.equal(p.provider, 'tmapi');
  });

  it('garde le détail même si les images de description échouent ; 404 = introuvable', async () => {
    const ok = fakeFetch((url) => (url.includes('/item_desc') ? { status: 500, body: { code: 500, msg: 'err' } } : { body: TMAPI_1688 })).fetcher;
    assert.ok(await new TmapiProvider({ token: 't', fetcher: ok }).getProduct('taobao', '800000000003'));
    const missing = fakeFetch(() => ({ body: { code: 404, msg: 'not found' } })).fetcher;
    assert.equal(await new TmapiProvider({ token: 't', fetcher: missing }).getProduct('1688', '1234'), null);
  });

  it('cherche sur 1688 (20 résultats au plus) et refuse la recherche Taobao', async () => {
    const { fetcher, calls } = fakeFetch(() => ({
      body: {
        code: 200,
        data: {
          total_count: 2000,
          has_next_page: true,
          items: [
            {
              item_id: 610947572360,
              title: '马克杯',
              img: 'https://cbu01.alicdn.com/m.jpg',
              price: '3.50',
              moq: 3,
              sale_info: { sale_quantity_int: 300 },
              delivery_info: { area_from: ['广东', '广州市'] },
              shop_info: { company_name: '广州示例' },
            },
          ],
        },
      },
    }));
    const provider = new TmapiProvider({ token: 't', fetcher });
    const r = await provider.search(params({ pageSize: 50, sort: 'price_desc', maxPrice: 9 }));
    assert.deepEqual(query(calls[0]!), { apiToken: 't', keyword: '手机壳', page: '1', page_size: '20', sort: 'price_down', price_end: '9' });
    assert.deepEqual(
      { id: r.items[0]?.id, price: r.items[0]?.price, moq: r.items[0]?.moq, sales: r.items[0]?.sales, location: r.items[0]?.location, shop: r.items[0]?.shopName },
      { id: '1688:610947572360', price: 3.5, moq: 3, sales: 300, location: '广东 广州市', shop: '广州示例' },
    );
    assert.deepEqual([r.total, r.hasMore, r.pageSize], [2000, true, 20]);
    await assert.rejects(provider.search(params({ platform: 'taobao' })), (e: ProviderError) => e.status === 400);
  });

  it('réessaie une fois sur 417/499 et traduit les erreurs connues', async () => {
    let n = 0;
    const flaky = fakeFetch(() => (++n === 1 ? { body: { code: 499, msg: 'timeout' } } : { body: { code: 200, data: { items: [] } } })).fetcher;
    await new TmapiProvider({ token: 't', fetcher: flaky }).search(params());
    assert.equal(n, 2);
    const expired = fakeFetch(() => ({ body: { code: 439, msg: 'Subscription expired' } })).fetcher;
    await assert.rejects(new TmapiProvider({ token: 't', fetcher: expired }).search(params()), (e: ProviderError) => e.status === 402);
    const unauthorized = fakeFetch(() => ({ status: 401, body: { code: 401, msg: 'Token未授权或已过期' } })).fetcher;
    await assert.rejects(new TmapiProvider({ token: 't', fetcher: unauthorized }).search(params()), (e: ProviderError) => e.status === 401);
  });
});

/** Fournisseur factice qui compte les appels. */
class CountingProvider implements ProductProvider {
  readonly name = 'compteur';
  readonly isDemo = false;
  readonly platforms: readonly Platform[] = ['taobao', '1688'];
  calls = 0;
  fail = false;
  lastSearch?: SearchParams;
  async search(p: SearchParams): Promise<SearchResult> {
    this.calls++;
    this.lastSearch = p;
    if (this.fail) throw new ProviderError('quota', 429);
    return { items: [{ id: 'taobao:1234', platform: 'taobao', itemId: '1234', title: p.q, image: '', price: 1 }], page: 1, pageSize: 1, total: 1, hasMore: false, provider: this.name, isDemoData: false };
  }
  async getProduct(): Promise<ProductDetail | null> {
    this.calls++;
    return null;
  }
}

describe('cache des fournisseurs payants', () => {
  it('réutilise les réponses, partage les appels simultanés et ne garde pas les erreurs', async () => {
    let now = 0;
    const inner = new CountingProvider();
    const cached = new CachedProvider(inner, { searchTtlMs: 1000, now: () => now });
    await Promise.all([cached.search(params()), cached.search(params())]);
    await cached.search(params());
    assert.equal(inner.calls, 1);
    const a = await cached.search(params());
    a.items[0]!.title = 'modifié';
    assert.equal((await cached.search(params())).items[0]?.title, '手机壳', 'chaque appelant reçoit une copie');
    now = 1001;
    await cached.search(params());
    assert.equal(inner.calls, 2, 'entrée expirée');
    inner.fail = true;
    await assert.rejects(cached.search(params({ q: 'x' })));
    inner.fail = false;
    await cached.search(params({ q: 'x' }));
    assert.equal(inner.calls, 4, 'une erreur n’est pas mise en cache');
    assert.equal(await cached.getProduct('taobao', '1'), null);
    await cached.getProduct('taobao', '1');
    assert.equal(inner.calls, 5);
  });

  it('limite le nombre d’entrées', async () => {
    const cached = new CachedProvider(new CountingProvider(), { maxEntries: 2 });
    for (const q of ['a', 'b', 'c']) await cached.search(params({ q }));
    assert.equal(cached.size, 2);
  });
});

describe('mots-clés envoyés aux plateformes chinoises', () => {
  it('traduit les termes courants et garde les marques et les modèles', () => {
    assert.equal(translateQuery('Coque iPhone 15'), '手机壳 iphone 15');
    assert.equal(translateQuery('une robe rouge pour femme'), '连衣裙 红色 女');
    assert.equal(translateQuery('Sac à dos'), '双肩包');
    assert.equal(translateQuery('T-shirt coton'), 'T恤 纯棉');
    assert.equal(translateQuery('écouteurs sans fil'), '耳机 无线');
    assert.equal(translateQuery('连衣裙 夏'), '连衣裙 夏', 'le chinois passe tel quel');
    assert.equal(translateQuery('  '), '');
  });

  it('ajoute le mot-clé de la catégorie et cherche les meilleures ventes par défaut', () => {
    assert.equal(providerQuery('', 'women'), '女装');
    assert.equal(providerQuery('robe', 'women'), '连衣裙 女装');
    assert.equal(providerQuery('', undefined), '热销');
    assert.equal(providerQuery('', 'inconnue'), '热销');
  });
});

describe('fournisseur réel dans le cœur de l’API', () => {
  const newCore = (provider: ProductProvider) => createCore({ store: new Store({ uuid: nodeRuntime.uuid }), provider, runtime: nodeRuntime, demoMode: true });

  it('traduit la recherche, renvoie les mots-clés utilisés et refuse une plateforme non couverte', async () => {
    const inner = new CountingProvider();
    const core = newCore(inner);
    const r = await core.handle({ method: 'GET', path: '/products/search', query: { q: 'robe', category: 'women', platform: '1688' } });
    assert.equal(r.status, 200);
    assert.equal((r.body as { query: string }).query, '连衣裙 女装');
    assert.equal(inner.lastSearch?.category, undefined);
    const jd = await core.handle({ method: 'GET', path: '/products/search', query: { q: 'robe', platform: 'jd' } });
    assert.equal(jd.status, 400);
  });

  it('teste la connexion au fournisseur et remonte ses erreurs', async () => {
    const inner = new CountingProvider();
    const core = newCore(inner);
    const ok = await core.handle({ method: 'GET', path: '/provider/test' });
    assert.equal(ok.status, 200);
    assert.equal((ok.body as { ok: boolean }).ok, true);
    assert.equal(inner.lastSearch?.platform, 'taobao');
    inner.fail = true;
    const ko = await core.handle({ method: 'GET', path: '/provider/test' });
    assert.equal(ko.status, 429);
  });

  it('refuse de commander un article ajouté depuis une autre source', async () => {
    const store = new Store({ uuid: nodeRuntime.uuid });
    const demoCore = createCore({ store, provider: new MockProvider(), runtime: nodeRuntime, demoMode: true });
    const login = await demoCore.handle({ method: 'POST', path: '/auth/login', body: { identifier: 'demo@roysti.app', password: 'demo1234' } });
    const token = (login.body as { token: string }).token;
    const detail = new MockProvider().all().find((p) => !p.moq && p.skus.every((s) => s.stock > 0))!;
    const selection = Object.fromEntries(detail.props.map((p) => [p.pid, p.values[0]!.vid]));
    const added = await demoCore.handle({ method: 'POST', path: '/cart', token, body: { platform: detail.platform, itemId: detail.itemId, selection, quantity: 1 } });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    assert.equal((added.body as { provider: string }).provider, 'mock');
    // Même stockage, mais l'application est passée à un vrai fournisseur.
    const realCore = createCore({ store, provider: new CountingProvider(), runtime: nodeRuntime, demoMode: true });
    const cartId = (added.body as { id: string }).id;
    const r = await realCore.handle({ method: 'POST', path: '/orders/checkout', token, body: { cartItemIds: [cartId] } });
    assert.equal(r.status, 400);
    assert.equal((r.body as { code: string }).code, 'provider_changed');
  });

  it('crée les fournisseurs à partir des réglages', () => {
    assert.throws(() => providerFromSettings({ provider: 'onebound', onebound: { key: 'k', secret: ' ' } }), ProviderConfigError);
    assert.throws(() => providerFromSettings({ provider: 'tmapi' }), ProviderConfigError);
    assert.equal(providerFromSettings({ provider: 'tmapi', tmapi: { token: 't' } }).name, 'tmapi');
    assert.equal(providerFromSettings({ provider: 'onebound', onebound: { key: 'k', secret: 's' } }).platforms.length, 6);
    assert.equal(providerFromSettings({ provider: 'mock' }).isDemo, true);
    assert.throws(() => settingsFromEnv('inconnu'), ProviderConfigError);
  });
});
