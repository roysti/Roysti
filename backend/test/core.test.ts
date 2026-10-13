import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCore } from '../src/core/api.js';
import { constantTimeEqual, type Runtime } from '../src/core/runtime.js';
import { MockProvider } from '../src/providers/mock.js';
import { Store } from '../src/store/db.js';

process.env.RATES_OFFLINE = 'true';

/** Runtime sans node:crypto, comme dans l'application (les valeurs n'ont pas besoin d'être sûres ici). */
function fakeRuntime(): Runtime {
  let n = 0;
  return {
    uuid: () => `id-${++n}`,
    randomHex: (bytes) => (++n).toString(16).padStart(bytes * 2, '0'),
    hashPassword: (password, salt) => Array.from(`${salt}:${password}`, (c) => c.charCodeAt(0).toString(16)).join(''),
    safeEqual: constantTimeEqual,
    sha256Hex: (text) => Array.from(text, (c) => c.charCodeAt(0).toString(16)).join(''),
  };
}

function newCore(options: { demoMode?: boolean; persist?: (data: unknown) => void } = {}) {
  const runtime = fakeRuntime();
  return createCore({
    store: new Store({ uuid: runtime.uuid, persist: options.persist }),
    provider: new MockProvider(),
    runtime,
    demoMode: options.demoMode ?? true,
  });
}

describe('cœur portable (utilisé tel quel par l’application)', () => {
  it('répond sans Express, avec des paramètres de requête non textuels', async () => {
    const core = newCore();
    const res = await core.handle({ method: 'GET', path: '/products/search', query: { q: 'sac', page: 1, pageSize: 5, platform: undefined } });
    assert.equal(res.status, 200);
    const body = res.body as { items: unknown[]; pageSize: number };
    assert.equal(body.pageSize, 5);
    assert.ok(body.items.length > 0);
  });

  it('distingue 404, 405, 401 et 204', async () => {
    const core = newCore();
    assert.equal((await core.handle({ method: 'GET', path: '/inconnu' })).status, 404);
    assert.equal((await core.handle({ method: 'DELETE', path: '/products/search' })).status, 405);
    assert.equal((await core.handle({ method: 'GET', path: '/cart' })).status, 401);
    const login = await core.handle({ method: 'POST', path: '/auth/login', body: { email: 'demo@roysti.app', password: 'demo1234' } });
    assert.equal(login.status, 200);
    const { token } = login.body as { token: string };
    const logout = await core.handle({ method: 'POST', path: '/auth/logout', token });
    assert.deepEqual(logout, { status: 204 });
    assert.equal((await core.handle({ method: 'GET', path: '/me', token })).status, 401, 'jeton révoqué');
  });

  it('refuse un mauvais mot de passe et valide les entrées', async () => {
    const core = newCore();
    assert.equal((await core.handle({ method: 'POST', path: '/auth/login', body: { email: 'demo@roysti.app', password: 'mauvais1' } })).status, 401);
    const bad = await core.handle({ method: 'POST', path: '/auth/register', body: { email: 'pas-un-email', password: '123' } });
    assert.equal(bad.status, 400);
    assert.equal((bad.body as { code: string }).code, 'validation_error');
  });

  it('décode les paramètres de chemin (identifiants contenant « : »)', async () => {
    const core = newCore();
    const { token } = (await core.handle({ method: 'POST', path: '/auth/login', body: { email: 'demo@roysti.app', password: 'demo1234' } })).body as { token: string };
    const search = (await core.handle({ method: 'GET', path: '/products/search', query: { q: 'montre' } })).body as { items: { platform: string; itemId: string; id: string }[] };
    const item = search.items[0]!;
    assert.equal((await core.handle({ method: 'POST', path: '/favorites', token, body: { platform: item.platform, itemId: item.itemId } })).status, 201);
    const del = await core.handle({ method: 'DELETE', path: `/favorites/${encodeURIComponent(item.id)}`, token });
    assert.equal(del.status, 204);
    const favorites = (await core.handle({ method: 'GET', path: '/favorites', token })).body as unknown[];
    assert.equal(favorites.length, 0);
  });

  it('désactive les routes de simulation hors mode démo', async () => {
    const core = newCore({ demoMode: false });
    const { token } = (await core.handle({ method: 'POST', path: '/auth/login', body: { email: 'demo@roysti.app', password: 'demo1234' } })).body as { token: string };
    assert.equal((await core.handle({ method: 'POST', path: '/demo/orders/x/advance', token })).status, 404);
  });

  it('persiste les données via la fonction fournie', async () => {
    const saved: unknown[] = [];
    const core = newCore({ persist: (data) => saved.push(JSON.parse(JSON.stringify(data))) });
    await core.handle({ method: 'POST', path: '/auth/register', body: { email: 'nouveau@example.com', password: 'secret12' } });
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(saved.length >= 1);
    const last = saved.at(-1) as { users: { email: string }[] };
    assert.ok(last.users.some((u) => u.email === 'nouveau@example.com'));
  });
});

