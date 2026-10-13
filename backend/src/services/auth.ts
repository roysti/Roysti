/**
 * Identité : comptes par e-mail et/ou numéro de téléphone, connexion par mot de passe
 * ou par code à usage unique (OTP) envoyé par e-mail ou SMS, vérification, mot de passe oublié.
 *
 * Règles OTP (inspirées d'OWASP et NIST SP 800-63B) : 6 chiffres, valable 10 minutes,
 * 5 essais au plus, un envoi par minute, 5 par heure et 10 par jour et par destination,
 * blocage de la destination pour 24 h après 20 essais ratés, 10 envois par heure et par
 * client, plafond global horaire pour les vrais envois (protection contre le « SMS pumping ») ;
 * seule une empreinte salée est conservée, comparaison en temps constant.
 * Hors mode démo, un canal sans expéditeur réel est refusé : un code n'est jamais renvoyé au client.
 */
import { HttpError, badRequest } from '../lib/errors.js';
import { maskDestination, normalizeEmail, normalizePhone } from '../lib/phone.js';
import type { Senders } from '../messaging/index.js';
import { DeliveryError } from '../messaging/types.js';
import type { Runtime } from '../core/runtime.js';
import type { Store } from '../store/db.js';
import type { OtpChannel, OtpPurpose, OtpRecord, User } from '../store/models.js';
import type { AccountService } from './account.js';

