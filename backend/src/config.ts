/**
 * Paramètres métier de l'agent d'achat.
 *
 * IMPORTANT : tous les montants ci-dessous sont des valeurs PAR DÉFAUT pour la démo,
 * exprimées en CNY. Ce ne sont PAS les tarifs officiels de Superbuy ou de CSSBuy
 * (leurs grilles changent souvent et les sources publiques se contredisent).
 * Adaptez-les à vos propres contrats transporteurs et à votre modèle économique.
 */
import type { Platform } from './types.js';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  /** Active les routes /api/demo/* qui simulent le travail de l'entrepôt. */
  demoMode: (process.env.DEMO_MODE ?? 'true') === 'true',
  /** Fichier de persistance JSON (vide = mémoire uniquement). */
  dataFile: process.env.DATA_FILE ?? '',
  provider: process.env.PRODUCT_PROVIDER ?? 'mock',

  fees: {
    /** Frais de service de l'agent, en pourcentage du prix des articles, par plateforme. */
    serviceFeeRate: {
      taobao: 0.05,
      tmall: 0.05,
      '1688': 0.05,
      alibaba: 0.05,
      jd: 0.05,
      weidian: 0.05,
    } satisfies Record<Platform, number>,
    /** Frais de service minimum par commande vendeur. */
    serviceFeeMinPerOrder: 0,
    /** Délai de paiement d'une commande avant annulation automatique (heures). */
    paymentDeadlineHours: 72,
  },

  storage: {
    /** Jours de stockage gratuit à partir de l'arrivée en entrepôt. */
    freeDays: 90,
    /** Frais par article et par jour au-delà de la période gratuite. */
    feePerItemPerDay: 0.1,
    /** Durée maximale de stockage (jours). */
    maxDays: 180,
  },

  qc: {
    /** Nombre de photos de contrôle qualité offertes par article. */
    freePhotos: 3,
  },

  /** Services à valeur ajoutée. scope = où le service est proposé. */
  valueAddedServices: [
    { id: 'extra_photos', scope: 'item', name: 'Photos QC supplémentaires (x3)', price: 3, description: '3 photos détaillées en plus des photos offertes.' },
    { id: 'measurement', scope: 'item', name: 'Mesures détaillées', price: 5, description: 'Mesures (longueur, largeur, tour…) photographiées avec un mètre.' },
    { id: 'inspection', scope: 'item', name: 'Inspection détaillée', price: 10, description: 'Vérification des fonctions, coutures, défauts visibles.' },
    { id: 'remove_packaging', scope: 'parcel', name: "Retirer les emballages d'origine", price: 0, description: 'Réduit le poids et le volume (boîtes, sachets).', weightFactor: 0.85 },
    { id: 'bubble_wrap', scope: 'parcel', name: 'Papier bulle', price: 5, description: 'Protection des objets fragiles.', extraWeightKg: 0.1 },
    { id: 'corner_protection', scope: 'parcel', name: "Protections d'angles", price: 5, description: 'Renforts en carton sur les angles du colis.', extraWeightKg: 0.1 },
    { id: 'vacuum', scope: 'parcel', name: 'Mise sous vide', price: 10, description: 'Compresse les vêtements pour réduire le volume.', volumeFactor: 0.6 },
    { id: 'reinforced_box', scope: 'parcel', name: 'Carton renforcé', price: 15, description: 'Carton double cannelure.', extraWeightKg: 0.3 },
    { id: 'rehearsal', scope: 'parcel', name: 'Pré-emballage (répétition)', price: 20, description: "Le colis est emballé et pesé, photos envoyées avant l'expédition définitive." },
  ] as ValueAddedService[],

  insurance: {
    /** Prime d'assurance = taux × valeur déclarée (minimum appliqué). */
    rate: 0.03,
    min: 5,
  },

  parcel: {
    /** Marge d'emballage appliquée au poids des articles pour l'estimation. */
    packagingWeightFactor: 1.1,
    /** Frais d'opération (emballage, étiquetage) par colis. */
    handlingFee: 8,
  },

  /**
   * Adresse de l'entrepôt en Chine à communiquer aux vendeurs pour les transferts.
   * Valeur par défaut volontairement fictive : configurez WAREHOUSE_ADDRESS en production.
   */
  warehouse: {
    recipient: process.env.WAREHOUSE_RECIPIENT ?? 'Roysti 仓库',
    address: process.env.WAREHOUSE_ADDRESS ?? 'À configurer (variable WAREHOUSE_ADDRESS)',
    phone: process.env.WAREHOUSE_PHONE ?? 'À configurer',
  },

  /** Montant offert au compte de démonstration. */
  demoStartingBalance: 3000,
};

