/**
 * API Roysti indépendante du transport HTTP.
 *
 * La même table de routes sert :
 *  - au serveur Express (backend/src/app.ts) ;
 *  - à l'application mobile, qui l'exécute directement dans Hermes (mode hors ligne).
 *
 * Ce module ne doit importer aucune API propre à Node (fs, crypto, express…).
 */
import { z } from 'zod';
import { COUNTRIES, SHIPPING_LINES, SUPPORTED_CURRENCIES, config } from '../config.js';
import { CATEGORIES } from '../data/categories.js';
import { getRates } from '../lib/currency.js';
import { env } from '../lib/env.js';
import { HttpError, badRequest, notFound } from '../lib/errors.js';
import { resolveProductLink } from '../lib/linkParser.js';
import { quoteAll } from '../lib/shipping.js';
import { MockProvider, featuredFrom } from '../providers/mock.js';
import { ProviderError, type ProductProvider } from '../providers/types.js';
import { AccountService, publicUser, seedDemo } from '../services/account.js';
import { ORDER_STATUS_LABELS, PARCEL_STATUS_LABELS, ShopService } from '../services/shop.js';
import type { Store } from '../store/db.js';
import type { Address, User } from '../store/models.js';
import { PLATFORMS, PLATFORM_LABELS } from '../types.js';
import type { Runtime } from './runtime.js';

// ---------- Requêtes / réponses ----------

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequest {
  method: string;
  /** Chemin relatif à /api, ex. « /products/search ». */
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  /** Jeton de session (en-tête Authorization: Bearer …). */
  token?: string;
}

