import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Address, CartItem, Coupon, Favorite, Notification, Order, Parcel, Transaction, User, WarehouseItem } from './models.js';

export interface Data {
  users: User[];
  sessions: Record<string, string>;
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

/**
 * Stockage en mémoire, avec persistance JSON optionnelle (DATA_FILE).
 * Suffisant pour une démo ; en production, remplacez-le par PostgreSQL (Prisma, Drizzle…).
 */
export class Store {
  data: Data;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly file = '') {
    this.data = file && existsSync(file) ? { ...empty(), ...(JSON.parse(readFileSync(file, 'utf8')) as Partial<Data>) } : empty();
  }

  id(): string {
    return randomUUID();
  }

  nextNumber(kind: 'order' | 'parcel'): string {
    this.data.counters[kind] += 1;
    const d = new Date();
    const date = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${kind === 'order' ? 'RO' : 'PK'}${date}${String(this.data.counters[kind]).padStart(5, '0')}`;
  }

  /** Enregistre (avec un léger différé) si un fichier de persistance est configuré. */
  save() {
    if (!this.file) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      writeFileSync(this.file, JSON.stringify(this.data, null, 2));
      this.timer = null;
    }, 200);
  }
}
