import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCore, type Core } from '../src/core/api.js';
import { nodeRuntime } from '../src/core/nodeRuntime.js';
import { toBase64 } from '../src/lib/base64.js';
import { maskDestination, normalizePhone } from '../src/lib/phone.js';
import { DemoSender, ResendEmailSender, TwilioSmsSender, type MessageSender } from '../src/messaging/index.js';
import type { OutgoingMessage } from '../src/messaging/types.js';
import { MockProvider } from '../src/providers/mock.js';
import { Store } from '../src/store/db.js';

process.env.RATES_OFFLINE = 'true';

class RecordingSender implements MessageSender {
  readonly name = 'test';
  readonly demo = false;
  sent: OutgoingMessage[] = [];
  constructor(readonly channel: 'email' | 'sms') {}
  async send(message: OutgoingMessage) {
    this.sent.push(message);
  }
}

function newCore(real = false) {
  const sms = real ? new RecordingSender('sms') : new DemoSender('sms');
  const email = real ? new RecordingSender('email') : new DemoSender('email');
  const core = createCore({ store: new Store({ uuid: nodeRuntime.uuid }), provider: new MockProvider(), runtime: nodeRuntime, demoMode: true, senders: { sms, email } });
  // `sent` n'est lu que dans les tests avec de vrais expéditeurs (RecordingSender).
  return { core, sms: sms as RecordingSender, email: email as RecordingSender };
}

const post = (core: Core, path: string, body: unknown, token?: string) => core.handle({ method: 'POST', path, body, token });
type Body = Record<string, unknown> & { token?: string; user?: Record<string, unknown>; demoCode?: string; code?: string; error?: string };
const b = (r: { body?: unknown }) => (r.body ?? {}) as Body;

/** Fait reculer l'horloge des codes pour franchir le délai de renvoi. */
function ageOtps(core: Core, ms: number) {
  for (const o of core.store.data.otps) {
    o.createdAt = new Date(new Date(o.createdAt).getTime() - ms).toISOString();
    o.expiresAt = new Date(new Date(o.expiresAt).getTime() - ms).toISOString();
  }
}

describe('normalisation des identifiants', () => {
  it('met les numéros au format E.164', () => {
    assert.equal(normalizePhone('034 12 345 67', 'MG', true), '+261341234567');
    assert.equal(normalizePhone('+261 34 12 345 67', undefined, true), '+261341234567');
    assert.equal(normalizePhone('06 39 98 00 00', 'FR'), '+33639980000');
    assert.equal(normalizePhone('06 39 98 00 00', 'FR', true), null, 'plage fictive refusée à l’inscription');
    assert.equal(normalizePhone('12', 'MG'), null);
    assert.equal(maskDestination('+261341234567'), '+26134•••••67');
    assert.equal(maskDestination('client@exemple.com'), 'cl••••@exemple.com');
  });

  it('encode en Base64 comme Buffer (ASCII et UTF-8)', () => {
    for (const s of ['AC123:secret', 'é€😀', '', 'a', 'ab', 'abc']) assert.equal(toBase64(s), Buffer.from(s, 'utf8').toString('base64'));
  });
});

