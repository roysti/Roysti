import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { randomUUID } from 'node:crypto';
import { MockProvider } from '../src/providers/mock.js';
import { Store } from '../src/store/db.js';

process.env.RATES_OFFLINE = 'true';

describe('API – parcours complet', () => {
  // Store en mémoire explicite : les tests ne touchent jamais DATA_FILE.
  const { app } = createApp({ store: new Store({ uuid: randomUUID }), provider: new MockProvider(), demoMode: true });
  let token = '';
  const auth = () => ({ Authorization: `Bearer ${token}` });

  before(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'demo@roysti.app', password: 'demo1234' });
    assert.equal(res.status, 200);
    token = res.body.token;
  });

  it('expose les métadonnées et les taux', async () => {
    const meta = await request(app).get('/api/meta');
    assert.equal(meta.status, 200);
    assert.ok(meta.body.platforms.some((p: { id: string }) => p.id === '1688'));
    assert.ok(meta.body.categories.length > 10);
    const rates = await request(app).get('/api/rates');
    assert.equal(rates.body.source, 'fallback');
    assert.equal(rates.body.rates.CNY, 1);
  });

  it('recherche multi-plateformes avec filtres et tri', async () => {
    const res = await request(app).get('/api/products/search').query({ q: 't-shirt', sort: 'price_asc' });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length > 0);
    const platforms = new Set(res.body.items.map((i: { platform: string }) => i.platform));
    assert.ok(platforms.size > 1, 'plusieurs plateformes attendues');
    const prices = res.body.items.map((i: { price: number }) => i.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

    const only1688 = await request(app).get('/api/products/search').query({ q: 'sac', platform: '1688' });
    assert.ok(only1688.body.items.every((i: { platform: string }) => i.platform === '1688'));

    const chinese = await request(app).get('/api/products/search').query({ q: '耳机' });
    assert.ok(chinese.body.items.length > 0);

    const bad = await request(app).get('/api/products/search').query({ platform: 'amazon' });
    assert.equal(bad.status, 400);
  });

  it('analyse un lien puis affiche la fiche produit', async () => {
    const search = await request(app).get('/api/products/search').query({ q: 'sac à dos', platform: '1688' });
    const first = search.body.items[0];
    const link = await request(app).post('/api/links/parse').send({ text: `https://detail.1688.com/offer/${first.itemId}.html` });
    assert.deepEqual(link.body, { platform: '1688', itemId: first.itemId });

    const detail = await request(app).get(`/api/products/1688/${first.itemId}`);
    assert.equal(detail.status, 200);
    assert.ok(detail.body.skus.length > 0);
    assert.ok(detail.body.priceTiers.length === 3);
    assert.ok(detail.body.moq >= 1);

    const unknown = await request(app).post('/api/links/parse').send({ text: 'https://example.com/x' });
    assert.equal(unknown.status, 400);
  });

  it('protège les routes privées', async () => {
    assert.equal((await request(app).get('/api/cart')).status, 401);
  });

  it('panier → commande → paiement → entrepôt → colis → livraison', async () => {
    const search = await request(app).get('/api/products/search').query({ q: 't-shirt', platform: 'taobao' });
    const product = (await request(app).get(`/api/products/taobao/${search.body.items[0].itemId}`)).body;
    const sku = product.skus.find((s: { stock: number }) => s.stock > 3);

    // Le prix envoyé par le client est ignoré : il est recalculé côté serveur.
    const add = await request(app)
      .post('/api/cart')
      .set(auth())
      .send({ platform: 'taobao', itemId: product.itemId, selection: sku.props, quantity: 3, remark: 'Taille M svp', services: ['extra_photos'], price: 0.01 });
    assert.equal(add.status, 201, JSON.stringify(add.body));
    assert.equal(add.body.unitPrice, sku.price);

    const missingOption = await request(app).post('/api/cart').set(auth()).send({ platform: 'taobao', itemId: product.itemId, selection: {}, quantity: 1 });
    assert.equal(missingOption.status, 400);

    const cart = await request(app).get('/api/cart').set(auth());
    assert.equal(cart.body.groups.length, 1);
    const group = cart.body.groups[0];
    assert.equal(group.itemsTotal, Math.round(sku.price * 3 * 100) / 100);
    assert.ok(group.itemsTotal >= 100, 'le coupon BIENVENUE exige 100 CNY');
    assert.equal(group.servicesTotal, 3);

    const checkout = await request(app).post('/api/orders/checkout').set(auth()).send({ cartItemIds: [add.body.id], couponCode: 'BIENVENUE' });
    assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
    const order = checkout.body[0];
    assert.equal(order.status, 'pending_payment');
    assert.equal(order.discount, 10);

    const reused = await request(app).post('/api/cart').set(auth()).send({ platform: 'taobao', itemId: product.itemId, selection: sku.props, quantity: 1 });
    const again = await request(app).post('/api/orders/checkout').set(auth()).send({ cartItemIds: [reused.body.id], couponCode: 'BIENVENUE' });
    assert.equal(again.status, 400, 'coupon à usage unique');
    await request(app).delete(`/api/cart/${reused.body.id}`).set(auth());

    const before = (await request(app).get('/api/wallet').set(auth())).body.balance;
    const paid = await request(app).post('/api/orders/pay').set(auth()).send({ orderIds: [order.id] });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    const after = (await request(app).get('/api/wallet').set(auth())).body.balance;
    assert.equal(Math.round((before - after) * 100) / 100, order.total);

    for (const expected of ['purchased', 'shipped_domestic', 'in_warehouse']) {
      const step = await request(app).post(`/api/demo/orders/${order.id}/advance`).set(auth());
      assert.equal(step.body.status, expected);
    }

    const warehouse = await request(app).get('/api/warehouse').set(auth());
    assert.equal(warehouse.body.length, 1);
    const stored = warehouse.body[0];
    assert.equal(stored.qcPhotos.length, 6, '3 photos offertes + 3 photos supplémentaires');
    assert.equal(stored.storage.freeDaysLeft, 90);

    const addresses = (await request(app).get('/api/addresses').set(auth())).body;
    const quote = await request(app)
      .post('/api/parcels/quote')
      .set(auth())
      .send({ itemIds: [stored.id], country: 'FR', services: ['vacuum'], insured: true });
    assert.equal(quote.status, 200, JSON.stringify(quote.body));
    assert.ok(quote.body.insurance >= 5);
    const line = quote.body.quotes.find((q: { available: boolean }) => q.available);

    const parcel = await request(app)
      .post('/api/parcels')
      .set(auth())
      .send({ itemIds: [stored.id], addressId: addresses[0].id, lineId: line.lineId, services: ['vacuum'], insured: true });
    assert.equal(parcel.status, 201, JSON.stringify(parcel.body));
    assert.equal(parcel.body.total, Math.round((line.total + 10) * 100) / 100);

    const reuse = await request(app).post('/api/parcels/quote').set(auth()).send({ itemIds: [stored.id], country: 'FR' });
    assert.equal(reuse.status, 400, 'un article déjà dans un colis ne peut pas être réutilisé');

    assert.equal((await request(app).post(`/api/parcels/${parcel.body.id}/pay`).set(auth())).status, 200);
    for (const expected of ['packing', 'packed', 'shipped', 'delivered']) {
      const step = await request(app).post(`/api/demo/parcels/${parcel.body.id}/advance`).set(auth());
      assert.equal(step.body.status, expected, JSON.stringify(step.body));
    }
    const done = (await request(app).get(`/api/parcels/${parcel.body.id}`).set(auth())).body;
    assert.ok(done.trackingNumber);
    assert.ok(done.actualWeightKg > 0);
    assert.equal(done.items[0].status, 'shipped');

    const me = (await request(app).get('/api/me').set(auth())).body;
    assert.ok(me.summary.unreadNotifications > 0);
  });

  it('refuse un paiement si le solde est insuffisant', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email: 'pauvre@example.com', password: 'secret12' });
    const t = { Authorization: `Bearer ${reg.body.token}` };
    const search = await request(app).get('/api/products/search').query({ q: 'valise', platform: 'tmall' });
    const product = (await request(app).get(`/api/products/tmall/${search.body.items[0].itemId}`)).body;
    const sku = product.skus.find((s: { stock: number }) => s.stock > 0);
    const add = await request(app).post('/api/cart').set(t).send({ platform: 'tmall', itemId: product.itemId, selection: sku.props, quantity: 1 });
    const orders = await request(app).post('/api/orders/checkout').set(t).send({ cartItemIds: [add.body.id] });
    const pay = await request(app).post('/api/orders/pay').set(t).send({ orderIds: [orders.body[0].id] });
    assert.equal(pay.status, 402);
    assert.equal(pay.body.code, 'insufficient_balance');

    await request(app).post('/api/wallet/topup').set(t).send({ amount: 5000, method: 'Carte bancaire' });
    assert.equal((await request(app).post('/api/orders/pay').set(t).send({ orderIds: [orders.body[0].id] })).status, 200);
    const cancel = await request(app).post(`/api/orders/${orders.body[0].id}/cancel`).set(t);
    assert.equal(cancel.body.status, 'canceled');
    assert.equal((await request(app).get('/api/wallet').set(t)).body.balance, 5000);
  });

  it('enregistre un transfert de colis (achat fait par le client)', async () => {
    const res = await request(app)
      .post('/api/forwarding')
      .set(auth())
      .send({ carrier: 'SF Express', trackingNumber: 'SF1234567890', description: 'Pièces détachées', quantity: 3, declaredValue: 150, weightKg: 1.5 });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'awaiting_arrival');
    const step = await request(app).post(`/api/demo/orders/${res.body.id}/advance`).set(auth());
    assert.equal(step.body.status, 'in_warehouse');
  });

  it('estime les frais de port sans compte', async () => {
    const res = await request(app).post('/api/shipping/estimate').send({ country: 'MG', weightKg: 2.5, lengthCm: 40, widthCm: 30, heightCm: 20 });
    assert.equal(res.status, 200);
    assert.ok(res.body.quotes.length >= 5);
  });
});