export interface ValueAddedService {
  id: string;
  scope: 'item' | 'parcel';
  name: string;
  price: number;
  description: string;
  weightFactor?: number;
  volumeFactor?: number;
  extraWeightKg?: number;
}

export type Zone = 'asia' | 'europe_na' | 'africa' | 'other';

export interface Country {
  code: string;
  name: string;
  zone: Zone;
}

export const COUNTRIES: Country[] = [
  { code: 'FR', name: 'France', zone: 'europe_na' },
  { code: 'BE', name: 'Belgique', zone: 'europe_na' },
  { code: 'CH', name: 'Suisse', zone: 'europe_na' },
  { code: 'LU', name: 'Luxembourg', zone: 'europe_na' },
  { code: 'DE', name: 'Allemagne', zone: 'europe_na' },
  { code: 'ES', name: 'Espagne', zone: 'europe_na' },
  { code: 'IT', name: 'Italie', zone: 'europe_na' },
  { code: 'GB', name: 'Royaume-Uni', zone: 'europe_na' },
  { code: 'US', name: 'États-Unis', zone: 'europe_na' },
  { code: 'CA', name: 'Canada', zone: 'europe_na' },
  { code: 'MG', name: 'Madagascar', zone: 'africa' },
  { code: 'RE', name: 'La Réunion', zone: 'africa' },
  { code: 'MU', name: 'Maurice', zone: 'africa' },
  { code: 'KM', name: 'Comores', zone: 'africa' },
  { code: 'SN', name: 'Sénégal', zone: 'africa' },
  { code: 'CI', name: "Côte d'Ivoire", zone: 'africa' },
  { code: 'CM', name: 'Cameroun', zone: 'africa' },
  { code: 'CD', name: 'RD Congo', zone: 'africa' },
  { code: 'MA', name: 'Maroc', zone: 'africa' },
  { code: 'DZ', name: 'Algérie', zone: 'africa' },
  { code: 'TN', name: 'Tunisie', zone: 'africa' },
  { code: 'JP', name: 'Japon', zone: 'asia' },
  { code: 'KR', name: 'Corée du Sud', zone: 'asia' },
  { code: 'SG', name: 'Singapour', zone: 'asia' },
  { code: 'AU', name: 'Australie', zone: 'other' },
  { code: 'BR', name: 'Brésil', zone: 'other' },
];

export interface ShippingLine {
  id: string;
  name: string;
  carrier: string;
  description: string;
  /** Poids de la première tranche (kg) et son prix. */
  firstWeightKg: number;
  firstPrice: number;
  /** Tranche additionnelle (kg) et son prix. */
  stepKg: number;
  stepPrice: number;
  /** Diviseur volumétrique (cm³/kg). null = facturation au poids réel uniquement. */
  volumetricDivisor: number | null;
  /** Surcharge carburant en pourcentage du fret. */
  fuelSurchargeRate: number;
  minWeightKg: number;
  maxWeightKg: number;
  deliveryDays: [number, number];
  /** Multiplicateur de prix par zone (absent = ligne non disponible pour la zone). */
  zones: Partial<Record<Zone, number>>;
  /** Accepte les articles sensibles (batteries, liquides, cosmétiques). */
  acceptsSensitive: boolean;
  trackable: boolean;
}

