import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { createCore } from './core/api.js';
import { env } from './lib/env.js';
import { nodeRuntime } from './core/nodeRuntime.js';
import type { Runtime } from './core/runtime.js';
import { createSenders, type Senders } from './messaging/index.js';
import { createProvider } from './providers/index.js';
import type { ProductProvider } from './providers/types.js';
import { Store } from './store/db.js';
import { createFileStore } from './store/fileStore.js';

export interface AppOptions {
  store?: Store;
  provider?: ProductProvider;
  runtime?: Runtime;
  demoMode?: boolean;
  seed?: boolean;
  senders?: Senders;
}

function bearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** Serveur HTTP : simple adaptateur Express autour du cœur portable (core/api.ts). */
export function createApp(options: AppOptions = {}) {
  const runtime = options.runtime ?? nodeRuntime;
  const store = options.store ?? (config.dataFile ? createFileStore(config.dataFile, runtime) : new Store({ uuid: runtime.uuid }));
  const core = createCore({
    store,
    provider: options.provider ?? createProvider(),
    runtime,
    demoMode: options.demoMode ?? config.demoMode,
    seed: options.seed,
    // SMS/e-mail réels si configurés (SMS_PROVIDER, EMAIL_PROVIDER), sinon démonstration.
    senders: options.senders ?? createSenders(),
  });

  const app = express();
  app.disable('x-powered-by');
  // Derrière un proxy (Render, Fly, nginx…), TRUST_PROXY permet de lire la vraie adresse IP du client
  // (limites d'envoi de codes par client). Ex. TRUST_PROXY=1 pour un seul proxy.
  const trustProxy = env('TRUST_PROXY');
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', async (req, res) => {
    const result = await core.handle({ method: req.method, path: req.path, query: req.query as Record<string, unknown>, body: req.body, token: bearerToken(req), clientId: req.ip });
    if (result.body === undefined) res.status(result.status).end();
    else res.status(result.status).json(result.body);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable', code: 'not_found' });
  });

  // Erreurs levées avant le cœur (JSON mal formé, corps trop volumineux…).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'JSON invalide', code: 'invalid_json' });
      return;
    }
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ error: 'Requête refusée', code: 'bad_request' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur', code: 'internal_error' });
  });

  return { app, store, provider: core.provider, accounts: core.accounts, shop: core.shop, core };
}