export const OTP_RULES = {
  length: 6,
  ttlMs: 10 * 60 * 1000,
  maxAttempts: 5,
  resendMs: 60 * 1000,
  maxPerHour: 5,
  maxPerDay: 10,
  maxFailuresPerDay: 20,
  maxPerClientPerHour: 10,
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface AuthOptions {
  /** Mode démonstration : les canaux sans expéditeur réel affichent le code à l'écran. */
  demoMode: boolean;
  /** Plafond d'envois réels par heure, tous destinataires confondus (OTP_GLOBAL_HOURLY_LIMIT). */
  globalHourlyLimit?: number;
}

export interface OtpRequestContext {
  userId?: string;
  /** Mot de passe actuel, exigé pour remplacer un e-mail ou un numéro déjà vérifié. */
  currentPassword?: string;
  clientId?: string;
}

const MIN_PASSWORD = 8;

export interface RegisterInput {
  email?: string;
  phone?: string;
  /** Pays par défaut pour interpréter un numéro national (« MG », « FR »…). */
  country?: string;
  password: string;
  name?: string;
}

export interface OtpTarget {
  channel: OtpChannel;
  destination: string;
  country?: string;
}

export interface OtpSent {
  channel: OtpChannel;
  destination: string;
  destinationMasked: string;
  expiresInSec: number;
  resendInSec: number;
  /** Présent uniquement en mode démonstration (aucun SMS/e-mail réellement envoyé). */
  demoCode?: string;
}

const PURPOSE_TEXT: Record<OtpPurpose, string> = {
  login: 'pour vous connecter',
  verify: 'pour confirmer cette adresse',
  reset: 'pour choisir un nouveau mot de passe',
};

export function publicUser(user: User) {
  const { passwordHash, salt: _salt, ...rest } = user;
  return { ...rest, hasPassword: !!passwordHash };
}

export class AuthService {
  constructor(
    private readonly store: Store,
    private readonly runtime: Runtime,
    private readonly accounts: AccountService,
    private readonly senders: Senders,
    private readonly options: AuthOptions = { demoMode: true },
  ) {}

  private get data() {
    return this.store.data;
  }

  /** Vrai si les codes de ce canal ne sont pas réellement envoyés (démonstration). */
  senderIsDemo(channel: OtpChannel): boolean {
    return this.senders[channel].demo;
  }

  /** Canal utilisable : expéditeur réel, ou expéditeur de démonstration en mode démo. */
  channelAvailable(channel: OtpChannel): boolean {
    return !this.senders[channel].demo || this.options.demoMode;
  }

  // ---------- Identifiants ----------

  /** Normalise une destination ; `strict` exige un numéro attribué (inscription, ajout). */
  normalize(channel: OtpChannel, destination: string, country?: string, strict = false): string {
    const value = channel === 'email' ? normalizeEmail(destination) : normalizePhone(destination, country, strict);
    if (!value) throw badRequest(channel === 'email' ? 'Adresse e-mail invalide' : 'Numéro de téléphone invalide (indiquez l’indicatif, ex. +261 34 12 345 67)', 'invalid_identifier');
    return value;
  }

  findByEmail(email: string) {
    return this.data.users.find((u) => u.email === email);
  }

  findByPhone(phone: string) {
    return this.data.users.find((u) => u.phone === phone);
  }

  private findBy(channel: OtpChannel, destination: string) {
    return channel === 'email' ? this.findByEmail(destination) : this.findByPhone(destination);
  }

  // ---------- Mot de passe ----------

  private setPassword(user: User, password: string) {
    if (password.length < MIN_PASSWORD) throw badRequest(`Mot de passe : ${MIN_PASSWORD} caractères minimum`, 'weak_password');
    user.salt = this.runtime.randomHex(16);
    user.passwordHash = this.runtime.hashPassword(password, user.salt);
  }

  register(input: RegisterInput, startingBalance = 0): { user: User; token: string } {
    const email = input.email?.trim() ? this.normalize('email', input.email) : undefined;
    const phone = input.phone?.trim() ? this.normalize('sms', input.phone, input.country, true) : undefined;
    if (!email && !phone) throw badRequest('Indiquez un e-mail ou un numéro de téléphone', 'identifier_required');
    if (email && this.findByEmail(email)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail', 'email_taken');
    if (phone && this.findByPhone(phone)) throw new HttpError(409, 'Un compte existe déjà avec ce numéro', 'phone_taken');

    const user: User = {
      id: this.store.id(),
      email,
      phone,
      emailVerified: false,
      phoneVerified: false,
      name: input.name?.trim() || (email ? email.split('@')[0]! : `Client ${phone!.slice(-4)}`),
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    this.setPassword(user, input.password);
    this.data.users.push(user);
    if (startingBalance > 0) this.accounts.credit(user.id, startingBalance, 'topup', 'Crédit de bienvenue (démo)');
    this.accounts.notify(user.id, 'Bienvenue sur Roysti', 'Collez un lien Taobao, 1688 ou Alibaba, ou cherchez un article pour commencer.');
    return { user, token: this.accounts.createSession(user.id) };
  }

  /** Connexion par e-mail ou numéro de téléphone et mot de passe. */
  login(identifier: string, password: string, country?: string): { user: User; token: string } {
    const isEmail = identifier.includes('@');
    const normalized = isEmail ? normalizeEmail(identifier) : normalizePhone(identifier, country);
    const user = normalized ? (isEmail ? this.findByEmail(normalized) : this.findByPhone(normalized)) : undefined;
    // Le calcul est fait même sans compte, pour ne pas révéler son existence par la durée de réponse.
    const hash = this.runtime.hashPassword(password, user?.salt ?? 'roysti-absent');
    const valid = !!user?.passwordHash && this.runtime.safeEqual(hash, user.passwordHash);
    if (!user || !valid) throw new HttpError(401, 'Identifiants incorrects (ou connectez-vous avec un code)', 'invalid_credentials');
    return { user, token: this.accounts.createSession(user.id) };
  }

  private checkPassword(user: User, password: string | undefined): boolean {
    return !!user.passwordHash && !!password && this.runtime.safeEqual(this.runtime.hashPassword(password, user.salt!), user.passwordHash);
  }

  changePassword(userId: string, newPassword: string, currentPassword: string | undefined, keepToken: string | undefined) {
    const user = this.accounts.getUser(userId);
    if (user.passwordHash && !this.checkPassword(user, currentPassword)) throw new HttpError(401, 'Mot de passe actuel incorrect', 'invalid_credentials');
    this.setPassword(user, newPassword);
    this.accounts.revokeSessions(userId, keepToken);
    this.store.save();
    return user;
  }

  updateProfile(userId: string, patch: { name?: string }) {
    const user = this.accounts.getUser(userId);
    if (patch.name !== undefined) user.name = patch.name.trim() || user.name;
    this.store.save();
    return user;
  }

  // ---------- Codes à usage unique ----------

  private randomCode(): string {
    // Tirage par rejet sur 32 bits : distribution uniforme sur 000000–999999.
    const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
    for (;;) {
      const n = parseInt(this.runtime.randomHex(4), 16);
      if (n < limit) return String(n % 1_000_000).padStart(OTP_RULES.length, '0');
    }
  }

  /** On garde 24 h d'historique : limites journalières et blocage après trop d'échecs. */
  private purgeOtps(now: number) {
    this.data.otps = this.data.otps.filter((o) => now - new Date(o.createdAt).getTime() < DAY);
  }

  private enforceLimits(destination: string, now: number, clientId: string | undefined, realSend: boolean) {
    const age = (o: OtpRecord) => now - new Date(o.createdAt).getTime();
    const forDestination = this.data.otps.filter((o) => o.destination === destination).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const last = forDestination[0];
    if (last && age(last) < OTP_RULES.resendMs) {
      const wait = Math.ceil((OTP_RULES.resendMs - age(last)) / 1000);
      throw new HttpError(429, `Patientez ${wait} s avant de demander un nouveau code`, 'otp_throttled');
    }
    const failures = forDestination.reduce((n, o) => n + (o.failures ?? 0), 0);
    if (failures >= OTP_RULES.maxFailuresPerDay) throw new HttpError(429, 'Trop d’essais incorrects pour cette adresse : réessayez demain', 'otp_throttled');
    if (forDestination.filter((o) => age(o) < HOUR).length >= OTP_RULES.maxPerHour) throw new HttpError(429, 'Trop de codes demandés : réessayez dans une heure', 'otp_throttled');
    if (forDestination.length >= OTP_RULES.maxPerDay) throw new HttpError(429, 'Trop de codes demandés aujourd’hui pour cette adresse : réessayez demain', 'otp_throttled');
    if (clientId && this.data.otps.filter((o) => o.clientId === clientId && age(o) < HOUR).length >= OTP_RULES.maxPerClientPerHour) {
      throw new HttpError(429, 'Trop de codes demandés depuis cet appareil : réessayez dans une heure', 'otp_throttled');
    }
    const globalLimit = this.options.globalHourlyLimit;
    if (realSend && globalLimit && this.data.otps.filter((o) => o.codeHash && age(o) < HOUR).length >= globalLimit) {
      throw new HttpError(503, 'Service de codes momentanément saturé : réessayez plus tard ou connectez-vous avec votre mot de passe', 'otp_unavailable');
    }
  }

  /**
   * Envoie un code. Pour « reset », la réponse est identique que le compte existe ou non
   * (pas d'énumération) ; pour « verify », le compte connecté est requis, et le mot de passe
   * actuel pour remplacer un identifiant déjà vérifié.
   */
  async requestOtp(target: OtpTarget, purpose: OtpPurpose, context: OtpRequestContext = {}): Promise<OtpSent> {
    const now = Date.now();
    const { userId, clientId } = context;
    const label = target.channel === 'email' ? 'e-mail' : 'SMS';
    if (!this.channelAvailable(target.channel)) {
      throw new HttpError(503, `L’envoi de codes par ${label} n’est pas configuré sur ce serveur : connectez-vous avec votre mot de passe`, 'channel_unavailable');
    }
    const destination = this.normalize(target.channel, target.destination, target.country, purpose === 'verify');
    this.purgeOtps(now);

    if (purpose === 'verify') {
      if (!userId) throw new HttpError(401, 'Connexion requise', 'unauthorized');
      const owner = this.findBy(target.channel, destination);
      if (owner && owner.id !== userId) throw new HttpError(409, 'Cette adresse est déjà utilisée par un autre compte', 'identifier_taken');
      const user = this.accounts.getUser(userId);
      const current = target.channel === 'email' ? user.email : user.phone;
      const currentVerified = target.channel === 'email' ? user.emailVerified : user.phoneVerified;
      // Une session volée ne doit pas suffire à détourner l'e-mail ou le numéro de récupération.
      if (current && currentVerified && current !== destination && user.passwordHash && !this.checkPassword(user, context.currentPassword)) {
        throw new HttpError(401, context.currentPassword ? 'Mot de passe actuel incorrect' : 'Confirmez votre mot de passe actuel pour changer cette adresse', 'password_required');
      }
    }

    const decoy = purpose === 'reset' && !this.findBy(target.channel, destination);
    const sender = this.senders[target.channel];
    this.enforceLimits(destination, now, clientId, !sender.demo && !decoy);

    const sent: OtpSent = {
      channel: target.channel,
      destination,
      destinationMasked: maskDestination(destination),
      expiresInSec: OTP_RULES.ttlMs / 1000,
      resendInSec: OTP_RULES.resendMs / 1000,
    };

    // Mot de passe oublié pour une adresse inconnue : même réponse, aucun envoi.
    if (decoy) {
      this.data.otps.push(this.newRecord(target.channel, destination, purpose, undefined, clientId, null, now));
      this.store.save();
      return sent;
    }

    const code = this.randomCode();
    const record = this.newRecord(target.channel, destination, purpose, userId, clientId, code, now);
    // Un nouveau code annule les précédents pour la même destination, le même usage et le même compte.
    for (const o of this.data.otps) if (o.destination === destination && o.purpose === purpose && o.userId === userId) o.consumed = true;
    this.data.otps.push(record);
    this.store.save();

    try {
      await sender.send({
        to: destination,
        subject: `Votre code Roysti : ${code}`,
        text: `Roysti : votre code ${PURPOSE_TEXT[purpose]} est ${code}. Il expire dans 10 minutes. Ne le communiquez à personne.`,
      });
    } catch (err) {
      record.consumed = true;
      this.store.save();
      // Le détail (réponse de Twilio/Resend) reste dans les journaux du serveur.
      console.error('Envoi du code impossible', err instanceof DeliveryError ? err.message : err);
      throw new HttpError(502, `Envoi du code par ${label} impossible pour le moment : vérifiez l’adresse ou réessayez plus tard`, 'otp_delivery_failed');
    }
    return sender.demo && this.options.demoMode ? { ...sent, demoCode: code } : sent;
  }

  private newRecord(channel: OtpChannel, destination: string, purpose: OtpPurpose, userId: string | undefined, clientId: string | undefined, code: string | null, now: number): OtpRecord {
    const salt = this.runtime.randomHex(16);
    return {
      id: this.store.id(),
      channel,
      destination,
      purpose,
      userId,
      clientId,
      // Enregistrement « leurre » (code null) : compte pour la limite d'envoi, ne peut jamais être validé.
      codeHash: code === null ? '' : this.runtime.sha256Hex(`${salt}:${code}`),
      salt,
      attempts: 0,
      consumed: code === null,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + OTP_RULES.ttlMs).toISOString(),
    };
  }

  /** Vérifie un code et consomme l'enregistrement ; erreurs volontairement génériques. */
  private consumeOtp(channel: OtpChannel, destination: string, purpose: OtpPurpose, code: string, userId?: string): OtpRecord {
    const now = Date.now();
    const record = this.data.otps
      .filter((o) => o.channel === channel && o.destination === destination && o.purpose === purpose && o.userId === userId && !o.consumed)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!record || new Date(record.expiresAt).getTime() < now) throw badRequest('Code invalide ou expiré : demandez-en un nouveau', 'otp_invalid');
    if (record.attempts >= OTP_RULES.maxAttempts) {
      record.consumed = true;
      this.store.save();
      throw new HttpError(429, 'Trop d’essais : demandez un nouveau code', 'otp_locked');
    }
    record.attempts += 1;
    const ok = this.runtime.safeEqual(this.runtime.sha256Hex(`${record.salt}:${code}`), record.codeHash);
    if (!ok) {
      record.failures = (record.failures ?? 0) + 1;
      const left = OTP_RULES.maxAttempts - record.attempts;
      if (left <= 0) record.consumed = true;
      this.store.save();
      throw badRequest(left > 0 ? `Code incorrect (${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''})` : 'Code incorrect : demandez un nouveau code', 'otp_invalid');
    }
    record.consumed = true;
    this.store.save();
    return record;
  }

  /**
   * Rattache un e-mail ou un numéro dont la possession vient d'être prouvée par code.
   * Si un compte le portait sans l'avoir vérifié (saisi par quelqu'un d'autre, faute de frappe
   * ou tentative de détournement) :
   * - ce compte a prouvé posséder un autre identifiant → on lui retire celui-ci et le titulaire
   *   obtient un compte séparé ;
   * - sinon personne n'avait prouvé posséder ce compte → le titulaire en prend le contrôle et
   *   l'ancien mot de passe, l'autre identifiant non vérifié et toutes les sessions sont retirés.
   */
  private claimIdentifier(channel: OtpChannel, destination: string, name?: string): { user: User; created: boolean } {
    let user = this.findBy(channel, destination);
    const verified = (u: User, c: OtpChannel) => (c === 'email' ? !!u.email && !!u.emailVerified : !!u.phone && !!u.phoneVerified);
    const other: OtpChannel = channel === 'email' ? 'sms' : 'email';
    if (user && !verified(user, channel)) {
      if (verified(user, other)) {
        if (channel === 'email') {
          delete user.email;
          user.emailVerified = false;
        } else {
          delete user.phone;
          user.phoneVerified = false;
        }
        user = undefined;
      } else {
        delete user.passwordHash;
        delete user.salt;
        if (other === 'email') {
          delete user.email;
          user.emailVerified = false;
        } else {
          delete user.phone;
          user.phoneVerified = false;
        }
        this.accounts.revokeSessions(user.id);
        this.accounts.notify(user.id, 'Sécurité du compte', 'Votre adresse a été confirmée par code. Par sécurité, l’ancien mot de passe a été retiré : vous pouvez en choisir un nouveau dans votre profil.');
      }
    }
    const created = !user;
    if (!user) {
      user = {
        id: this.store.id(),
        name: name?.trim() || (channel === 'email' ? destination.split('@')[0]! : `Client ${destination.slice(-4)}`),
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      this.data.users.push(user);
      this.accounts.notify(user.id, 'Bienvenue sur Roysti', 'Votre compte a été créé. Vous pourrez ajouter un mot de passe dans votre profil.');
    }
    if (channel === 'email') {
      user.email = destination;
      user.emailVerified = true;
    } else {
      user.phone = destination;
      user.phoneVerified = true;
    }
    return { user, created };
  }

  /** Connexion (ou création de compte) par code. */
  loginWithOtp(target: OtpTarget, code: string, name?: string): { user: User; token: string; created: boolean } {
    const destination = this.normalize(target.channel, target.destination, target.country);
    this.consumeOtp(target.channel, destination, 'login', code);
    const { user, created } = this.claimIdentifier(target.channel, destination, name);
    this.store.save();
    return { user, token: this.accounts.createSession(user.id), created };
  }

  /** Confirme (et associe au compte connecté) un e-mail ou un numéro ; un remplacement ferme les autres sessions. */
  verifyIdentifier(userId: string, target: OtpTarget, code: string, keepToken?: string): User {
    const destination = this.normalize(target.channel, target.destination, target.country, true);
    this.consumeOtp(target.channel, destination, 'verify', code, userId);
    const owner = this.findBy(target.channel, destination);
    if (owner && owner.id !== userId) throw new HttpError(409, 'Cette adresse est déjà utilisée par un autre compte', 'identifier_taken');
    const user = this.accounts.getUser(userId);
    const previous = target.channel === 'email' ? user.email : user.phone;
    if (target.channel === 'email') {
      user.email = destination;
      user.emailVerified = true;
    } else {
      user.phone = destination;
      user.phoneVerified = true;
    }
    if (previous && previous !== destination) this.accounts.revokeSessions(userId, keepToken);
    this.accounts.notify(userId, 'Coordonnées confirmées', `${target.channel === 'email' ? 'E-mail' : 'Numéro'} ${maskDestination(destination)} vérifié.`);
    this.store.save();
    return user;
  }

  /** Mot de passe oublié : code + nouveau mot de passe ; toutes les autres sessions sont fermées. */
  resetPassword(target: OtpTarget, code: string, newPassword: string): { user: User; token: string } {
    if (newPassword.length < MIN_PASSWORD) throw badRequest(`Mot de passe : ${MIN_PASSWORD} caractères minimum`, 'weak_password');
    const destination = this.normalize(target.channel, target.destination, target.country);
    this.consumeOtp(target.channel, destination, 'reset', code);
    // La réception du code prouve la possession de l'adresse (mêmes règles que la connexion par code).
    const { user } = this.claimIdentifier(target.channel, destination);
    this.setPassword(user, newPassword);
    this.accounts.revokeSessions(user.id);
    this.store.save();
    return { user, token: this.accounts.createSession(user.id) };
  }
}

/** Numéro du compte démo : plage réservée par l'ARCEP aux œuvres de fiction (jamais attribuée). */
export const DEMO_PHONE = '+33639980000';
export const DEMO_EMAIL = 'demo@roysti.app';
export const DEMO_PASSWORD = 'demo1234';

/** Compte démo (e-mail + téléphone), adresse et coupons de démonstration. */
export function seedDemo(store: Store, auth: AuthService, startingBalance: number) {
  let demo = auth.findByEmail(DEMO_EMAIL);
  if (!demo) {
    demo = auth.register({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Client démo' }, startingBalance).user;
    store.data.addresses.push({
      id: store.id(),
      userId: demo.id,
      fullName: 'Client Démo',
      phone: '+33 6 39 98 00 00',
      country: 'FR',
      city: 'Paris',
      line1: '10 rue de la Paix',
      postalCode: '75002',
      isDefault: true,
    });
  }
  // Données créées par une version précédente : on complète le téléphone et les vérifications.
  if (!demo.phone && !auth.findByPhone(DEMO_PHONE)) demo.phone = DEMO_PHONE;
  demo.emailVerified = true;
  demo.phoneVerified = demo.phone === DEMO_PHONE ? true : demo.phoneVerified;
  if (!store.data.coupons.length) {
    const inOneYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    store.data.coupons.push(
      { code: 'BIENVENUE', description: '10 CNY de réduction sur votre première commande (dès 100 CNY)', appliesTo: 'order', amount: 10, minSpend: 100, expiresAt: inOneYear },
      { code: 'COLIS30', description: "30 CNY de réduction sur l'expédition internationale (dès 300 CNY)", appliesTo: 'parcel', amount: 30, minSpend: 300, expiresAt: inOneYear },
    );
  }
  store.save();
}