describe('inscription et connexion par mot de passe', () => {
  it('inscrit par téléphone (numéro national + pays) et envoie un code de vérification', async () => {
    const { core } = newCore();
    const res = await post(core, '/auth/register', { phone: '034 12 345 67', country: 'mg', password: 'motdepasse1', name: 'Rova' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const body = b(res);
    assert.equal(body.user!.phone, '+261341234567');
    assert.equal(body.user!.phoneVerified, false);
    const verification = body.verification as Body;
    assert.equal(verification.channel, 'sms');
    assert.match(verification.demoCode!, /^\d{6}$/);

    const verified = await post(core, '/me/verify', { channel: 'sms', destination: '+261341234567', code: verification.demoCode }, body.token);
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal((b(verified).user as Body).phoneVerified, true);
  });

  it('refuse les doublons et les numéros invalides', async () => {
    const { core } = newCore();
    await post(core, '/auth/register', { phone: '+261341234567', password: 'motdepasse1' });
    assert.equal((await post(core, '/auth/register', { phone: '034 12 345 67', country: 'MG', password: 'motdepasse1' })).status, 409);
    assert.equal((await post(core, '/auth/register', { email: 'demo@roysti.app', password: 'motdepasse1' })).status, 409);
    assert.equal((await post(core, '/auth/register', { phone: '0612', country: 'FR', password: 'motdepasse1' })).status, 400);
    assert.equal((await post(core, '/auth/register', { password: 'motdepasse1' })).status, 400);
    assert.equal((await post(core, '/auth/register', { email: 'a@b.co', password: 'court' })).status, 400);
  });

  it('connecte par e-mail ou par téléphone, dans tous les formats', async () => {
    const { core } = newCore();
    for (const [identifier, country] of [
      ['demo@roysti.app', undefined],
      ['DEMO@Roysti.app ', undefined],
      ['+33 6 39 98 00 00', undefined],
      ['06 39 98 00 00', 'FR'],
    ] as const) {
      const res = await post(core, '/auth/login', { identifier, country, password: 'demo1234' });
      assert.equal(res.status, 200, `${identifier} ${JSON.stringify(res.body)}`);
    }
    // Ancien format { email, password } toujours accepté.
    assert.equal((await post(core, '/auth/login', { email: 'demo@roysti.app', password: 'demo1234' })).status, 200);
  });

  it('répond de façon identique pour un compte inconnu ou un mauvais mot de passe', async () => {
    const { core } = newCore();
    const wrong = await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'mauvais!' });
    const unknown = await post(core, '/auth/login', { identifier: 'inconnu@roysti.app', password: 'mauvais!' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  it('n’expose jamais l’empreinte ni le sel', async () => {
    const { core } = newCore();
    const login = b(await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'demo1234' }));
    const me = await core.handle({ method: 'GET', path: '/me', token: login.token });
    for (const payload of [login, me.body]) {
      const json = JSON.stringify(payload);
      assert.ok(!json.includes('passwordHash') && !json.includes('"salt"'), json);
    }
    assert.equal(login.user!.hasPassword, true);
  });
});

describe('connexion par code (OTP)', () => {
  it('crée le compte au premier code puis le reconnaît', async () => {
    const { core } = newCore();
    const req = b(await post(core, '/auth/otp/request', { channel: 'sms', destination: '038 00 111 22', country: 'MG', purpose: 'login' }));
    assert.equal(req.destination, '+261380011122');
    const first = await post(core, '/auth/otp/verify', { channel: 'sms', destination: '+261380011122', code: req.demoCode, name: 'Hery' });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(b(first).created, true);
    assert.equal(b(first).user!.phoneVerified, true);
    assert.equal(b(first).user!.hasPassword, false);

    ageOtps(core, 61_000);
    const again = b(await post(core, '/auth/otp/request', { channel: 'sms', destination: '+261380011122', purpose: 'login' }));
    const second = await post(core, '/auth/otp/verify', { channel: 'sms', destination: '+261380011122', code: again.demoCode });
    assert.equal(b(second).created, false);
    assert.equal(b(second).user!.id, b(first).user!.id);
    // Un code ne sert qu'une fois.
    assert.equal((await post(core, '/auth/otp/verify', { channel: 'sms', destination: '+261380011122', code: again.demoCode })).status, 400);
  });

  it('limite les envois (1 par minute, 5 par heure)', async () => {
    const { core } = newCore();
    const target = { channel: 'email', destination: 'client@exemple.com', purpose: 'login' };
    assert.equal((await post(core, '/auth/otp/request', target)).status, 200);
    const throttled = await post(core, '/auth/otp/request', target);
    assert.equal(throttled.status, 429);
    assert.equal(b(throttled).code, 'otp_throttled');
    for (let i = 0; i < 4; i++) {
      ageOtps(core, 61_000);
      assert.equal((await post(core, '/auth/otp/request', target)).status, 200);
    }
    ageOtps(core, 61_000);
    assert.equal((await post(core, '/auth/otp/request', target)).status, 429, '6e envoi dans l’heure refusé');
  });

  it('bloque après 5 essais et refuse un code expiré', async () => {
    const { core } = newCore();
    const target = { channel: 'email', destination: 'essai@exemple.com' };
    const { demoCode } = b(await post(core, '/auth/otp/request', { ...target, purpose: 'login' }));
    const wrong = demoCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) assert.equal((await post(core, '/auth/otp/verify', { ...target, code: wrong })).status, 400);
    const last = await post(core, '/auth/otp/verify', { ...target, code: wrong });
    assert.match(b(last).error!, /demandez un nouveau code/);
    assert.equal((await post(core, '/auth/otp/verify', { ...target, code: demoCode })).status, 400, 'bon code refusé après blocage');

    ageOtps(core, 61_000);
    const fresh = b(await post(core, '/auth/otp/request', { ...target, purpose: 'login' }));
    ageOtps(core, 11 * 60_000);
    assert.equal((await post(core, '/auth/otp/verify', { ...target, code: fresh.demoCode })).status, 400, 'code expiré');
  });

  it('avec un vrai fournisseur, le code n’est jamais renvoyé à l’application', async () => {
    const { core, sms } = newCore(true);
    const res = b(await post(core, '/auth/otp/request', { channel: 'sms', destination: '+261341112233', purpose: 'login' }));
    assert.equal(res.demoCode, undefined);
    assert.equal(sms.sent.length, 1);
    const code = sms.sent[0]!.text.match(/\d{6}/)![0];
    assert.equal((await post(core, '/auth/otp/verify', { channel: 'sms', destination: '+261341112233', code })).status, 200);
    const cfg = b(await core.handle({ method: 'GET', path: '/auth/config' }));
    assert.deepEqual(cfg.channels, { email: { demo: false, available: true }, sms: { demo: false, available: true } });
  });

  it('conserve seulement une empreinte du code', async () => {
    const { core } = newCore();
    const { demoCode } = b(await post(core, '/auth/otp/request', { channel: 'email', destination: 'hash@exemple.com', purpose: 'login' }));
    assert.ok(!JSON.stringify(core.store.data.otps).includes(demoCode!));
  });
});

describe('mot de passe oublié et gestion du compte', () => {
  it('ne révèle pas si le compte existe', async () => {
    const { core, email } = newCore(true);
    const unknown = await post(core, '/auth/otp/request', { channel: 'email', destination: 'personne@exemple.com', purpose: 'reset' });
    const known = await post(core, '/auth/otp/request', { channel: 'email', destination: 'demo@roysti.app', purpose: 'reset' });
    assert.equal(unknown.status, 200);
    assert.deepEqual(Object.keys(b(unknown)).sort(), Object.keys(b(known)).sort());
    assert.equal(email.sent.length, 1, 'un seul e-mail envoyé (compte existant)');
  });

  it('réinitialise le mot de passe et ferme les autres sessions', async () => {
    const { core } = newCore();
    const old = b(await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'demo1234' })).token;
    const { demoCode } = b(await post(core, '/auth/otp/request', { channel: 'sms', destination: '+33639980000', purpose: 'reset' }));
    const reset = await post(core, '/auth/password/reset', { channel: 'sms', destination: '06 39 98 00 00', country: 'FR', code: demoCode, newPassword: 'nouveau-mdp' });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.equal((await core.handle({ method: 'GET', path: '/me', token: old })).status, 401, 'ancienne session fermée');
    assert.equal((await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'demo1234' })).status, 401);
    assert.equal((await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'nouveau-mdp' })).status, 200);
  });

  it('change le mot de passe (ancien requis) et le nom', async () => {
    const { core } = newCore();
    const token = b(await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'demo1234' })).token;
    assert.equal((await post(core, '/me/password', { currentPassword: 'faux', newPassword: 'nouveau-mdp' }, token)).status, 401);
    assert.equal((await post(core, '/me/password', { currentPassword: 'demo1234', newPassword: 'nouveau-mdp' }, token)).status, 200);
    assert.equal((await core.handle({ method: 'GET', path: '/me', token })).status, 200, 'session courante conservée');
    const renamed = await core.handle({ method: 'PATCH', path: '/me', token, body: { name: 'Rakoto' } });
    assert.equal((b(renamed).user as Body).name, 'Rakoto');
  });

  it('ajoute et vérifie un e-mail sur un compte créé par téléphone', async () => {
    const { core } = newCore();
    const { demoCode } = b(await post(core, '/auth/otp/request', { channel: 'sms', destination: '+261320000001', purpose: 'login' }));
    const { token } = b(await post(core, '/auth/otp/verify', { channel: 'sms', destination: '+261320000001', code: demoCode }));
    // Mot de passe ajouté sans ancien mot de passe (compte créé par code).
    assert.equal((await post(core, '/me/password', { newPassword: 'premier-mdp' }, token)).status, 200);
    assert.equal((await post(core, '/auth/otp/request', { channel: 'email', destination: 'demo@roysti.app', purpose: 'verify' }, token)).status, 409, 'e-mail d’un autre compte');
    const req = b(await post(core, '/auth/otp/request', { channel: 'email', destination: 'moi@exemple.com', purpose: 'verify' }, token));
    const ok = await post(core, '/me/verify', { channel: 'email', destination: 'moi@exemple.com', code: req.demoCode }, token);
    assert.equal((b(ok).user as Body).email, 'moi@exemple.com');
    assert.equal((await post(core, '/auth/login', { identifier: 'moi@exemple.com', password: 'premier-mdp' })).status, 200);
    assert.equal((await post(core, '/auth/otp/request', { channel: 'email', destination: 'x@exemple.com', purpose: 'verify' })).status, 401, 'vérification sans session refusée');
  });
});

