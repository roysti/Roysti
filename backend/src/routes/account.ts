import { Router } from 'express';
import { z } from 'zod';
import { COUNTRIES } from '../config.js';
import { notFound } from '../lib/errors.js';
import { publicUser, type AccountService } from '../services/account.js';
import type { Store } from '../store/db.js';
import type { Address } from '../store/models.js';
import { bearerToken, currentUser, parse, requireAuth } from './validate.js';

const credentials = z.object({
  email: z.email('E-mail invalide'),
  password: z.string().min(6, 'Mot de passe : 6 caractères minimum').max(200),
});

const addressSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().min(6).max(30),
  country: z
    .string()
    .length(2)
    .transform((c) => c.toUpperCase())
    .refine((c) => COUNTRIES.some((x) => x.code === c), 'Pays non desservi'),
  city: z.string().min(1).max(100),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  postalCode: z.string().max(20).default(''),
  isDefault: z.boolean().default(false),
});

export function accountRoutes(store: Store, accounts: AccountService) {
  const router = Router();
  const auth = requireAuth(accounts);

  router.post('/auth/register', (req, res) => {
    const input = parse(credentials.extend({ name: z.string().max(80).default('') }), req.body);
    const { user, token } = accounts.register(input.email, input.password, input.name);
    res.status(201).json({ token, user: publicUser(user) });
  });

  router.post('/auth/login', (req, res) => {
    const input = parse(credentials, req.body);
    const { user, token } = accounts.login(input.email, input.password);
    res.json({ token, user: publicUser(user) });
  });

  router.post('/auth/logout', auth, (req, res) => {
    accounts.logout(bearerToken(req)!);
    res.status(204).end();
  });

  router.get('/me', auth, (_req, res) => {
    const user = currentUser(res);
    const d = store.data;
    const mine = <T extends { userId: string }>(list: T[]) => list.filter((x) => x.userId === user.id);
    const orders = mine(d.orders);
    res.json({
      user: publicUser(user),
      summary: {
        cart: mine(d.cart).reduce((s, c) => s + c.quantity, 0),
        ordersPendingPayment: orders.filter((o) => o.status === 'pending_payment').length,
        ordersInProgress: orders.filter((o) => ['paid', 'purchased', 'shipped_domestic', 'awaiting_arrival'].includes(o.status)).length,
        warehouseItems: mine(d.warehouse).filter((w) => w.status === 'stored').length,
        parcelsPendingPayment: mine(d.parcels).filter((p) => p.status === 'pending_payment').length,
        parcelsInTransit: mine(d.parcels).filter((p) => ['paid', 'packing', 'packed', 'shipped'].includes(p.status)).length,
        unreadNotifications: mine(d.notifications).filter((n) => !n.read).length,
      },
    });
  });

  // Portefeuille
  router.get('/wallet', auth, (_req, res) => {
    const user = currentUser(res);
    res.json({
      balance: user.balance,
      transactions: store.data.transactions.filter((t) => t.userId === user.id).slice(0, 100),
      methods: ['Carte bancaire', 'PayPal', 'Mobile Money', 'Virement bancaire'],
    });
  });

  router.post('/wallet/topup', auth, (req, res) => {
    const input = parse(z.object({ amount: z.number().positive(), method: z.string().min(2).max(40) }), req.body);
    const user = accounts.topUp(currentUser(res).id, input.amount, input.method);
    res.json({ balance: user.balance });
  });

  // Adresses
  router.get('/addresses', auth, (_req, res) => {
    res.json(store.data.addresses.filter((a) => a.userId === currentUser(res).id));
  });

  const setDefault = (userId: string, id: string) => {
    for (const a of store.data.addresses) if (a.userId === userId) a.isDefault = a.id === id;
  };

  router.post('/addresses', auth, (req, res) => {
    const user = currentUser(res);
    const input = parse(addressSchema, req.body);
    const address: Address = { id: store.id(), userId: user.id, ...input };
    store.data.addresses.push(address);
    if (input.isDefault || store.data.addresses.filter((a) => a.userId === user.id).length === 1) setDefault(user.id, address.id);
    store.save();
    res.status(201).json(address);
  });

  router.put('/addresses/:id', auth, (req, res) => {
    const user = currentUser(res);
    const address = store.data.addresses.find((a) => a.id === req.params.id && a.userId === user.id);
    if (!address) throw notFound('Adresse');
    const input = parse(addressSchema, req.body);
    Object.assign(address, input);
    if (input.isDefault) setDefault(user.id, address.id);
    store.save();
    res.json(address);
  });

  router.delete('/addresses/:id', auth, (req, res) => {
    const user = currentUser(res);
    store.data.addresses = store.data.addresses.filter((a) => !(a.id === req.params.id && a.userId === user.id));
    store.save();
    res.status(204).end();
  });

  // Notifications
  router.get('/notifications', auth, (_req, res) => {
    res.json(store.data.notifications.filter((n) => n.userId === currentUser(res).id).slice(0, 100));
  });

  router.post('/notifications/read', auth, (_req, res) => {
    for (const n of store.data.notifications) if (n.userId === currentUser(res).id) n.read = true;
    store.save();
    res.status(204).end();
  });

  return router;
}
