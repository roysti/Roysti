import { FALLBACK_RATES, SUPPORTED_CURRENCIES } from '../config.js';

export interface RatesSnapshot {
  base: 'CNY';
  rates: Record<string, number>;
  source: 'live' | 'fallback';
  updatedAt: string;
}

const RATES_URL = process.env.RATES_URL ?? 'https://open.er-api.com/v6/latest/CNY';
const TTL_MS = 6 * 60 * 60 * 1000;

let cache: RatesSnapshot | null = null;

function fallback(): RatesSnapshot {
  return { base: 'CNY', rates: { ...FALLBACK_RATES }, source: 'fallback', updatedAt: new Date().toISOString() };
}

/**
 * Taux de change depuis le CNY. Interroge un service public (mis en cache 6 h)
 * et revient aux taux approximatifs de config.ts en cas d'échec.
 */
export async function getRates(fetcher: typeof fetch = fetch): Promise<RatesSnapshot> {
  if (cache && Date.now() - new Date(cache.updatedAt).getTime() < TTL_MS) return cache;
  if (process.env.RATES_OFFLINE === 'true') return (cache = fallback());
  try {
    const res = await fetcher(RATES_URL, { signal: AbortSignal.timeout(5000) });
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!res.ok || !json.rates) throw new Error('Réponse de taux invalide');
    const rates: Record<string, number> = {};
    for (const code of SUPPORTED_CURRENCIES) {
      const value = json.rates[code];
      rates[code] = typeof value === 'number' && value > 0 ? value : FALLBACK_RATES[code]!;
    }
    cache = { base: 'CNY', rates, source: 'live', updatedAt: new Date().toISOString() };
  } catch {
    cache = fallback();
  }
  return cache;
}

export function resetRatesCache() {
  cache = null;
}