export interface ApiResponse {
  status: number;
  /** undefined = réponse vide (204). */
  body?: unknown;
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join('.')} : ` : '';
    throw badRequest(`${path}${issue?.message ?? 'Données invalides'}`, 'validation_error');
  }
  return result.data;
}

// ---------- Cœur applicatif ----------

export interface CoreOptions {
  store: Store;
  provider: ProductProvider;
  runtime: Runtime;
  demoMode?: boolean;
  /** Crée le compte démo et les coupons (défaut : true). */
  seed?: boolean;
}

export interface Core {
  store: Store;
  provider: ProductProvider;
  accounts: AccountService;
  shop: ShopService;
  demoMode: boolean;
  handle(request: ApiRequest): Promise<ApiResponse>;
}

interface Context {
  core: Core;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  token?: string;
  /** Défini pour les routes authentifiées. */
  user: User;
}

interface Route {
  method: HttpMethod;
  path: string;
  auth?: boolean;
  /** Réservée au mode démo (simulation de l'entrepôt). */
  demo?: boolean;
  /** Statut en cas de succès (défaut 200, ou 204 si le gestionnaire ne renvoie rien). */
  status?: number;
  handler: (ctx: Context) => unknown;
}

// ---------- Schémas ----------

const itemIdSchema = z.string().regex(/^\d{4,20}$/, 'Identifiant d’article invalide');
const ids = z.array(z.string().min(1)).min(1).max(200);

const searchSchema = z.object({
  q: z.string().max(200).default(''),
  platform: z.enum(PLATFORMS).optional(),
  category: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['default', 'price_asc', 'price_desc', 'sales']).default('default'),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

const estimateSchema = z.object({
  country: z.string().length(2),
  weightKg: z.coerce.number().positive().max(500),
  lengthCm: z.coerce.number().positive().max(300).optional(),
  widthCm: z.coerce.number().positive().max(300).optional(),
  heightCm: z.coerce.number().positive().max(300).optional(),
  sensitive: z.boolean().optional(),
  insuredValue: z.coerce.number().min(0).optional(),
});

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

const parcelSchema = z.object({
  itemIds: ids,
  country: z.string().length(2),
  services: z.array(z.string()).max(20).default([]),
  insured: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  couponCode: z.string().max(40).optional(),
});

// ---------- Routes ----------

const mine = <T extends { userId: string }>(list: T[], user: User) => list.filter((x) => x.userId === user.id);

function setDefaultAddress(core: Core, userId: string, id: string) {
  for (const a of core.store.data.addresses) if (a.userId === userId) a.isDefault = a.id === id;
}

const ROUTES: Route[] = [
  // --- Catalogue (public) ---
  {
    method: 'GET',
    path: '/health',
    handler: ({ core }) => ({ ok: true, provider: core.provider.name, demo: core.provider.isDemo }),
  },
  {
    method: 'GET',
    path: '/meta',
    handler: ({ core }) => ({
      provider: core.provider.name,
      isDemoData: core.provider.isDemo,
      demoMode: core.demoMode,
      platforms: core.provider.platforms.map((id) => ({ id, name: PLATFORM_LABELS[id] })),
      categories: CATEGORIES,
      countries: COUNTRIES,
      currencies: SUPPORTED_CURRENCIES,
      shippingLines: SHIPPING_LINES.map(({ id, name, carrier, description, deliveryDays, acceptsSensitive, maxWeightKg, volumetricDivisor }) => ({
        id,
        name,
        carrier,
        description,
        deliveryDays,
        acceptsSensitive,
        maxWeightKg,
        volumetricDivisor,
      })),
      valueAddedServices: config.valueAddedServices,
      storage: config.storage,
      qc: config.qc,
      fees: config.fees,
      insurance: config.insurance,
      warehouse: config.warehouse,
    }),
  },
  { method: 'GET', path: '/rates', handler: () => getRates() },
  {
    method: 'GET',
    path: '/products/search',
    handler: ({ core, query }) => core.provider.search(parse(searchSchema, query)),
  },
  {
    method: 'GET',
    path: '/products/featured',
    handler: async ({ core }) => {
      const provider = core.provider;
      if (provider instanceof MockProvider) return { items: featuredFrom(provider.all()), provider: provider.name, isDemoData: true };
      // Avec un vrai fournisseur, la page d'accueil affiche une recherche « tendance ».
      const result = await provider.search({ q: env('FEATURED_QUERY') ?? '热销', page: 1, pageSize: 20, sort: 'sales' });
      return { items: result.items, provider: provider.name, isDemoData: false };
    },
  },
  {
    method: 'GET',
    path: '/products/:platform/:itemId',
    handler: async ({ core, params }) => {
      const platform = parse(z.enum(PLATFORMS), params.platform);
      const itemId = parse(itemIdSchema, params.itemId);
      const product = await core.provider.getProduct(platform, itemId);
      if (!product) throw notFound('Article');
      return product;
    },
  },
  {
    method: 'POST',
    path: '/links/parse',
    handler: async ({ body }) => {
      const { text } = parse(z.object({ text: z.string().min(4).max(2000) }), body);
      const parsed = await resolveProductLink(text);
      if (!parsed) throw badRequest('Lien non reconnu. Plateformes acceptées : Taobao, Tmall, 1688, Alibaba, JD, Weidian (et liens CSSBuy / Superbuy).', 'unknown_link');
      return parsed;
    },
  },
  {
    method: 'POST',
    path: '/shipping/estimate',
    handler: ({ body }) => {
      const input = parse(estimateSchema, body);
      const dimensions =
        input.lengthCm && input.widthCm && input.heightCm ? { lengthCm: input.lengthCm, widthCm: input.widthCm, heightCm: input.heightCm } : undefined;
      return { quotes: quoteAll({ country: input.country, weightKg: input.weightKg, dimensions, sensitive: input.sensitive, insuredValue: input.insuredValue }) };
    },
  },

  // --- Compte ---
  {
    method: 'POST',
    path: '/auth/register',
    status: 201,
    handler: ({ core, body }) => {
      const input = parse(credentials.extend({ name: z.string().max(80).default('') }), body);
      const { user, token } = core.accounts.register(input.email, input.password, input.name);
      return { token, user: publicUser(user) };
    },
  },
  {
    method: 'POST',
    path: '/auth/login',
    handler: ({ core, body }) => {
      const input = parse(credentials, body);
      const { user, token } = core.accounts.login(input.email, input.password);
      return { token, user: publicUser(user) };
    },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    auth: true,
    handler: ({ core, token }) => {
      core.accounts.logout(token!);
    },
  },
  {
    method: 'GET',
    path: '/me',
    auth: true,
    handler: ({ core, user }) => {
      const d = core.store.data;
      const orders = mine(d.orders, user);
      return {
        user: publicUser(user),
        summary: {
          cart: mine(d.cart, user).reduce((s, c) => s + c.quantity, 0),
          ordersPendingPayment: orders.filter((o) => o.status === 'pending_payment').length,
          ordersInProgress: orders.filter((o) => ['paid', 'purchased', 'shipped_domestic', 'awaiting_arrival'].includes(o.status)).length,
          warehouseItems: mine(d.warehouse, user).filter((w) => w.status === 'stored').length,
          parcelsPendingPayment: mine(d.parcels, user).filter((p) => p.status === 'pending_payment').length,
          parcelsInTransit: mine(d.parcels, user).filter((p) => ['paid', 'packing', 'packed', 'shipped'].includes(p.status)).length,
          unreadNotifications: mine(d.notifications, user).filter((n) => !n.read).length,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/wallet',
    auth: true,
    handler: ({ core, user }) => ({
      balance: user.balance,
      transactions: mine(core.store.data.transactions, user).slice(0, 100),
      methods: ['Carte bancaire', 'PayPal', 'Mobile Money', 'Virement bancaire'],
    }),
  },
  {
    method: 'POST',
    path: '/wallet/topup',
    auth: true,
    handler: ({ core, user, body }) => {
      const input = parse(z.object({ amount: z.number().positive(), method: z.string().min(2).max(40) }), body);
      return { balance: core.accounts.topUp(user.id, input.amount, input.method).balance };
    },
  },
  {
    method: 'GET',
    path: '/addresses',
    auth: true,
    handler: ({ core, user }) => mine(core.store.data.addresses, user),
  },
  {
    method: 'POST',
    path: '/addresses',
    auth: true,
    status: 201,
    handler: ({ core, user, body }) => {
      const input = parse(addressSchema, body);
      const address: Address = { id: core.store.id(), userId: user.id, ...input };
      core.store.data.addresses.push(address);
      if (input.isDefault || mine(core.store.data.addresses, user).length === 1) setDefaultAddress(core, user.id, address.id);
      core.store.save();
      return address;
    },
  },
  {
    method: 'PUT',
    path: '/addresses/:id',
    auth: true,
    handler: ({ core, user, params, body }) => {
      const address = core.store.data.addresses.find((a) => a.id === params.id && a.userId === user.id);
      if (!address) throw notFound('Adresse');
      const input = parse(addressSchema, body);
      Object.assign(address, input);
      if (input.isDefault) setDefaultAddress(core, user.id, address.id);
      core.store.save();
      return address;
    },
  },
  {
    method: 'DELETE',
    path: '/addresses/:id',
    auth: true,
    handler: ({ core, user, params }) => {
      core.store.data.addresses = core.store.data.addresses.filter((a) => !(a.id === params.id && a.userId === user.id));
      core.store.save();
    },
  },
  {
    method: 'GET',
    path: '/notifications',
    auth: true,
    handler: ({ core, user }) => mine(core.store.data.notifications, user).slice(0, 100),
  },
  {
    method: 'POST',
    path: '/notifications/read',
    auth: true,
    handler: ({ core, user }) => {
      for (const n of core.store.data.notifications) if (n.userId === user.id) n.read = true;
      core.store.save();
    },
  },

  // --- Achats ---
  {
    method: 'GET',
    path: '/statuses',
    auth: true,
    handler: () => ({ orders: ORDER_STATUS_LABELS, parcels: PARCEL_STATUS_LABELS }),
  },
  { method: 'GET', path: '/cart', auth: true, handler: ({ core, user }) => core.shop.cart(user.id) },
  {
    method: 'POST',
    path: '/cart',
    auth: true,
    status: 201,
    handler: ({ core, user, body }) => {
      const input = parse(
        z.object({
          platform: z.enum(PLATFORMS),
          itemId: itemIdSchema,
          selection: z.record(z.string(), z.string()).default({}),
          quantity: z.number().int().min(1).max(100000),
          remark: z.string().max(500).optional(),
          services: z.array(z.string()).max(10).optional(),
        }),
        body,
      );
      return core.shop.addToCart(user.id, input);
    },
  },
  {
    method: 'PATCH',
    path: '/cart/:id',
    auth: true,
    handler: ({ core, user, params, body }) => {
      const patch = parse(z.object({ quantity: z.number().int().min(1).max(100000).optional(), remark: z.string().max(500).optional() }), body);
      return core.shop.updateCartItem(user.id, params.id!, patch);
    },
  },
  {
    method: 'DELETE',
    path: '/cart/:id',
    auth: true,
    handler: ({ core, user, params }) => {
      core.shop.removeCartItems(user.id, [params.id!]);
    },
  },
  {
    method: 'POST',
    path: '/orders/checkout',
    auth: true,
    status: 201,
    handler: ({ core, user, body }) => {
      const input = parse(z.object({ cartItemIds: ids, couponCode: z.string().max(40).optional() }), body);
      return core.shop.checkout(user.id, input.cartItemIds, input.couponCode || undefined);
    },
  },
  {
    method: 'POST',
    path: '/orders/pay',
    auth: true,
    handler: ({ core, user, body }) => core.shop.payOrders(user.id, parse(z.object({ orderIds: ids }), body).orderIds),
  },
  {
    method: 'GET',
    path: '/orders',
    auth: true,
    handler: ({ core, user, query }) => core.shop.orders(user.id, typeof query.status === 'string' ? query.status : undefined),
  },
  { method: 'GET', path: '/orders/:id', auth: true, handler: ({ core, user, params }) => core.shop.getOrder(user.id, params.id!) },
  { method: 'POST', path: '/orders/:id/cancel', auth: true, handler: ({ core, user, params }) => core.shop.cancelOrder(user.id, params.id!) },
  {
    method: 'POST',
    path: '/forwarding',
    auth: true,
    status: 201,
    handler: ({ core, user, body }) => {
      const input = parse(
        z.object({
          carrier: z.string().min(2).max(40),
          trackingNumber: z.string().min(6).max(40),
          description: z.string().min(2).max(200),
          quantity: z.number().int().min(1).max(10000),
          declaredValue: z.number().min(0).max(1000000),
          weightKg: z.number().positive().max(500).optional(),
        }),
        body,
      );
      return core.shop.createForwarding(user.id, input);
    },
  },
  { method: 'GET', path: '/warehouse', auth: true, handler: ({ core, user }) => core.shop.warehouse(user.id) },
  { method: 'POST', path: '/warehouse/:id/photos', auth: true, handler: ({ core, user, params }) => core.shop.requestExtraPhotos(user.id, params.id!) },
  {
    method: 'POST',
    path: '/warehouse/:id/return',
    auth: true,
    handler: ({ core, user, params, body }) => {
      const { reason } = parse(z.object({ reason: z.string().min(3).max(500) }), body);
      return core.shop.requestReturn(user.id, params.id!, reason);
    },
  },
  {
    method: 'POST',
    path: '/parcels/quote',
    auth: true,
    handler: ({ core, user, body }) => core.shop.quoteParcel(user.id, parse(parcelSchema, body)),
  },
  {
    method: 'POST',
    path: '/parcels',
    auth: true,
    status: 201,
    handler: ({ core, user, body }) => {
      const input = parse(parcelSchema.omit({ country: true }).extend({ addressId: z.string().min(1), lineId: z.string().min(1) }), body);
      // Le pays est celui de l'adresse choisie ; createParcel le recalcule.
      return core.shop.createParcel(user.id, { ...input, country: '' });
    },
  },
  { method: 'GET', path: '/parcels', auth: true, handler: ({ core, user }) => core.shop.parcels(user.id) },
  { method: 'GET', path: '/parcels/:id', auth: true, handler: ({ core, user, params }) => core.shop.parcelWithItems(user.id, params.id!) },
  { method: 'POST', path: '/parcels/:id/pay', auth: true, handler: ({ core, user, params }) => core.shop.payParcel(user.id, params.id!) },
  { method: 'POST', path: '/parcels/:id/cancel', auth: true, handler: ({ core, user, params }) => core.shop.cancelParcel(user.id, params.id!) },
  { method: 'GET', path: '/coupons', auth: true, handler: ({ core, user }) => core.shop.coupons(user.id) },
  {
    method: 'GET',
    path: '/favorites',
    auth: true,
    handler: ({ core, user }) => mine(core.store.data.favorites, user),
  },
  {
    method: 'POST',
    path: '/favorites',
    auth: true,
    status: 201,
    handler: async ({ core, user, body }) => {
      const input = parse(z.object({ platform: z.enum(PLATFORMS), itemId: itemIdSchema }), body);
      const product = await core.provider.getProduct(input.platform, input.itemId);
      if (!product) throw notFound('Article');
      if (!core.store.data.favorites.some((f) => f.userId === user.id && f.productId === product.id)) {
        core.store.data.favorites.unshift({
          userId: user.id,
          productId: product.id,
          title: product.title,
          image: product.image,
          price: product.price,
          platform: product.platform,
          addedAt: new Date().toISOString(),
        });
        core.store.save();
      }
      return { ok: true };
    },
  },
  {
    method: 'DELETE',
    path: '/favorites/:productId',
    auth: true,
    handler: ({ core, user, params }) => {
      core.store.data.favorites = core.store.data.favorites.filter((f) => !(f.userId === user.id && f.productId === params.productId));
      core.store.save();
    },
  },

  // --- Simulation de l'entrepôt (désactivable avec DEMO_MODE=false) ---
  { method: 'POST', path: '/demo/orders/:id/advance', auth: true, demo: true, handler: ({ core, user, params }) => core.shop.advanceOrder(user.id, params.id!) },
  { method: 'POST', path: '/demo/parcels/:id/advance', auth: true, demo: true, handler: ({ core, user, params }) => core.shop.advanceParcel(user.id, params.id!) },
  {
    method: 'POST',
    path: '/demo/warehouse/:id/complete-return',
    auth: true,
    demo: true,
    handler: ({ core, user, params }) => core.shop.completeReturn(user.id, params.id!),
  },
];

// ---------- Aiguillage ----------

function splitPath(path: string): string[] {
  return path.split('?')[0]!.split('/').filter(Boolean);
}

const COMPILED = ROUTES.map((route) => ({ route, segments: splitPath(route.path) }));

function match(method: string, path: string): { route: Route; params: Record<string, string> } | 'method_not_allowed' | null {
  const parts = splitPath(path);
  let pathMatched = false;
  for (const { route, segments } of COMPILED) {
    if (segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = segments.every((segment, i) => {
      const part = parts[i]!;
      if (segment.startsWith(':')) {
        try {
          params[segment.slice(1)] = decodeURIComponent(part);
        } catch {
          return false;
        }
        return true;
      }
      return segment === part;
    });
    if (!ok) continue;
    pathMatched = true;
    if (route.method === method.toUpperCase()) return { route, params };
  }
  return pathMatched ? 'method_not_allowed' : null;
}

const errorBody = (message: string, code?: string) => ({ error: message, code });

export function createCore(options: CoreOptions): Core {
  const accounts = new AccountService(options.store, options.runtime);
  const shop = new ShopService(options.store, options.provider, accounts);
  if (options.seed ?? true) seedDemo(options.store, accounts);

  const core: Core = {
    store: options.store,
    provider: options.provider,
    accounts,
    shop,
    demoMode: options.demoMode ?? config.demoMode,
    async handle(request) {
      try {
        const found = match(request.method, request.path);
        if (found === null) return { status: 404, body: errorBody('Route introuvable', 'not_found') };
        if (found === 'method_not_allowed') return { status: 405, body: errorBody('Méthode non autorisée', 'method_not_allowed') };
        const { route, params } = found;
        if (route.demo && !core.demoMode) return { status: 404, body: errorBody('Mode démo désactivé', 'not_found') };

        const user = route.auth ? accounts.userForToken(request.token) : undefined;
        if (route.auth && !user) throw new HttpError(401, 'Connexion requise', 'unauthorized');

        const body = await route.handler({
          core,
          params,
          query: request.query ?? {},
          body: request.body,
          token: request.token,
          user: user as User,
        });
        if (body === undefined) return { status: 204 };
        return { status: route.status ?? 200, body };
      } catch (err) {
        if (err instanceof HttpError) return { status: err.status, body: errorBody(err.message, err.code) };
        if (err instanceof ProviderError) return { status: err.status, body: errorBody(err.message, 'provider_error') };
        console.error(err);
        return { status: 500, body: errorBody('Erreur interne du serveur', 'internal_error') };
      }
    },
  };
  return core;
}

/** Routes exposées (documentation, tests). */
export const routeList = ROUTES.map(({ method, path, auth, demo }) => ({ method, path, auth: !!auth, demo: !!demo }));
