import { COUNTRIES, SHIPPING_LINES, config, type ShippingLine, type ValueAddedService } from '../config.js';

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface QuoteInput {
  country: string;
  weightKg: number;
  dimensions?: Dimensions;
  /** Le colis contient des articles sensibles (batterie, liquide, poudre, cosmétique). */
  sensitive?: boolean;
  /** Valeur déclarée (CNY) si l'assurance est souscrite. */
  insuredValue?: number;
}

export interface ShippingQuote {
  lineId: string;
  name: string;
  carrier: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
  actualWeightKg: number;
  volumetricWeightKg: number | null;
  chargeableWeightKg: number;
  freight: number;
  fuelSurcharge: number;
  handlingFee: number;
  insurance: number;
  total: number;
  deliveryDays: [number, number];
  trackable: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Poids volumétrique (kg) = L × l × h (cm) / diviseur. */
export function volumetricWeight(d: Dimensions, divisor: number): number {
  return (d.lengthCm * d.widthCm * d.heightCm) / divisor;
}

export function insurancePremium(value: number): number {
  if (value <= 0) return 0;
  return round2(Math.max(config.insurance.min, value * config.insurance.rate));
}

export function quoteLine(line: ShippingLine, input: QuoteInput): ShippingQuote {
  const country = COUNTRIES.find((c) => c.code === input.country.toUpperCase());
  const actual = Math.max(0, input.weightKg);
  const volumetric =
    line.volumetricDivisor && input.dimensions ? volumetricWeight(input.dimensions, line.volumetricDivisor) : null;
  const chargeable = Math.max(actual, volumetric ?? 0);

  const base = {
    lineId: line.id,
    name: line.name,
    carrier: line.carrier,
    description: line.description,
    actualWeightKg: round2(actual),
    volumetricWeightKg: volumetric === null ? null : round2(volumetric),
    chargeableWeightKg: round2(chargeable),
    deliveryDays: line.deliveryDays,
    trackable: line.trackable,
  };
  const unavailable = (reason: string): ShippingQuote => ({
    ...base,
    available: false,
    unavailableReason: reason,
    freight: 0,
    fuelSurcharge: 0,
    handlingFee: 0,
    insurance: 0,
    total: 0,
  });

  if (!country) return unavailable('Pays non desservi');
  const zoneMultiplier = line.zones[country.zone];
  if (zoneMultiplier === undefined) return unavailable(`Ligne indisponible vers ${country.name}`);
  if (input.sensitive && !line.acceptsSensitive) return unavailable("N'accepte pas les articles sensibles");
  if (chargeable > line.maxWeightKg) return unavailable(`Poids maximum ${line.maxWeightKg} kg`);
  if (chargeable < line.minWeightKg) return unavailable(`Poids minimum ${line.minWeightKg} kg`);

  // Tarif par tranches : première tranche + tranches supplémentaires entamées.
  const extraSteps = Math.max(0, Math.ceil(round2(chargeable - line.firstWeightKg) / line.stepKg));
  const freight = (line.firstPrice + extraSteps * line.stepPrice) * zoneMultiplier;
  const fuelSurcharge = freight * line.fuelSurchargeRate;
  const insurance = input.insuredValue ? insurancePremium(input.insuredValue) : 0;
  const handlingFee = config.parcel.handlingFee;

  return {
    ...base,
    available: true,
    freight: round2(freight),
    fuelSurcharge: round2(fuelSurcharge),
    handlingFee,
    insurance,
    total: round2(freight + fuelSurcharge + handlingFee + insurance),
  };
}

/** Devis pour toutes les lignes, disponibles d'abord, triées par prix croissant. */
export function quoteAll(input: QuoteInput): ShippingQuote[] {
  return SHIPPING_LINES.map((line) => quoteLine(line, input)).sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.total - b.total;
  });
}

export interface PackItem {
  weightKg: number;
  volumeCm3: number;
  quantity: number;
}

/**
 * Estime le poids et les dimensions d'un colis à partir des articles et des services choisis.
 * C'est une estimation : le poids réel est mesuré à l'emballage.
 */
export function estimateParcel(items: PackItem[], services: ValueAddedService[]) {
  let weight = items.reduce((sum, i) => sum + i.weightKg * i.quantity, 0) * config.parcel.packagingWeightFactor;
  let volume = items.reduce((sum, i) => sum + i.volumeCm3 * i.quantity, 0) * 1.2;
  for (const s of services) {
    if (s.weightFactor) {
      weight *= s.weightFactor;
      volume *= s.weightFactor;
    }
    if (s.volumeFactor) volume *= s.volumeFactor;
    if (s.extraWeightKg) weight += s.extraWeightKg;
  }
  // Boîte cubique équivalente, arrondie au centimètre supérieur.
  const side = Math.max(10, Math.ceil(Math.cbrt(volume)));
  return {
    weightKg: round2(Math.max(0.1, weight)),
    dimensions: { lengthCm: side, widthCm: side, heightCm: side } satisfies Dimensions,
  };
}
