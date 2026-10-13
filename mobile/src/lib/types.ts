/** Types partagés avec l'API (voir backend/src/types.ts et backend/src/store/models.ts). */
export type Platform = 'taobao' | 'tmall' | '1688' | 'alibaba' | 'jd' | 'weidian';
export type SortOrder = 'default' | 'price_asc' | 'price_desc' | 'sales';

export interface ProductSummary {
  id: string;
  platform: Platform;
  itemId: string;
  title: string;
  titleOriginal?: string;
  image: string;
  price: number;
  priceMax?: number;
  sales?: number;
  shopName?: string;
  location?: string;
  moq?: number;
  category?: string;
}

export interface SkuProp {
  pid: string;
  name: string;
  values: { vid: string; name: string; image?: string }[];
}

export interface Sku {
  skuId: string;
  props: Record<string, string>;
  price: number;
  stock: number;
}

export interface ProductDetail extends ProductSummary {
  images: string[];
  props: SkuProp[];
  skus: Sku[];
  priceTiers?: { minQty: number; price: number }[];
  domesticShipping: number;
  weightKg?: number;
  attributes: { name: string; value: string }[];
  descriptionImages: string[];
  descriptionText?: string;
  seller: { name: string; rating?: number; location?: string; years?: number };
  sourceUrl: string;
  stock: number;
  sensitive?: boolean;
  provider: string;
  isDemoData: boolean;
}

export interface SearchResult {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  provider: string;
  isDemoData: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface ValueAddedService {
  id: string;
  scope: 'item' | 'parcel';
  name: string;
  price: number;
  description: string;
}

export interface Meta {
  provider: string;
  isDemoData: boolean;
  demoMode: boolean;
  platforms: { id: Platform; name: string }[];
  categories: Category[];
  countries: { code: string; name: string }[];
  currencies: string[];
  shippingLines: { id: string; name: string; carrier: string; description: string; deliveryDays: [number, number] }[];
  valueAddedServices: ValueAddedService[];
  storage: { freeDays: number; feePerItemPerDay: number; maxDays: number };
  qc: { freePhotos: number };
  fees: { serviceFeeRate: Record<Platform, number> };
  insurance: { rate: number; min: number };
  warehouse: { recipient: string; address: string; phone: string };
}

export interface User {
  id: string;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  hasPassword: boolean;
  name: string;
  balance: number;
}

export type OtpChannel = 'email' | 'sms';
export type OtpPurpose = 'login' | 'verify' | 'reset';

export interface OtpSent {
  channel: OtpChannel;
  destination: string;
  destinationMasked: string;
  expiresInSec: number;
  resendInSec: number;
  demoCode?: string;
}

export interface AuthResult {
  token: string;
  user: User;
  created?: boolean;
  verification?: OtpSent;
}

export interface MeResponse {
  user: User;
  summary: {
    cart: number;
    ordersPendingPayment: number;
    ordersInProgress: number;
    warehouseItems: number;
    parcelsPendingPayment: number;
    parcelsInTransit: number;
    unreadNotifications: number;
  };
}

export interface CartItem {
  id: string;
  productId: string;
  platform: Platform;
  itemId: string;
  title: string;
  image: string;
  shopName: string;
  skuLabel: string;
  unitPrice: number;
  quantity: number;
  moq?: number;
  domesticShipping: number;
  remark: string;
  services: string[];
}

export interface CartGroup {
  key: string;
  platform: Platform;
  shopName: string;
  items: CartItem[];
  itemsTotal: number;
  domesticShipping: number;
  serviceFee: number;
  servicesTotal: number;
  total: number;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'purchased' | 'shipped_domestic' | 'awaiting_arrival' | 'in_warehouse' | 'canceled';

export interface TimelineEvent {
  status: string;
  at: string;
  note?: string;
}

export interface Order {
  id: string;
  number: string;
  type: 'purchase' | 'forwarding';
  platform: Platform | 'other';
  shopName: string;
  items: {
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
  }[];
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
  events: TimelineEvent[];
}

export interface WarehouseItem {
  id: string;
  orderId: string;
  orderNumber: string;
  title: string;
  image: string;
  skuLabel: string;
  quantity: number;
  weightKg: number;
  value: number;
  qcPhotos: string[];
  sensitive: boolean;
  arrivedAt: string;
  status: 'stored' | 'in_parcel' | 'shipped' | 'return_requested' | 'returned';
  parcelId?: string;
  storage: { daysStored: number; freeDaysLeft: number; maxDaysLeft: number; storageFee: number };
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
}

export interface ParcelQuote {
  estimate: { weightKg: number; dimensions: { lengthCm: number; widthCm: number; heightCm: number } };
  declaredValue: number;
  sensitive: boolean;
  insurance: number;
  servicesTotal: number;
  storageFee: number;
  quotes: ShippingQuote[];
}

export type ParcelStatus = 'pending_payment' | 'paid' | 'packing' | 'packed' | 'shipped' | 'delivered' | 'canceled';

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  line1: string;
  line2?: string;
  postalCode: string;
  isDefault: boolean;
}

export interface Parcel {
  id: string;
  number: string;
  itemIds: string[];
  address: Omit<Address, 'id' | 'isDefault'>;
  lineId: string;
  lineName: string;
  services: string[];
  insured: boolean;
  declaredValue: number;
  estimatedWeightKg: number;
  actualWeightKg?: number;
  dimensions: { lengthCm: number; widthCm: number; heightCm: number };
  quote: ShippingQuote;
  servicesTotal: number;
  storageFee: number;
  discount: number;
  total: number;
  adjustment?: number;
  status: ParcelStatus;
  trackingNumber?: string;
  packingPhotos: string[];
  createdAt: string;
  events: TimelineEvent[];
  items?: WarehouseItem[];
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
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
  used: boolean;
  expired: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Favorite {
  productId: string;
  title: string;
  image: string;
  price: number;
  platform: Platform;
}
