import { COUNTRIES, SHIPPING_LINES, config, type ValueAddedService } from '../config.js';
import { HttpError, badRequest, notFound } from '../lib/errors.js';
import { findSku, round2, serviceFee, skuLabel, unitPrice } from '../lib/pricing.js';
import { seededRandom } from '../lib/random.js';
import { estimateParcel, insurancePremium, quoteAll, quoteLine, type ShippingQuote } from '../lib/shipping.js';
import type { ProductProvider } from '../providers/types.js';
import type { Store } from '../store/db.js';
import type { CartItem, Order, OrderItem, Parcel, WarehouseItem } from '../store/models.js';
import type { Platform } from '../types.js';
import type { AccountService } from './account.js';

const DAY_MS = 24 * 3600 * 1000;

export const ORDER_STATUS_LABELS: Record<Order['status'], string> = {
  pending_payment: 'En attente de paiement',
  paid: "Payée – en cours d'achat",
  purchased: 'Achetée auprès du vendeur',
  shipped_domestic: "Expédiée par le vendeur vers l'entrepôt",
  awaiting_arrival: "En attente d'arrivée à l'entrepôt",
  in_warehouse: 'Arrivée en entrepôt – photos QC disponibles',
  canceled: 'Annulée',
};

export const PARCEL_STATUS_LABELS: Record<Parcel['status'], string> = {
  pending_payment: "En attente de paiement de l'expédition",
  paid: 'Payé – en attente de préparation',
  packing: 'En cours d’emballage',
  packed: 'Emballé et pesé',
  shipped: 'Expédié à l’international',
  delivered: 'Livré',
  canceled: 'Annulé',
};

export interface AddToCartInput {
  platform: Platform;
  itemId: string;
  selection: Record<string, string>;
  quantity: number;
  remark?: string;
  services?: string[];
}

export interface ParcelInput {
  itemIds: string[];
  country: string;
  services?: string[];
  insured?: boolean;
  sensitive?: boolean;
  couponCode?: string;
}

function servicesById(ids: string[] | undefined, scope: ValueAddedService['scope']): ValueAddedService[] {
  const unique = [...new Set(ids ?? [])];
  return unique.map((id) => {
    const service = config.valueAddedServices.find((s) => s.id === id && s.scope === scope);
    if (!service) throw badRequest(`Service inconnu : ${id}`);
    return service;
  });
}

export function storageInfo(item: Pick<WarehouseItem, 'arrivedAt'>, now = Date.now()) {
  const daysStored = Math.max(0, Math.floor((now - new Date(item.arrivedAt).getTime()) / DAY_MS));
  const paidDays = Math.max(0, daysStored - config.storage.freeDays);
  return {
    daysStored,
    freeDaysLeft: Math.max(0, config.storage.freeDays - daysStored),
    maxDaysLeft: Math.max(0, config.storage.maxDays - daysStored),
    storageFee: round2(paidDays * config.storage.feePerItemPerDay),
  };
}

export class ShopService {
  constructor(
    private readonly store: Store,
    private readonly provider: ProductProvider,
    private readonly accounts: AccountService,
  ) {}

  private get data() {
    return this.store.data;
  }

  // ---------- Panier ----------

  /**
   * Recharge l'article chez le fournisseur, vérifie options, stock et quantité minimum
   * pour `quantity`, et renvoie le prix unitaire applicable (paliers de gros compris).
   * Le prix n'est jamais repris du client ni d'un calcul antérieur.
   */
  private async priceFor(platform: Platform, itemId: string, selection: Record<string, string>, quantity: number, origin?: string) {
    // Un article ajouté depuis une autre source (ex. catalogue de démo avant de brancher une API)
    // ne doit pas être repricé avec un article réel qui porterait le même identifiant.
    if (origin !== undefined && origin !== this.provider.name) {
      throw badRequest('La source des articles a changé depuis l’ajout au panier : retirez cet article puis ajoutez-le à nouveau', 'provider_changed');
    }
    const product = await this.provider.getProduct(platform, itemId);
    if (!product) throw notFound('Article');
    const sku = findSku(product, selection);
    if (product.props.length && !sku) throw badRequest('Veuillez choisir toutes les options (couleur, taille…)');
    const stock = sku?.stock ?? product.stock;
    if (stock <= 0) throw badRequest('Cette option est en rupture de stock');
    if (quantity > stock) throw badRequest(`Stock insuffisant (${stock} disponibles)`);
    if (product.moq && quantity < product.moq) throw badRequest(`Quantité minimum de commande : ${product.moq}`);
    const price = unitPrice(product, sku, quantity);
    // Prix inconnu chez le fournisseur (renvoyé comme 0 ou -1) : on ne commande jamais à 0 ¥.
    if (!(price > 0)) throw badRequest('Prix indisponible pour cet article : réessayez plus tard ou contactez le support', 'price_unavailable');
    return { product, sku, unitPrice: price };
  }