describe('graphe d’imports du cœur', () => {
  it('n’importe aucun module propre à Node ni Express (nécessaire pour Hermes)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
    const seen = new Set<string>();
    const forbidden: string[] = [];
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
        const spec = m[1]!;
        if (spec.startsWith('.')) visit(resolve(dirname(file), spec.replace(/\.js$/, '.ts')));
        else if (spec.startsWith('node:') || ['express', 'cors', 'fs', 'crypto', 'path'].includes(spec)) forbidden.push(`${file.slice(root.length)} → ${spec}`);
      }
    };
    visit(resolve(root, 'core/api.ts'));
    assert.ok(seen.size > 10, `fichiers parcourus : ${seen.size}`);
    assert.deepEqual(forbidden, []);
  });
});

describe('panier : prix toujours recalculés (constat de revue R1-2)', () => {
  async function setup() {
    const core = newCore();
    const { token } = (await core.handle({ method: 'POST', path: '/auth/login', body: { email: 'demo@roysti.app', password: 'demo1234' } })).body as { token: string };
    // Article 1688 avec paliers de gros et quantité minimum.
    const search = (await core.handle({ method: 'GET', path: '/products/search', query: { q: 'sac', platform: '1688' } })).body as { items: { itemId: string }[] };
    let product: { itemId: string; price: number; moq: number; priceTiers: { minQty: number; price: number }[]; skus: { props: Record<string, string>; stock: number; price: number }[] } | undefined;
    for (const it of search.items) {
      const p = (await core.handle({ method: 'GET', path: `/products/1688/${it.itemId}` })).body as NonNullable<typeof product>;
      if (p.skus.some((s) => s.stock >= p.priceTiers[2]!.minQty)) {
        product = p;
        break;
      }
    }
    assert.ok(product, 'article 1688 avec assez de stock');
    const sku = product.skus.find((s) => s.stock >= product!.priceTiers[2]!.minQty)!;
    return { core, token, product, sku };
  }

  it('change de palier quand la quantité change dans le panier', async () => {
    const { core, token, product, sku } = await setup();
    const big = product.priceTiers[2]!.minQty;
    const add = await core.handle({ method: 'POST', path: '/cart', token, body: { platform: '1688', itemId: product.itemId, selection: sku.props, quantity: big } });
    assert.equal(add.status, 201, JSON.stringify(add.body));
    const item = add.body as { id: string; unitPrice: number; moq: number };
    assert.equal(item.moq, product.moq);
    const bulkPrice = item.unitPrice;

    const patched = await core.handle({ method: 'PATCH', path: `/cart/${item.id}`, token, body: { quantity: product.moq } });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    const retail = (patched.body as { unitPrice: number }).unitPrice;
    assert.ok(retail > bulkPrice, `le prix unitaire doit remonter (${bulkPrice} → ${retail})`);
    // Même règle que le serveur : premier palier appliqué au prix de base, écart propre au SKU conservé.
    assert.equal(retail, Math.round((sku.price - product.price + product.priceTiers[0]!.price) * 100) / 100);
  });

  it('refuse une quantité sous le minimum ou au-delà du stock', async () => {
    const { core, token, product, sku } = await setup();
    const add = await core.handle({ method: 'POST', path: '/cart', token, body: { platform: '1688', itemId: product.itemId, selection: sku.props, quantity: product.moq } });
    const { id } = add.body as { id: string };
    if (product.moq > 1) {
      const low = await core.handle({ method: 'PATCH', path: `/cart/${id}`, token, body: { quantity: product.moq - 1 } });
      assert.equal(low.status, 400);
    }
    const high = await core.handle({ method: 'PATCH', path: `/cart/${id}`, token, body: { quantity: sku.stock + 1 } });
    assert.equal(high.status, 400);
    assert.match((high.body as { error: string }).error, /Stock insuffisant/);
    // Ajout cumulé au-delà du stock refusé.
    const merge = await core.handle({ method: 'POST', path: '/cart', token, body: { platform: '1688', itemId: product.itemId, selection: sku.props, quantity: sku.stock } });
    assert.equal(merge.status, 400);
  });

  it('recalcule les prix au moment de la commande (prix altéré dans le stockage ignoré)', async () => {
    const { core, token, product, sku } = await setup();
    const add = await core.handle({ method: 'POST', path: '/cart', token, body: { platform: '1688', itemId: product.itemId, selection: sku.props, quantity: product.moq } });
    const { id, unitPrice } = add.body as { id: string; unitPrice: number };
    core.store.data.cart.find((c) => c.id === id)!.unitPrice = 0.01;
    const orders = await core.handle({ method: 'POST', path: '/orders/checkout', token, body: { cartItemIds: [id] } });
    assert.equal(orders.status, 201, JSON.stringify(orders.body));
    const [order] = orders.body as { items: { unitPrice: number }[] }[];
    assert.equal(order!.items[0]!.unitPrice, unitPrice);
  });
});

