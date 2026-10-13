import { config } from '../config.js';
import { HttpError, badRequest } from '../lib/errors.js';
import { round2 } from '../lib/pricing.js';
import type { Store } from '../store/db.js';
import type { TransactionType, User } from '../store/models.js';
import type { Runtime } from '../core/runtime.js';

export function publicUser(user: User) {
  const { passwordHash: _hash, salt: _salt, ...rest } = user;
  return rest;
}

const MAX_NOTIFICATIONS_PER_USER = 200;

export class AccountService {
  constructor(
    private readonly store: Store,
    private readonly runtime: Runtime,
  ) {}

  register(email: string, password: string, name: string, startingBalance = 0): { user: User; token: string } {
    const normalized = email.trim().toLowerCase();
    if (this.store.data.users.some((u) => u.email === normalized)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail', 'email_taken');
    const salt = this.runtime.randomHex(16);
    const user: User = {
      id: this.store.id(),
      email: normalized,
      name: name.trim() || normalized.split('@')[0]!,
      salt,
      passwordHash: this.runtime.hashPassword(password, salt),
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    this.store.data.users.push(user);
    if (startingBalance > 0) this.credit(user.id, startingBalance, 'topup', 'Crédit de bienvenue (démo)');
    this.notify(user.id, 'Bienvenue sur Roysti', "Collez un lien Taobao, 1688 ou Alibaba, ou cherchez un article pour commencer.");
    return { user, token: this.createSession(user.id) };
  }

  login(email: string, password: string): { user: User; token: string } {
    const user = this.store.data.users.find((u) => u.email === email.trim().toLowerCase());
    const valid = !!user && this.runtime.safeEqual(this.runtime.hashPassword(password, user.salt), user.passwordHash);
    if (!user || !valid) throw new HttpError(401, 'E-mail ou mot de passe incorrect', 'invalid_credentials');
    return { user, token: this.createSession(user.id) };
  }

  logout(token: string) {
    delete this.store.data.sessions[token];
    this.store.save();
  }

  userForToken(token: string | undefined): User | undefined {
    if (!token) return undefined;
    const userId = this.store.data.sessions[token];
    return userId ? this.store.data.users.find((u) => u.id === userId) : undefined;
  }

  private createSession(userId: string): string {
    const token = this.runtime.randomHex(32);
    this.store.data.sessions[token] = userId;
    this.store.save();
    return token;
  }

  getUser(userId: string): User {
    const user = this.store.data.users.find((u) => u.id === userId);
    if (!user) throw new HttpError(404, 'Utilisateur introuvable');
    return user;
  }

  /** Débite le portefeuille ; refuse si le solde est insuffisant. */
  charge(userId: string, amount: number, type: TransactionType, note: string, reference?: string) {
    const user = this.getUser(userId);
    const value = round2(amount);
    if (value <= 0) return;
    if (user.balance + 1e-9 < value) {
      throw new HttpError(402, `Solde insuffisant : ${user.balance.toFixed(2)} CNY disponibles, ${value.toFixed(2)} CNY requis`, 'insufficient_balance');
    }
    this.applyTransaction(user, -value, type, note, reference);
  }

  /** Débit qui peut rendre le solde négatif (régularisation après pesée réelle). */
  forceCharge(userId: string, amount: number, type: TransactionType, note: string, reference?: string) {
    const value = round2(amount);
    if (value > 0) this.applyTransaction(this.getUser(userId), -value, type, note, reference);
  }

  credit(userId: string, amount: number, type: TransactionType, note: string, reference?: string) {
    const value = round2(amount);
    if (value > 0) this.applyTransaction(this.getUser(userId), value, type, note, reference);
  }

  private applyTransaction(user: User, amount: number, type: TransactionType, note: string, reference?: string) {
    user.balance = round2(user.balance + amount);
    this.store.data.transactions.unshift({
      id: this.store.id(),
      userId: user.id,
      type,
      amount,
      balanceAfter: user.balance,
      reference,
      note,
      createdAt: new Date().toISOString(),
    });
    this.store.save();
  }

  topUp(userId: string, amount: number, method: string) {
    if (amount <= 0 || amount > 50000) throw badRequest('Montant de recharge invalide (1 à 50 000 CNY)');
    // En production : créer un paiement chez le prestataire (Stripe, PayPal, Mobile Money…)
    // et ne créditer qu'à réception du webhook de confirmation.
    this.credit(userId, amount, 'topup', `Recharge (${method}) – simulée`);
    return this.getUser(userId);
  }

  notify(userId: string, title: string, body: string, link?: string) {
    const list = this.store.data.notifications;
    list.unshift({
      id: this.store.id(),
      userId,
      title,
      body,
      link,
      read: false,
      createdAt: new Date().toISOString(),
    });
    // On ne garde que les plus récentes : la base locale de l'app reste petite (limites d'AsyncStorage).
    let kept = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i]!.userId === userId && ++kept > MAX_NOTIFICATIONS_PER_USER) list.splice(i--, 1);
    }
    this.store.save();
  }
}

export function seedDemo(store: Store, accounts: AccountService) {
  if (!store.data.users.some((u) => u.email === 'demo@roysti.app')) {
    const { user } = accounts.register('demo@roysti.app', 'demo1234', 'Client démo', config.demoStartingBalance);
    store.data.addresses.push({
      id: store.id(),
      userId: user.id,
      fullName: 'Client Démo',
      phone: '+33 6 00 00 00 00',
      country: 'FR',
      city: 'Paris',
      line1: '10 rue de la Paix',
      postalCode: '75002',
      isDefault: true,
    });
  }
  if (!store.data.coupons.length) {
    const inOneYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    store.data.coupons.push(
      { code: 'BIENVENUE', description: '10 CNY de réduction sur votre première commande (dès 100 CNY)', appliesTo: 'order', amount: 10, minSpend: 100, expiresAt: inOneYear },
      { code: 'COLIS30', description: "30 CNY de réduction sur l'expédition internationale (dès 300 CNY)", appliesTo: 'parcel', amount: 30, minSpend: 300, expiresAt: inOneYear },
    );
  }
  store.save();
}
