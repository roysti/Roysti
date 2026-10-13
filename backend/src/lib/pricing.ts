import { config } from '../config.js';
import type { PriceTier, ProductDetail, Sku } from '../types.js';

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Prix unitaire applicable : prix du SKU, ou palier dégressif selon la quantité (gros). */
export function unitPrice(product: Pick<ProductDetail, 'price' | 'priceTiers'>, sku: Sku | undefined, quantity: number): number {
  const base = sku?.price ?? product.price;
  const tier = applicableTier(product.priceTiers, quantity);
  // Le palier s'applique au prix de base ; on conserve l'écart propre au SKU.
  if (tier) return round2(Math.max(0.01, base - product.price + tier.price));
  return base;
}

export function applicableTier(tiers: PriceTier[] | undefined, quantity: number): PriceTier | undefined {
  if (!tiers?.length) return undefined;
  return [...tiers].sort((a, b) => b.minQty - a.minQty).find((t) => quantity >= t.minQty);
}

export function serviceFee(platform: keyof typeof config.fees.serviceFeeRate, itemsSubtotal: number): number {
  const rate = config.fees.serviceFeeRate[platform] ?? 0;
  return round2(Math.max(config.fees.serviceFeeMinPerOrder, itemsSubtotal * rate));
}

/** Retrouve un SKU à partir d'une sélection pid → vid. */
export function findSku(product: Pick<ProductDetail, 'skus' | 'props'>, selection: Record<string, string>): Sku | undefined {
  if (!product.skus.length) return undefined;
  return product.skus.find((sku) => product.props.every((p) => sku.props[p.pid] === selection[p.pid]));
}

/** Libellé lisible d'un SKU, ex. « Couleur : Noir ; Taille : M ». */
export function skuLabel(product: Pick<ProductDetail, 'props'>, selection: Record<string, string>): string {
  return product.props
    .map((p) => {
      const value = p.values.find((v) => v.vid === selection[p.pid]);
      return value ? `${p.name} : ${value.name}` : null;
    })
    .filter(Boolean)
    .join(' ; ');
}