describe('protections contre le détournement de compte', () => {
  const register = (core: Core, body: Record<string, unknown>) => post(core, '/auth/register', { password: 'motdepasse-1', ...body });
  const otpLogin = async (core: Core, channel: string, destination: string) => {
    ageOtps(core, 61_000);
    const sent = b(await post(core, '/auth/otp/request', { channel, destination, purpose: 'login' }));
    return post(core, '/auth/otp/verify', { channel, destination, code: sent.demoCode });
  };

  it('hors mode démo, un canal non configuré refuse d’envoyer et ne renvoie jamais de code', async () => {
    const core = createCore({ store: new Store({ uuid: nodeRuntime.uuid }), provider: new MockProvider(), runtime: nodeRuntime, demoMode: false, senders: { sms: new DemoSender('sms'), email: new DemoSender('email') } });
    const cfg = b(await core.handle({ method: 'GET', path: '/auth/config' })) as unknown as { channels: Record<string, { available: boolean }> };
    assert.equal(cfg.channels.sms!.available, false);
    for (const purpose of ['login', 'reset']) {
      const r = await post(core, '/auth/otp/request', { channel: 'email', destination: 'demo@roysti.app', purpose });
      assert.equal(r.status, 503);
      assert.equal(b(r).code, 'channel_unavailable');
      assert.equal(b(r).demoCode, undefined);
    }
    assert.equal(core.store.data.otps.length, 0);
  });

  it('un compte préparé avec l’e-mail d’autrui passe à son vrai titulaire, sans le mot de passe ni les sessions de l’inscripteur', async () => {
    const { core } = newCore();
    const attacker = b(await register(core, { email: 'victime@exemple.com', name: 'Piège' }));
    const victim = await otpLogin(core, 'email', 'victime@exemple.com');
    assert.equal(victim.status, 200);
    assert.equal(b(victim).user!.id, attacker.user!.id);
    assert.equal(b(victim).user!.hasPassword, false, 'mot de passe de l’inscripteur retiré');
    assert.equal((await core.handle({ method: 'GET', path: '/me', token: attacker.token })).status, 401, 'session de l’inscripteur fermée');
    const pwd = await post(core, '/auth/login', { identifier: 'victime@exemple.com', password: 'motdepasse-1' });
    assert.equal(pwd.status, 401);
  });

  it('un identifiant non vérifié est détaché d’un compte qui a prouvé posséder un autre identifiant', async () => {
    const { core } = newCore();
    const owner = b(await otpLogin(core, 'sms', '+261341112299'));
    // Le propriétaire du numéro ajoute par erreur l'e-mail de quelqu'un d'autre (jamais vérifié).
    core.store.data.users.find((u) => u.id === owner.user!.id)!.email = 'autre@exemple.com';
    const other = await otpLogin(core, 'email', 'autre@exemple.com');
    assert.equal(b(other).created, true);
    assert.notEqual(b(other).user!.id, owner.user!.id);
    assert.equal(core.store.data.users.find((u) => u.id === owner.user!.id)!.email, undefined);
    assert.equal((await core.handle({ method: 'GET', path: '/me', token: owner.token })).status, 200, 'le propriétaire du numéro garde son compte');
  });

  it('remplacer un e-mail vérifié exige le mot de passe actuel et ferme les autres sessions', async () => {
    const { core } = newCore();
    const login = b(await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'demo1234' }));
    const other = b(await post(core, '/auth/login', { identifier: 'demo@roysti.app', password: 'demo1234' }));
    const ask = (extra: Record<string, unknown>) => post(core, '/auth/otp/request', { channel: 'email', destination: 'nouveau@exemple.com', purpose: 'verify', ...extra }, login.token);
    assert.equal(b(await ask({})).code, 'password_required');
    assert.equal(b(await ask({ currentPassword: 'faux-mot-de-passe' })).code, 'password_required');
    const sent = b(await ask({ currentPassword: 'demo1234' }));
    assert.ok(sent.demoCode);
    const done = await post(core, '/me/verify', { channel: 'email', destination: 'nouveau@exemple.com', code: sent.demoCode }, login.token);
    assert.equal(done.status, 200);
    assert.equal((await core.handle({ method: 'GET', path: '/me', token: other.token })).status, 401);
    assert.equal((await core.handle({ method: 'GET', path: '/me', token: login.token })).status, 200);
  });

  it('un autre compte ne peut pas annuler le code de vérification en attente', async () => {
    const { core } = newCore();
    const a = b(await register(core, { email: 'a@exemple.com' }));
    const b2 = b(await register(core, { email: 'b@exemple.com' }));
    ageOtps(core, 61_000);
    const sentA = b(await post(core, '/auth/otp/request', { channel: 'sms', destination: '+261341112277', purpose: 'verify' }, a.token));
    ageOtps(core, 61_000);
    await post(core, '/auth/otp/request', { channel: 'sms', destination: '+261341112277', purpose: 'verify' }, b2.token);
    const ok = await post(core, '/me/verify', { channel: 'sms', destination: '+261341112277', code: sentA.demoCode }, a.token);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });

  it('limite les envois par client et bloque une adresse après trop d’essais ratés', async () => {
    const { core } = newCore();
    for (let i = 0; i < 10; i++) {
      const r = await core.handle({ method: 'POST', path: '/auth/otp/request', body: { channel: 'email', destination: `x${i}@exemple.com`, purpose: 'login' }, clientId: '203.0.113.7' });
      assert.equal(r.status, 200);
    }
    const blocked = await core.handle({ method: 'POST', path: '/auth/otp/request', body: { channel: 'email', destination: 'x99@exemple.com', purpose: 'login' }, clientId: '203.0.113.7' });
    assert.equal(blocked.status, 429);
    const elsewhere = await core.handle({ method: 'POST', path: '/auth/otp/request', body: { channel: 'email', destination: 'x99@exemple.com', purpose: 'login' }, clientId: '198.51.100.2' });
    assert.equal(elsewhere.status, 200);

    const target = { channel: 'email', destination: 'cible@exemple.com' };
    for (let round = 0; round < 4; round++) {
      ageOtps(core, 61_000);
      const sent = b(await post(core, '/auth/otp/request', { ...target, purpose: 'login' }));
      const wrong = sent.demoCode === '999999' ? '000000' : '999999';
      for (let i = 0; i < 5; i++) await post(core, '/auth/otp/verify', { ...target, code: wrong });
    }
    ageOtps(core, 2 * 60 * 60_000);
    const locked = await post(core, '/auth/otp/request', { ...target, purpose: 'login' });
    assert.equal(locked.status, 429, 'bloqué après 20 essais ratés en 24 h');
  });
});