describe('notifications bornées', () => {
  it('ne conserve que les 200 plus récentes par utilisateur', async () => {
    const core = newCore();
    const user = core.store.data.users[0]!;
    for (let i = 0; i < 250; i++) core.accounts.notify(user.id, `n${i}`, 'x');
    const mine = core.store.data.notifications.filter((n) => n.userId === user.id);
    assert.equal(mine.length, 200);
    assert.equal(mine[0]!.title, 'n249');
  });
});

describe('checkout avec un fournisseur lent (type API réelle)', () => {
  it('deux commandes simultanées du même panier n’en créent qu’une', async () => {
    const runtime = fakeRuntime();
    const mock = new MockProvider();
    // Fournisseur qui répond en 20 ms, comme une passerelle réseau.
    const slow = Object.assign(Object.create(mock) as MockProvider, {
      getProduct: async (...args: Parameters<MockProvider['getProduct']>) => {
        await new Promise((r) => setTimeout(r, 20));
        return mock.getProduct(...args);
      },
    });
    const core = createCore({ store: new Store({ uuid: runtime.uuid }), provider: slow, runtime, demoMode: true });
    const { token } = (await core.handle({ method: 'POST', path: '/auth/login', body: { email: 'demo@roysti.app', password: 'demo1234' } })).body as { token: string };
    const search = (await core.handle({ method: 'GET', path: '/products/search', query: { q: 'montre', platform: 'taobao' } })).body as { items: { itemId: string }[] };
    const product = (await core.handle({ method: 'GET', path: `/products/taobao/${search.items[0]!.itemId}` })).body as { skus: { props: Record<string, string>; stock: number }[] };
    const sku = product.skus.find((s) => s.stock > 0)!;
    const { id } = (await core.handle({ method: 'POST', path: '/cart', token, body: { platform: 'taobao', itemId: search.items[0]!.itemId, selection: sku.props, quantity: 1 } })).body as { id: string };

    const results = await Promise.all([1, 2].map(() => core.handle({ method: 'POST', path: '/orders/checkout', token, body: { cartItemIds: [id] } })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409], JSON.stringify(results.map((r) => r.body)));
    assert.equal(core.store.data.orders.length, 1);
  });
});
