import type { Platform } from '../types.js';
import type { Dimensions, ShippingQuote } from '../lib/shipping.js';

export interface User {
  id: string;
  /** E-mail normalisé (minuscules). Un compte a au moins un e-mail ou un téléphone. */
  email?: string;
  /** Téléphone au format E.164, ex. « +261341234567 ». */
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  name: string;
  /** Absents pour un compte créé par code (sans mot de passe). */
  passwordHash?: string;
  salt?: string;
  balance: number;
  createdAt: string;
}

export type OtpChannel = 'email' | 'sms';
export type OtpPurpose = 'login' | 'verify' | 'reset';

/** Code à usage unique envoyé par SMS ou e-mail (seule son empreinte est conservée). */
export interface OtpRecord {
  id: string;
  channel: OtpChannel;
  destination: string;
  purpose: OtpPurpose;
  /** Compte concerné (vérification d'un nouvel e-mail/téléphone). */
  userId?: string;
  codeHash: string;
  salt: string;
  attempts: number;
  consumed: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface Address {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  line1: string;
  line2?: string;
  postalCode: string;
  isDefault: boolean;
}

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  platform: Platform;
  itemId: string;
  title: string;
  image: string;
  shopName: string;
  skuId?: string;
  skuLabel: string;
  selection: Record<string, string>;
  unitPrice: number;
  quantity: number;
  /** Quantité minimum de commande (1688 / Alibaba). */
  moq?: number;
  domesticShipping: number;
  weightKg: number;
  volumeCm3: number;
  remark: string;
  services: string[];
  sourceUrl: string;
  sensitive: boolean;
  addedAt: string;
  /** Fournisseur d'où vient l'article (absent = catalogue de démonstration, données anciennes). */
  provider?: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'purchased'
  | 'shipped_domestic'
  | 'awaiting_arrival'
  | 'in_warehouse'
  | 'canceled';

export interface OrderEvent {
  status: string;
  at: string;
  note?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  title: string;
  image: string;
  skuLabel: string;
  unitPrice: number;
  quantity: number;
  remark: string;
  services: string[];
  sourceUrl: string;
  weightKg: number;
  volumeCm3: number;
  sensitive: boolean;
}

export interface Order {
  id: string;
  number: string;
  userId: string;
  type: 'purchase' | 'forwarding';
  platform: Platform | 'other';
  shopName: string;
  items: OrderItem[];
  status: OrderStatus;
  itemsTotal: number;
  domesticShipping: number;
  serviceFee: number;
  servicesTotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  domesticTracking?: string;
  createdAt: string;
  paidAt?: string;
  events: OrderEvent[];
}

export type WarehouseItemStatus = 'stored' | 'in_parcel' | 'shipped' | 'return_requested' | 'returned';

export interface WarehouseItem {
  id: string;
  userId: string;
  orderId: string;
  orderNumber: string;
  title: string;
  image: string;
  skuLabel: string;
  quantity: number;
  weightKg: number;
  volumeCm3: number;
  value: number;
  qcPhotos: string[];
  sensitive: boolean;
  arrivedAt: string;
  status: WarehouseItemStatus;
  parcelId?: string;
  returnReason?: string;
}

export type ParcelStatus = 'pending_payment' | 'paid' | 'packing' | 'packed' | 'shipped' | 'delivered' | 'canceled';

export interface Parcel {
  id: string;
  number: string;
  userId: string;
  itemIds: string[];
  address: Omit<Address, 'id' | 'userId' | 'isDefault'>;
  lineId: string;
  lineName: string;
  services: string[];
  insured: boolean;
  declaredValue: number;
  estimatedWeightKg: number;
  actualWeightKg?: number;
  dimensions: Dimensions;
  quote: ShippingQuote;
  servicesTotal: number;
  storageFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  adjustment?: number;
  status: ParcelStatus;
  trackingNumber?: string;
  packingPhotos: string[];
  createdAt: string;
  events: OrderEvent[];
}

export type TransactionType = 'topup' | 'order_payment' | 'parcel_payment' | 'refund' | 'adjustment' | 'service';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  reference?: string;
  note: string;
  createdAt: string;
}

export interface Coupon {
  code: string;
  description: string;
  appliesTo: 'order' | 'parcel';
  amount: number;
  minSpend: number;
  expiresAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Favorite {
  userId: string;
  productId: string;
  title: string;
  image: string;
  price: number;
  platform: Platform;
  addedAt: string;
}
