import { Router } from 'express';
import { z } from 'zod';
import { COUNTRIES, SHIPPING_LINES, SUPPORTED_CURRENCIES, config } from '../config.js';
import { CATEGORIES } from '../data/categories.js';
import { getRates } from '../lib/currency.js';
import { badRequest, notFound } from '../lib/errors.js';
import { resolveProductLink } from '../lib/linkParser.js';
import { quoteAll } from '../lib/shipping.js';
import { MockProvider, featuredFrom } from '../providers/mock.js';
import type { ProductProvider } from '../providers/types.js';
import { PLATFORMS, PLATFORM_LABELS } from '../types.js';
import { parse } from './validate.js';

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

export function catalogRoutes(provider: ProductProvider) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, provider: provider.name, demo: provider.isDemo });
  });

  router.get('/meta', (_req, res) => {
    res.json({
      provider: provider.name,
      isDemoData: provider.isDemo,
      demoMode: config.demoMode,
      platforms: provider.platforms.map((id) => ({ id, name: PLATFORM_LABELS[id] })),
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
    });
  });

  router.get('/rates', async (_req, res) => {
    res.json(await getRates());
  });

  router.get('/products/search', async (req, res) => {
    const params = parse(searchSchema, req.query);
    res.json(await provider.search(params));
  });

  router.get('/products/featured', async (_req, res) => {
    if (provider instanceof MockProvider) {
      res.json({ items: featuredFrom(provider.all()), provider: provider.name, isDemoData: true });
      return;
    }
    // Avec un vrai fournisseur, la page d'accueil affiche une recherche « tendance ».
    const result = await provider.search({ q: process.env.FEATURED_QUERY ?? '热销', page: 1, pageSize: 20, sort: 'sales' });
    res.json({ items: result.items, provider: provider.name, isDemoData: false });
  });

  router.get('/products/:platform/:itemId', async (req, res) => {
    const platform = parse(z.enum(PLATFORMS), req.params.platform);
    const itemId = parse(z.string().regex(/^\d{4,20}$/, 'Identifiant d’article invalide'), req.params.itemId);
    const product = await provider.getProduct(platform, itemId);
    if (!product) throw notFound('Article');
    res.json(product);
  });

  router.post('/links/parse', async (req, res) => {
    const { text } = parse(z.object({ text: z.string().min(4).max(2000) }), req.body);
    const parsed = await resolveProductLink(text);
    if (!parsed) throw badRequest('Lien non reconnu. Plateformes acceptées : Taobao, Tmall, 1688, Alibaba, JD, Weidian (et liens CSSBuy / Superbuy).', 'unknown_link');
    res.json(parsed);
  });

  router.post('/shipping/estimate', (req, res) => {
    const input = parse(estimateSchema, req.body);
    const dimensions =
      input.lengthCm && input.widthCm && input.heightCm
        ? { lengthCm: input.lengthCm, widthCm: input.widthCm, heightCm: input.heightCm }
        : undefined;
    res.json({
      quotes: quoteAll({ country: input.country, weightKg: input.weightKg, dimensions, sensitive: input.sensitive, insuredValue: input.insuredValue }),
    });
  });

  return router;
}
