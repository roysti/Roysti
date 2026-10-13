import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { createProvider } from './providers/index.js';
import { ProviderError, type ProductProvider } from './providers/types.js';
import { accountRoutes } from './routes/account.js';
import { catalogRoutes } from './routes/catalog.js';
import { shopRoutes } from './routes/shop.js';
import { AccountService, seedDemo } from './services/account.js';
import { ShopService } from './services/shop.js';
import { Store } from './store/db.js';

export interface AppOptions {
  store?: Store;
  provider?: ProductProvider;
  demoMode?: boolean;
  seed?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const store = options.store ?? new Store(config.dataFile);
  const provider = options.provider ?? createProvider();
  const accounts = new AccountService(store);
  const shop = new ShopService(store, provider, accounts);
  if (options.seed ?? true) seedDemo(store, accounts);

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', catalogRoutes(provider));
  app.use('/api', accountRoutes(store, accounts));
  app.use('/api', shopRoutes(store, provider, accounts, shop, options.demoMode ?? config.demoMode));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable', code: 'not_found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError || err instanceof ProviderError) {
      res.status(err.status).json({ error: err.message, code: err instanceof HttpError ? err.code : 'provider_error' });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'JSON invalide', code: 'invalid_json' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur', code: 'internal_error' });
  });

  return { app, store, provider, accounts, shop };
}
