import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from './api';
import { useSession } from './session';

interface Rates {
  base: 'CNY';
  rates: Record<string, number>;
  source: 'live' | 'fallback';
  updatedAt: string;
}

const ZERO_DECIMALS = new Set(['MGA', 'XOF', 'XAF']);

export function formatAmount(amount: number, currency: string): string {
  const digits = ZERO_DECIMALS.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  } catch {
    return `${amount.toFixed(digits)} ${currency}`;
  }
}

export const formatCny = (amount: number) => `¥${amount.toFixed(2)}`;

export function useRates() {
  return useQuery({ queryKey: ['rates'], queryFn: () => api<Rates>('/rates'), staleTime: 60 * 60 * 1000 });
}

/** Convertit un montant CNY dans la devise choisie par l'utilisateur. */
export function useMoney() {
  const { currency } = useSession();
  const { data } = useRates();
  const convert = useCallback(
    (cny: number) => {
      const rate = data?.rates[currency];
      return rate ? formatAmount(cny * rate, currency) : null;
    },
    [currency, data],
  );
  return { currency, convert, ratesSource: data?.source, formatCny };
}