/** Lignes d'expédition de démonstration (tarifs fictifs, à remplacer par vos contrats). */
export const SHIPPING_LINES: ShippingLine[] = [
  {
    id: 'dhl',
    name: 'DHL Express',
    carrier: 'DHL',
    description: 'Express porte-à-porte, dédouanement géré par le transporteur.',
    firstWeightKg: 0.5,
    firstPrice: 210,
    stepKg: 0.5,
    stepPrice: 55,
    volumetricDivisor: 5000,
    fuelSurchargeRate: 0.15,
    minWeightKg: 0,
    maxWeightKg: 70,
    deliveryDays: [4, 8],
    zones: { asia: 0.7, europe_na: 1, africa: 1.35, other: 1.2 },
    acceptsSensitive: false,
    trackable: true,
  },
  {
    id: 'fedex',
    name: 'FedEx International Priority',
    carrier: 'FedEx',
    description: 'Express international, alternative à DHL.',
    firstWeightKg: 0.5,
    firstPrice: 200,
    stepKg: 0.5,
    stepPrice: 52,
    volumetricDivisor: 5000,
    fuelSurchargeRate: 0.15,
    minWeightKg: 0,
    maxWeightKg: 68,
    deliveryDays: [5, 9],
    zones: { asia: 0.7, europe_na: 1, africa: 1.4, other: 1.2 },
    acceptsSensitive: false,
    trackable: true,
  },
  {
    id: 'ems',
    name: 'EMS',
    carrier: 'China Post EMS',
    description: 'Service postal express, souvent moins taxé à la douane.',
    firstWeightKg: 0.5,
    firstPrice: 125,
    stepKg: 0.5,
    stepPrice: 38,
    volumetricDivisor: 6000,
    fuelSurchargeRate: 0,
    minWeightKg: 0,
    maxWeightKg: 30,
    deliveryDays: [10, 20],
    zones: { asia: 0.75, europe_na: 1, africa: 1.1, other: 1.15 },
    acceptsSensitive: false,
    trackable: true,
  },
  {
    id: 'air_special',
    name: 'Ligne aérienne spéciale',
    carrier: 'Ligne consolidée',
    description: 'Ligne économique acceptant les articles sensibles (batteries intégrées, cosmétiques).',
    firstWeightKg: 0.5,
    firstPrice: 95,
    stepKg: 0.5,
    stepPrice: 32,
    volumetricDivisor: 6000,
    fuelSurchargeRate: 0.05,
    minWeightKg: 0,
    maxWeightKg: 20,
    deliveryDays: [12, 25],
    zones: { europe_na: 1, africa: 1.2, other: 1.25 },
    acceptsSensitive: true,
    trackable: true,
  },
  {
    id: 'sal',
    name: 'SAL (courrier économique)',
    carrier: 'China Post',
    description: 'Avion économique, facturé au poids réel. Délais longs.',
    firstWeightKg: 1,
    firstPrice: 95,
    stepKg: 1,
    stepPrice: 60,
    volumetricDivisor: null,
    fuelSurchargeRate: 0,
    minWeightKg: 0,
    maxWeightKg: 30,
    deliveryDays: [20, 45],
    zones: { asia: 0.8, europe_na: 1, africa: 1.1, other: 1.1 },
    acceptsSensitive: false,
    trackable: true,
  },
  {
    id: 'sea',
    name: 'Fret maritime',
    carrier: 'Groupage maritime',
    description: 'Pour les gros volumes (meubles, stocks 1688). Minimum 10 kg.',
    firstWeightKg: 10,
    firstPrice: 260,
    stepKg: 1,
    stepPrice: 18,
    volumetricDivisor: 6000,
    fuelSurchargeRate: 0,
    minWeightKg: 10,
    maxWeightKg: 500,
    deliveryDays: [40, 70],
    zones: { europe_na: 1, africa: 1.15, other: 1.2 },
    acceptsSensitive: true,
    trackable: true,
  },
];

/**
 * Taux de change de secours (1 CNY = x devise), utilisés uniquement si le service de taux
 * en ligne est injoignable. Valeurs APPROXIMATIVES, à ne pas utiliser pour facturer.
 */
export const FALLBACK_RATES: Record<string, number> = {
  CNY: 1,
  EUR: 0.125,
  USD: 0.14,
  GBP: 0.105,
  CAD: 0.195,
  CHF: 0.115,
  MGA: 630,
  XOF: 82,
  XAF: 82,
  MAD: 1.3,
};

export const SUPPORTED_CURRENCIES = Object.keys(FALLBACK_RATES);
