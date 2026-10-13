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