describe('expéditeurs SMS et e-mail', () => {
  it('Twilio : URL, authentification Basic et formulaire', async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetcher = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ sid: 'SM1', status: 'queued' }), { status: 201 });
    }) as unknown as typeof fetch;
    await new TwilioSmsSender('AC123', 'tok', '+15005550006', undefined, fetcher).send({ to: '+261341234567', subject: 's', text: 'Code 123456' });
    assert.equal(captured!.url, 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    const headers = captured!.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Basic ${Buffer.from('AC123:tok').toString('base64')}`);
    const form = new URLSearchParams(String(captured!.init.body));
    assert.deepEqual(Object.fromEntries(form), { To: '+261341234567', Body: 'Code 123456', From: '+15005550006' });

    const failing = (async () => new Response(JSON.stringify({ code: 21211, message: "The 'To' number is not valid." }), { status: 400 })) as unknown as typeof fetch;
    await assert.rejects(new TwilioSmsSender('AC1', 't', '+1', undefined, failing).send({ to: 'x', subject: '', text: '' }), /21211/);
  });

  it('Resend : en-tête Bearer et corps JSON', async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetcher = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: 'abc' }), { status: 200 });
    }) as unknown as typeof fetch;
    await new ResendEmailSender('re_key', 'Roysti <no-reply@exemple.com>', fetcher).send({ to: 'a@b.co', subject: 'Code', text: 'Code 123456' });
    assert.equal(captured!.url, 'https://api.resend.com/emails');
    assert.equal((captured!.init.headers as Record<string, string>).Authorization, 'Bearer re_key');
    assert.deepEqual(JSON.parse(String(captured!.init.body)), { from: 'Roysti <no-reply@exemple.com>', to: ['a@b.co'], subject: 'Code', text: 'Code 123456' });
  });

  it('une erreur d’envoi est signalée et le code annulé', async () => {
    const failing: MessageSender = { channel: 'sms', name: 'ko', demo: false, send: async () => Promise.reject(new Error('panne')) };
    const core = createCore({ store: new Store({ uuid: nodeRuntime.uuid }), provider: new MockProvider(), runtime: nodeRuntime, senders: { sms: failing, email: new DemoSender('email') } });
    const res = await post(core, '/auth/otp/request', { channel: 'sms', destination: '+261341234567', purpose: 'login' });
    assert.equal(res.status, 502);
    assert.ok(!b(res).error!.includes('panne'), 'le détail du prestataire reste côté serveur');
    assert.ok(core.store.data.otps.every((o) => o.consumed));
  });
});