  async addToCart(userId: string, input: AddToCartInput): Promise<CartItem> {
    const { product, sku, unitPrice: price } = await this.priceFor(input.platform, input.itemId, input.selection, input.quantity);
    const services = servicesById(input.services, 'item').map((s) => s.id);
    const remark = (input.remark ?? '').trim();

    const existing = this.data.cart.find(
      (c) => c.userId === userId && c.productId === product.id && (c.skuId ?? '') === (sku?.skuId ?? '') && c.remark === remark,
    );
    if (existing) {
      // La quantité cumulée est revérifiée (stock) et repricée (palier de gros).
      const merged = await this.priceFor(existing.platform, existing.itemId, existing.selection, existing.quantity + input.quantity, existing.provider ?? 'mock');
      existing.quantity += input.quantity;
      existing.unitPrice = merged.unitPrice;
      existing.domesticShipping = merged.product.domesticShipping;
      existing.services = [...new Set([...existing.services, ...services])];
      this.store.save();
      return existing;
    }

    const dims = product.packageDims;
    const item: CartItem = {
      id: this.store.id(),
      userId,
      productId: product.id,
      platform: product.platform,
      itemId: product.itemId,
      title: product.title,
      image: (sku && product.props[0]?.values.find((v) => v.vid === sku.props[product.props[0]!.pid])?.image) || product.image,
      shopName: product.shopName ?? product.seller.name,
      skuId: sku?.skuId,
      skuLabel: skuLabel(product, input.selection),
      selection: input.selection,
      unitPrice: price,
      quantity: input.quantity,
      moq: product.moq,
      domesticShipping: product.domesticShipping,
      weightKg: product.weightKg ?? 0.5,
      // Sans dimensions fournies, on suppose un volume proportionnel au poids (5 000 cm³/kg).
      volumeCm3: dims ? dims.lengthCm * dims.widthCm * dims.heightCm : Math.round((product.weightKg ?? 0.5) * 5000),
      remark,
      services,
      sourceUrl: product.sourceUrl,
      provider: this.provider.name,
      sensitive: product.sensitive ?? false,
      addedAt: new Date().toISOString(),
    };
    this.data.cart.push(item);
    this.store.save();
    return item;
  }

  async updateCartItem(userId: string, id: string, patch: { quantity?: number; remark?: string }) {
    const item = this.data.cart.find((c) => c.id === id && c.userId === userId);
    if (!item) throw notFound('Article du panier');
    if (patch.quantity !== undefined) {
      if (patch.quantity < 1) throw badRequest('Quantité invalide');
      // Nouveau palier de prix, stock et quantité minimum revérifiés.
      const priced = await this.priceFor(item.platform, item.itemId, item.selection, patch.quantity, item.provider ?? 'mock');
      item.quantity = patch.quantity;
      item.unitPrice = priced.unitPrice;
      item.domesticShipping = priced.product.domesticShipping;
      item.moq = priced.product.moq;
    }
    if (patch.remark !== undefined) item.remark = patch.remark.trim();
    this.store.save();
    return item;
  }

  removeCartItems(userId: string, ids: string[]) {
    this.data.cart = this.data.cart.filter((c) => !(c.userId === userId && ids.includes(c.id)));
    this.store.save();
  }

  cart(userId: string) {
    const items = this.data.cart.filter((c) => c.userId === userId);
    const groups = this.groupByShop(items).map((g) => ({ ...g, ...this.orderTotals(g.platform, g.items) }));
    return { groups, count: items.reduce((s, i) => s + i.quantity, 0) };
  }

