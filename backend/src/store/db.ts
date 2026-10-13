import type { Address, CartItem, Coupon, Favorite, Notification, Order, OtpRecord, Parcel, Transaction, User, WarehouseItem } from './models.js';

export interface Data {
  users: User[];
  sessions: Record<string, string>;
  otps: OtpRecord[];
  addresses: Address[];
  cart: CartItem[];
  orders: Order[];
  warehouse: WarehouseItem[];
  parcels: Parcel[];
  transactions: Transaction[];
  coupons: Coupon[];
  usedCoupons: Record<string, string[]>;
  notifications: Notification[];
  favorites: Favorite[];
  counters: { order: number; parcel: number };
}

const empty = (): Data => ({
  users: [],
  sessions: {},
  otps: [],
  addresses: [],
  cart: [],
  orders: [],
  warehouse: [],
  parcels: [],
  transactions: [],
  coupons: [],
  usedCoupons: {},
  notifications: [],
  favorites: [],
  counters: { order: 0, parcel: 0 },
});

export interface StoreOptions {
  /** Générateur d'identifiants uniques. */
  uuid: () => string;
  /** Données chargées au démarrage. */
  initial?: Partial<Data>;
  /** Écriture des données (fichier JSON, AsyncStorage…) ; absent = mémoire uniquement. */
  persist?: (data: Data) => void;
  /** Délai de regroupement des écritures en ms (défaut 200 ; 0 = dès que possible). */
  persistDelayMs?: number;
}

/**
 * Stockage en mémoire, avec persistance optionnelle (fichier JSON côté serveur,
 * AsyncStorage dans l'application). En production, remplacez-le par PostgreSQL.
 */
export class Store {
  data: Data;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly uuid: () => string;
  private readonly persist?: (data: Data) => void;
  private readonly persistDelayMs: number;

  constructor(options: StoreOptions) {
    this.uuid = options.uuid;
    this.persist = options.persist;
    this.persistDelayMs = options.persistDelayMs ?? 200;
    this.data = { ...empty(), ...(options.initial ?? {}) };
  }

  id(): string {
    return this.uuid();
  }

  nextNumber(kind: 'order' | 'parcel'): string {
    this.data.counters[kind] += 1;
    const d = new Date();
    const date = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${kind === 'order' ? 'RO' : 'PK'}${date}${String(this.data.counters[kind]).padStart(5, '0')}`;
  }

  /** Enregistre avec un léger différé, si une persistance est configurée. */
  save() {
    const persist = this.persist;
    if (!persist) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      persist(this.data);
    }, this.persistDelayMs);
  }
}
