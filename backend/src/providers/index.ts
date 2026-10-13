import { config } from '../config.js';
import { MockProvider } from './mock.js';
import { OneboundProvider } from './onebound.js';
import type { ProductProvider } from './types.js';
import { env } from '../lib/env.js';

export function createProvider(name = config.provider): ProductProvider {
  if (name === 'onebound') {
    const key = env('ONEBOUND_KEY');
    const secret = env('ONEBOUND_SECRET');
    if (!key || !secret) throw new Error('PRODUCT_PROVIDER=onebound nécessite ONEBOUND_KEY et ONEBOUND_SECRET');
    return new OneboundProvider(key, secret);
  }
  return new MockProvider();
}

export { MockProvider, OneboundProvider };
export type { ProductProvider };