  private groupByShop(items: CartItem[]) {
    const groups = new Map<string, { key: string; platform: Platform; shopName: string; items: CartItem[] }>();
    for (const item of items) {
      const key = `${item.platform}|${item.shopName}`;
      const group = groups.get(key) ?? { key, platform: item.platform, shopName: item.shopName, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  private orderTotals(platform: Platform, items: Pick<CartItem, 'unitPrice' | 'quantity' | 'domesticShipping' | 'services'>[]) {
    const itemsTotal = round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
    // Un vendeur facture généralement le port une seule fois par commande : on retient le plus élevé.
    const domesticShipping = round2(Math.max(0, ...items.map((i) => i.domesticShipping)));
    const fee = serviceFee(platform, itemsTotal);
    const servicesTotal = round2(items.reduce((s, i) => s + servicesById(i.services, 'item').reduce((a, v) => a + v.price, 0), 0));
    return { itemsTotal, domesticShipping, serviceFee: fee, servicesTotal, total: round2(itemsTotal + domesticShipping + fee + servicesTotal) };
  }

  // ---------- Coupons ----------

  private couponDiscount(userId: string, code: string | undefined, appliesTo: 'order' | 'parcel', amount: number): number {
    if (!code) return 0;
    const coupon = this.data.coupons.find((c) => c.code === code.trim().toUpperCase());
    if (!coupon || coupon.appliesTo !== appliesTo) throw badRequest('Code promo invalide pour cette opération', 'invalid_coupon');
    if (new Date(coupon.expiresAt).getTime() < Date.now()) throw badRequest('Code promo expiré', 'invalid_coupon');
    if ((this.data.usedCoupons[userId] ?? []).includes(coupon.code)) throw badRequest('Code promo déjà utilisé', 'invalid_coupon');
    if (amount < coupon.minSpend) throw badRequest(`Montant minimum ${coupon.minSpend} CNY pour ce code`, 'invalid_coupon');
    return Math.min(coupon.amount, amount);
  }

  private markCouponUsed(userId: string, code: string) {
    const normalized = code.trim().toUpperCase();
    this.data.usedCoupons[userId] = [...(this.data.usedCoupons[userId] ?? []), normalized];
  }

  coupons(userId: string) {
    const used = this.data.usedCoupons[userId] ?? [];
    return this.data.coupons.map((c) => ({ ...c, used: used.includes(c.code), expired: new Date(c.expiresAt).getTime() < Date.now() }));
  }

  // ---------- Commandes ----------

  async checkout(userId: string, cartItemIds: string[], couponCode?: string): Promise<Order[]> {
    const items = this.data.cart.filter((c) => c.userId === userId && cartItemIds.includes(c.id));
    if (!items.length) throw badRequest('Aucun article sélectionné');
    // Prix, port et disponibilité réactualisés au moment de commander.
    const snapshot = items.map((item) => ({ item, quantity: item.quantity }));
    for (const item of items) {
      try {
        const priced = await this.priceFor(item.platform, item.itemId, item.selection, item.quantity, item.provider ?? 'mock');
        item.unitPrice = priced.unitPrice;
        item.domesticShipping = priced.product.domesticShipping;
      } catch (err) {
        if (err instanceof HttpError) throw new HttpError(err.status, `« ${item.title} » : ${err.message}`, err.code);
        throw err;
      }
    }
    // Avec un fournisseur réel, les appels ci-dessus prennent du temps : le panier a pu être
    // commandé ou modifié entre-temps par une autre requête. On refuse plutôt que de commander deux fois.
    if (snapshot.some(({ item, quantity }) => !this.data.cart.includes(item) || item.quantity !== quantity)) {
      throw new HttpError(409, 'Le panier a changé pendant la commande : vérifiez-le puis réessayez', 'cart_changed');
    }
    const groups = this.groupByShop(items).map((g) => ({ ...g, totals: this.orderTotals(g.platform, g.items) }));
    const grandTotal = groups.reduce((s, g) => s + g.totals.itemsTotal, 0);
    const discount = this.couponDiscount(userId, couponCode, 'order', grandTotal);

    const now = new Date().toISOString();
    const orders = groups.map((g, index): Order => {
      const orderDiscount = index === 0 ? discount : 0;
      return {
        id: this.store.id(),
        number: this.store.nextNumber('order'),
        userId,
        type: 'purchase',
        platform: g.platform,
        shopName: g.shopName,
        items: g.items.map(
          (c): OrderItem => ({
            id: this.store.id(),
            productId: c.productId,
            title: c.title,
            image: c.image,
            skuLabel: c.skuLabel,
            unitPrice: c.unitPrice,
            quantity: c.quantity,
            remark: c.remark,
            services: c.services,
            sourceUrl: c.sourceUrl,
            weightKg: c.weightKg,
            volumeCm3: c.volumeCm3,
            sensitive: c.sensitive,
          }),
        ),
        status: 'pending_payment',
        ...g.totals,
        discount: orderDiscount,
        total: round2(Math.max(0, g.totals.total - orderDiscount)),
        couponCode: orderDiscount ? couponCode?.toUpperCase() : undefined,
        createdAt: now,
        events: [{ status: 'pending_payment', at: now, note: 'Commande créée' }],
      };
    });

    if (discount && couponCode) this.markCouponUsed(userId, couponCode);
    this.data.orders.unshift(...orders);
    this.removeCartItems(userId, items.map((i) => i.id));
    this.store.save();
    return orders;
  }

  payOrders(userId: string, orderIds: string[]): Order[] {
    const orders = this.data.orders.filter((o) => o.userId === userId && orderIds.includes(o.id));
    if (!orders.length) throw notFound('Commande');
    if (orders.some((o) => o.status !== 'pending_payment')) throw badRequest('Une des commandes a déjà été payée ou annulée');
    const total = round2(orders.reduce((s, o) => s + o.total, 0));
    this.accounts.charge(userId, total, 'order_payment', `Paiement de ${orders.length} commande(s)`, orders.map((o) => o.number).join(','));
    for (const order of orders) {
      order.paidAt = new Date().toISOString();
      this.setOrderStatus(order, 'paid', 'Paiement reçu, un acheteur va passer commande chez le vendeur');
    }
    return orders;
  }

  cancelOrder(userId: string, orderId: string): Order {
    const order = this.getOrder(userId, orderId);
    if (order.status === 'pending_payment' || order.status === 'awaiting_arrival') {
      this.setOrderStatus(order, 'canceled', 'Annulée par le client');
    } else if (order.status === 'paid') {
      this.accounts.credit(userId, order.total, 'refund', `Remboursement commande ${order.number}`, order.number);
      this.setOrderStatus(order, 'canceled', 'Annulée par le client – remboursée sur le solde');
    } else {
      throw badRequest("La commande a déjà été achetée auprès du vendeur : demandez un retour depuis l'entrepôt");
    }
    return order;
  }

  getOrder(userId: string, orderId: string): Order {
    const order = this.data.orders.find((o) => o.id === orderId && o.userId === userId);
    if (!order) throw notFound('Commande');
    return order;
  }

  orders(userId: string, status?: string) {
    return this.data.orders.filter((o) => o.userId === userId && (!status || o.status === status));
  }

  createForwarding(
    userId: string,
    input: { carrier: string; trackingNumber: string; description: string; quantity: number; declaredValue: number; weightKg?: number },
  ): Order {
    const now = new Date().toISOString();
    const weightKg = input.weightKg ?? 1;
    const order: Order = {
      id: this.store.id(),
      number: this.store.nextNumber('order'),
      userId,
      type: 'forwarding',
      platform: 'other',
      shopName: `Transfert – ${input.carrier}`,
      items: [
        {
          id: this.store.id(),
          productId: 'forwarding',
          title: input.description,
          image: 'mock://wholesale/forwarding',
          skuLabel: `Suivi ${input.trackingNumber}`,
          unitPrice: round2(input.declaredValue / Math.max(1, input.quantity)),
          quantity: input.quantity,
          remark: '',
          services: [],
          sourceUrl: '',
          weightKg: weightKg / Math.max(1, input.quantity),
          volumeCm3: Math.round(weightKg * 5000),
          sensitive: false,
        },
      ],
      status: 'awaiting_arrival',
      itemsTotal: input.declaredValue,
      domesticShipping: 0,
      serviceFee: 0,
      servicesTotal: 0,
      discount: 0,
      total: 0,
      domesticTracking: input.trackingNumber,
      createdAt: now,
      events: [{ status: 'awaiting_arrival', at: now, note: `Colis ${input.carrier} ${input.trackingNumber} déclaré` }],
    };
    this.data.orders.unshift(order);
    this.store.save();
    return order;
  }

  private setOrderStatus(order: Order, status: Order['status'], note?: string) {
    order.status = status;
    order.events.push({ status, at: new Date().toISOString(), note });
    this.accounts.notify(order.userId, `Commande ${order.number}`, `${ORDER_STATUS_LABELS[status]}${note ? ` – ${note}` : ''}`, `/orders/${order.id}`);
    this.store.save();
  }

  // ---------- Entrepôt ----------

  private receiveOrder(order: Order) {
    const now = new Date().toISOString();
    for (const item of order.items) {
      const rnd = seededRandom(`qc:${item.id}`);
      const photoCount = config.qc.freePhotos + (item.services.includes('extra_photos') ? 3 : 0) + (item.services.includes('measurement') ? 1 : 0);
      this.data.warehouse.push({
        id: this.store.id(),
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.number,
        title: item.title,
        image: item.image,
        skuLabel: item.skuLabel,
        quantity: item.quantity,
        // Poids réellement mesuré à la réception (simulé : ±10 % autour de l'estimation).
        weightKg: round2(item.weightKg * item.quantity * rnd.between(0.9, 1.1)),
        volumeCm3: item.volumeCm3 * item.quantity,
        value: round2(item.unitPrice * item.quantity),
        qcPhotos: Array.from({ length: photoCount }, (_, i) => `mock://qc/${item.id}-${i}`),
        sensitive: item.sensitive,
        arrivedAt: now,
        status: 'stored',
      });
    }
  }

  warehouse(userId: string) {
    return this.data.warehouse
      .filter((w) => w.userId === userId && w.status !== 'shipped' && w.status !== 'returned')
      .map((w) => ({ ...w, storage: storageInfo(w) }));
  }

  private getWarehouseItem(userId: string, id: string): WarehouseItem {
    const item = this.data.warehouse.find((w) => w.id === id && w.userId === userId);
    if (!item) throw notFound("Article d'entrepôt");
    return item;
  }

  requestExtraPhotos(userId: string, id: string): WarehouseItem {
    const item = this.getWarehouseItem(userId, id);
    if (item.status !== 'stored') throw badRequest("L'article n'est plus disponible en entrepôt");
    const service = config.valueAddedServices.find((s) => s.id === 'extra_photos')!;
    this.accounts.charge(userId, service.price, 'service', `${service.name} – ${item.title}`, item.orderNumber);
    const start = item.qcPhotos.length;
    item.qcPhotos.push(...Array.from({ length: 3 }, (_, i) => `mock://qc/${item.id}-${start + i}`));
    this.store.save();
    return item;
  }

  requestReturn(userId: string, id: string, reason: string): WarehouseItem {
    const item = this.getWarehouseItem(userId, id);
    if (item.status !== 'stored') throw badRequest("Seuls les articles en stock peuvent être retournés");
    const ageDays = storageInfo(item).daysStored;
    if (ageDays > 7) throw badRequest('Les retours au vendeur sont possibles dans les 7 jours suivant l’arrivée');
    item.status = 'return_requested';
    item.returnReason = reason;
    this.accounts.notify(userId, 'Demande de retour enregistrée', `${item.title} : ${reason}`);
    this.store.save();
    return item;
  }

  // ---------- Colis ----------

  private parcelItems(userId: string, itemIds: string[], allowInParcel?: string) {
    if (!itemIds.length) throw badRequest('Sélectionnez au moins un article');
    const items = itemIds.map((id) => this.getWarehouseItem(userId, id));
    for (const item of items) {
      const ok = item.status === 'stored' || (allowInParcel && item.parcelId === allowInParcel);
      if (!ok) throw badRequest(`« ${item.title} » n'est pas disponible pour un nouveau colis`);
    }
    return items;
  }

  quoteParcel(userId: string, input: ParcelInput) {
    if (!COUNTRIES.some((c) => c.code === input.country.toUpperCase())) throw badRequest('Pays non desservi');
    const items = this.parcelItems(userId, input.itemIds);
    const services = servicesById(input.services, 'parcel');
    const estimate = estimateParcel(
      items.map((i) => ({ weightKg: i.weightKg, volumeCm3: i.volumeCm3, quantity: 1 })),
      services,
    );
    const declaredValue = round2(items.reduce((s, i) => s + i.value, 0));
    const sensitive = !!input.sensitive || items.some((i) => i.sensitive);
    const quotes = quoteAll({
      country: input.country,
      weightKg: estimate.weightKg,
      dimensions: estimate.dimensions,
      sensitive,
      insuredValue: input.insured ? declaredValue : undefined,
    });
    const servicesTotal = round2(services.reduce((s, v) => s + v.price, 0));
    const storageFee = round2(items.reduce((s, i) => s + storageInfo(i).storageFee, 0));
    return {
      estimate,
      declaredValue,
      sensitive,
      insurance: input.insured ? insurancePremium(declaredValue) : 0,
      servicesTotal,
      storageFee,
      quotes,
    };
  }

  createParcel(userId: string, input: ParcelInput & { addressId: string; lineId: string }): Parcel {
    const address = this.data.addresses.find((a) => a.id === input.addressId && a.userId === userId);
    if (!address) throw notFound('Adresse');
    const items = this.parcelItems(userId, input.itemIds);
    const line = SHIPPING_LINES.find((l) => l.id === input.lineId);
    if (!line) throw badRequest('Ligne d’expédition inconnue');
    const quote = this.quoteParcel(userId, { ...input, country: address.country });
    const lineQuote = quote.quotes.find((q) => q.lineId === line.id) as ShippingQuote;
    if (!lineQuote.available) throw badRequest(`Ligne indisponible : ${lineQuote.unavailableReason}`);
    const subtotal = round2(lineQuote.total + quote.servicesTotal + quote.storageFee);
    const discount = this.couponDiscount(userId, input.couponCode, 'parcel', subtotal);
    if (discount && input.couponCode) this.markCouponUsed(userId, input.couponCode);

    const now = new Date().toISOString();
    const { id: _id, userId: _u, isDefault: _d, ...addressSnapshot } = address;
    const parcel: Parcel = {
      id: this.store.id(),
      number: this.store.nextNumber('parcel'),
      userId,
      itemIds: items.map((i) => i.id),
      address: addressSnapshot,
      lineId: line.id,
      lineName: line.name,
      services: servicesById(input.services, 'parcel').map((s) => s.id),
      insured: !!input.insured,
      declaredValue: quote.declaredValue,
      estimatedWeightKg: quote.estimate.weightKg,
      dimensions: quote.estimate.dimensions,
      quote: lineQuote,
      servicesTotal: quote.servicesTotal,
      storageFee: quote.storageFee,
      discount,
      couponCode: discount ? input.couponCode?.toUpperCase() : undefined,
      total: round2(subtotal - discount),
      status: 'pending_payment',
      packingPhotos: [],
      createdAt: now,
      events: [{ status: 'pending_payment', at: now, note: 'Colis soumis' }],
    };
    for (const item of items) {
      item.status = 'in_parcel';
      item.parcelId = parcel.id;
    }
    this.data.parcels.unshift(parcel);
    this.store.save();
    return parcel;
  }

  getParcel(userId: string, parcelId: string): Parcel {
    const parcel = this.data.parcels.find((p) => p.id === parcelId && p.userId === userId);
    if (!parcel) throw notFound('Colis');
    return parcel;
  }

  parcels(userId: string) {
    return this.data.parcels.filter((p) => p.userId === userId);
  }

  parcelWithItems(userId: string, parcelId: string) {
    const parcel = this.getParcel(userId, parcelId);
    return { ...parcel, items: this.data.warehouse.filter((w) => parcel.itemIds.includes(w.id)) };
  }

  payParcel(userId: string, parcelId: string): Parcel {
    const parcel = this.getParcel(userId, parcelId);
    if (parcel.status !== 'pending_payment') throw badRequest('Ce colis a déjà été payé ou annulé');
    this.accounts.charge(userId, parcel.total, 'parcel_payment', `Expédition du colis ${parcel.number} (${parcel.lineName})`, parcel.number);
    this.setParcelStatus(parcel, 'paid', 'Paiement reçu, le colis va être préparé');
    return parcel;
  }

  cancelParcel(userId: string, parcelId: string): Parcel {
    const parcel = this.getParcel(userId, parcelId);
    if (parcel.status !== 'pending_payment' && parcel.status !== 'paid') throw badRequest('Le colis est déjà en préparation');
    if (parcel.status === 'paid') this.accounts.credit(userId, parcel.total, 'refund', `Remboursement colis ${parcel.number}`, parcel.number);
    for (const item of this.data.warehouse.filter((w) => parcel.itemIds.includes(w.id))) {
      item.status = 'stored';
      item.parcelId = undefined;
    }
    this.setParcelStatus(parcel, 'canceled', 'Colis annulé, articles remis en stock');
    return parcel;
  }

  private setParcelStatus(parcel: Parcel, status: Parcel['status'], note?: string) {
    parcel.status = status;
    parcel.events.push({ status, at: new Date().toISOString(), note });
    this.accounts.notify(parcel.userId, `Colis ${parcel.number}`, `${PARCEL_STATUS_LABELS[status]}${note ? ` – ${note}` : ''}`, `/parcels/${parcel.id}`);
    this.store.save();
  }

  // ---------- Simulation de l'entrepôt (mode démo) ----------

  /** Fait avancer une commande à l'étape suivante, comme le ferait l'équipe d'achat. */
  advanceOrder(userId: string, orderId: string): Order {
    const order = this.getOrder(userId, orderId);
    const next: Partial<Record<Order['status'], [Order['status'], string]>> = {
      paid: ['purchased', 'Commande passée chez le vendeur'],
      purchased: ['shipped_domestic', `Expédié par le vendeur – suivi SF${seededRandom(order.id).digits(12)}`],
      shipped_domestic: ['in_warehouse', 'Colis reçu, contrôlé et photographié'],
      awaiting_arrival: ['in_warehouse', 'Colis reçu, contrôlé et photographié'],
    };
    const step = next[order.status];
    if (!step) throw badRequest(`Aucune étape suivante pour le statut « ${ORDER_STATUS_LABELS[order.status]} »`);
    if (step[0] === 'in_warehouse') this.receiveOrder(order);
    this.setOrderStatus(order, step[0], step[1]);
    return order;
  }

  advanceParcel(userId: string, parcelId: string): Parcel {
    const parcel = this.getParcel(userId, parcelId);
    const rnd = seededRandom(`parcel:${parcel.id}`);
    switch (parcel.status) {
      case 'paid':
        this.setParcelStatus(parcel, 'packing', 'Préparation en cours');
        break;
      case 'packing': {
        // Pesée réelle puis régularisation de la différence sur le solde.
        const actual = round2(parcel.estimatedWeightKg * rnd.between(0.9, 1.08));
        const line = SHIPPING_LINES.find((l) => l.id === parcel.lineId)!;
        const requote = quoteLine(line, {
          country: parcel.address.country,
          weightKg: actual,
          dimensions: parcel.dimensions,
          insuredValue: parcel.insured ? parcel.declaredValue : undefined,
        });
        const adjustment = requote.available ? round2(requote.total - parcel.quote.total) : 0;
        parcel.actualWeightKg = actual;
        parcel.adjustment = adjustment;
        parcel.packingPhotos = Array.from({ length: 3 }, (_, i) => `mock://qc/${parcel.id}-pack${i}`);
        if (adjustment < 0) this.accounts.credit(userId, -adjustment, 'adjustment', `Trop-perçu sur le colis ${parcel.number}`, parcel.number);
        if (adjustment > 0) this.accounts.forceCharge(userId, adjustment, 'adjustment', `Complément de port du colis ${parcel.number}`, parcel.number);
        this.setParcelStatus(parcel, 'packed', `Poids réel ${actual} kg (estimé ${parcel.estimatedWeightKg} kg)`);
        break;
      }
      case 'packed':
        parcel.trackingNumber = `${parcel.lineId.toUpperCase()}${rnd.digits(10)}CN`;
        for (const item of this.data.warehouse.filter((w) => parcel.itemIds.includes(w.id))) item.status = 'shipped';
        this.setParcelStatus(parcel, 'shipped', `Numéro de suivi ${parcel.trackingNumber}`);
        break;
      case 'shipped':
        this.setParcelStatus(parcel, 'delivered', 'Colis remis au destinataire');
        break;
      default:
        throw badRequest(`Aucune étape suivante pour le statut « ${PARCEL_STATUS_LABELS[parcel.status]} »`);
    }
    return parcel;
  }

  completeReturn(userId: string, id: string): WarehouseItem {
    const item = this.getWarehouseItem(userId, id);
    if (item.status !== 'return_requested') throw new HttpError(400, 'Aucun retour en cours pour cet article');
    item.status = 'returned';
    this.accounts.credit(userId, item.value, 'refund', `Remboursement après retour – ${item.title}`, item.orderNumber);
    this.store.save();
    return item;
  }
}
