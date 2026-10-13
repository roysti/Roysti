import { Router } from 'express';
import { z } from 'zod';
import { HttpError, notFound } from '../lib/errors.js';
import type { ProductProvider } from '../providers/types.js';
import type { AccountService } from '../services/account.js';
import { ORDER_STATUS_LABELS, PARCEL_STATUS_LABELS, type ShopService } from '../services/shop.js';
import type { Store } from '../store/db.js';
import { PLATFORMS } from '../types.js';
import { currentUser, parse, requireAuth } from './validate.js';

const ids = z.array(z.string().min(1)).min(1).max(200);

const parcelSchema = z.object({
  itemIds: ids,
  country: z.string().length(2),
  services: z.array(z.string()).max(20).default([]),
  insured: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  couponCode: z.string().max(40).optional(),
});

export function shopRoutes(store: Store, provider: ProductProvider, accounts: AccountService, shop: ShopService, demoMode: boolean) {
  const router = Router();
  router.use(requireAuth(accounts));

  router.get('/statuses', (_req, res) => {
    res.json({ orders: ORDER_STATUS_LABELS, parcels: PARCEL_STATUS_LABELS });
  });

  // Panier
  router.get('/cart', (_req, res) => {
    res.json(shop.cart(currentUser(res).id));
  });

  router.post('/cart', async (req, res) => {
    const input = parse(
      z.object({
        platform: z.enum(PLATFORMS),
        itemId: z.string().regex(/^\d{4,20}$/),
        selection: z.record(z.string(), z.string()).default({}),
        quantity: z.number().int().min(1).max(100000),
        remark: z.string().max(500).optional(),
        services: z.array(z.string()).max(10).optional(),
      }),
      req.body,
    );
    res.status(201).json(await shop.addToCart(currentUser(res).id, input));
  });

  router.patch('/cart/:id', (req, res) => {
    const patch = parse(z.object({ quantity: z.number().int().min(1).max(100000).optional(), remark: z.string().max(500).optional() }), req.body);
    res.json(shop.updateCartItem(currentUser(res).id, req.params.id!, patch));
  });

  router.delete('/cart/:id', (req, res) => {
    shop.removeCartItems(currentUser(res).id, [req.params.id!]);
    res.status(204).end();
  });

  // Commandes
  router.post('/orders/checkout', (req, res) => {
    const input = parse(z.object({ cartItemIds: ids, couponCode: z.string().max(40).optional() }), req.body);
    res.status(201).json(shop.checkout(currentUser(res).id, input.cartItemIds, input.couponCode || undefined));
  });

  router.post('/orders/pay', (req, res) => {
    const input = parse(z.object({ orderIds: ids }), req.body);
    res.json(shop.payOrders(currentUser(res).id, input.orderIds));
  });

  router.get('/orders', (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json(shop.orders(currentUser(res).id, status));
  });

  router.get('/orders/:id', (req, res) => {
    res.json(shop.getOrder(currentUser(res).id, req.params.id!));
  });

  router.post('/orders/:id/cancel', (req, res) => {
    res.json(shop.cancelOrder(currentUser(res).id, req.params.id!));
  });

  // Transfert de colis (l'utilisateur a acheté lui-même et fait livrer à l'entrepôt)
  router.post('/forwarding', (req, res) => {
    const input = parse(
      z.object({
        carrier: z.string().min(2).max(40),
        trackingNumber: z.string().min(6).max(40),
        description: z.string().min(2).max(200),
        quantity: z.number().int().min(1).max(10000),
        declaredValue: z.number().min(0).max(1000000),
        weightKg: z.number().positive().max(500).optional(),
      }),
      req.body,
    );
    res.status(201).json(shop.createForwarding(currentUser(res).id, input));
  });

  // Entrepôt
  router.get('/warehouse', (_req, res) => {
    res.json(shop.warehouse(currentUser(res).id));
  });

  router.post('/warehouse/:id/photos', (req, res) => {
    res.json(shop.requestExtraPhotos(currentUser(res).id, req.params.id!));
  });

  router.post('/warehouse/:id/return', (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().min(3).max(500) }), req.body);
    res.json(shop.requestReturn(currentUser(res).id, req.params.id!, reason));
  });

  // Colis
  router.post('/parcels/quote', (req, res) => {
    res.json(shop.quoteParcel(currentUser(res).id, parse(parcelSchema, req.body)));
  });

  router.post('/parcels', (req, res) => {
    const input = parse(parcelSchema.omit({ country: true }).extend({ addressId: z.string().min(1), lineId: z.string().min(1) }), req.body);
    res.status(201).json(shop.createParcel(currentUser(res).id, { ...input, country: '' }));
  });

  router.get('/parcels', (_req, res) => {
    res.json(shop.parcels(currentUser(res).id));
  });

  router.get('/parcels/:id', (req, res) => {
    res.json(shop.parcelWithItems(currentUser(res).id, req.params.id!));
  });

  router.post('/parcels/:id/pay', (req, res) => {
    res.json(shop.payParcel(currentUser(res).id, req.params.id!));
  });

  router.post('/parcels/:id/cancel', (req, res) => {
    res.json(shop.cancelParcel(currentUser(res).id, req.params.id!));
  });

  // Coupons
  router.get('/coupons', (_req, res) => {
    res.json(shop.coupons(currentUser(res).id));
  });

  // Favoris
  router.get('/favorites', (_req, res) => {
    res.json(store.data.favorites.filter((f) => f.userId === currentUser(res).id));
  });

  router.post('/favorites', async (req, res) => {
    const user = currentUser(res);
    const input = parse(z.object({ platform: z.enum(PLATFORMS), itemId: z.string().regex(/^\d{4,20}$/) }), req.body);
    const product = await provider.getProduct(input.platform, input.itemId);
    if (!product) throw notFound('Article');
    if (!store.data.favorites.some((f) => f.userId === user.id && f.productId === product.id)) {
      store.data.favorites.unshift({
        userId: user.id,
        productId: product.id,
        title: product.title,
        image: product.image,
        price: product.price,
        platform: product.platform,
        addedAt: new Date().toISOString(),
      });
      store.save();
    }
    res.status(201).json({ ok: true });
  });

  router.delete('/favorites/:productId', (req, res) => {
    const user = currentUser(res);
    store.data.favorites = store.data.favorites.filter((f) => !(f.userId === user.id && f.productId === req.params.productId));
    store.save();
    res.status(204).end();
  });

  // Simulation du travail de l'entrepôt (désactivable avec DEMO_MODE=false)
  router.use('/demo', (_req, _res, next) => {
    if (!demoMode) throw new HttpError(404, 'Mode démo désactivé');
    next();
  });
  router.post('/demo/orders/:id/advance', (req, res) => {
    res.json(shop.advanceOrder(currentUser(res).id, req.params.id!));
  });
  router.post('/demo/parcels/:id/advance', (req, res) => {
    res.json(shop.advanceParcel(currentUser(res).id, req.params.id!));
  });
  router.post('/demo/warehouse/:id/complete-return', (req, res) => {
    res.json(shop.completeReturn(currentUser(res).id, req.params.id!));
  });

  return router;
}
