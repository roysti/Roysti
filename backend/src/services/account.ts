import { HttpError, badRequest } from '../lib/errors.js';
import { round2 } from '../lib/pricing.js';
import type { Store } from '../store/db.js';
import type { TransactionType, User } from '../store/models.js';
import type { Runtime } from '../core/runtime.js';

const MAX_NOTIFICATIONS_PER_USER = 200;

export class AccountService {
  constructor(
    private readonly store: Store,
    private readonly runtime: Runtime,
  ) {}

  logout(token: string) {
    delete this.store.data.sessions[token];
    this.store.save();
  }

  userForToken(token: string | undefined): User | undefined {
    if (!token) return undefined;
    const userId = this.store.data.sessions[token];
    return userId ? this.store.data.users.find((u) => u.id === userId) : undefined;
  }

  createSession(userId: string): string {
    const token = this.runtime.randomHex(32);
    this.store.data.sessions[token] = userId;
    this.store.save();
    return token;
  }

  /** Ferme toutes les sessions d'un utilisateur, sauf éventuellement `keepToken`. */
  revokeSessions(userId: string, keepToken?: string) {
    for (const [token, owner] of Object.entries(this.store.data.sessions)) {
      if (owner === userId && token !== keepToken) delete this.store.data.sessions[token];
    }
    this.store.save();
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
