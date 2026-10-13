import { env } from '../lib/env.js';
import { DemoSender } from './demo.js';
import { ResendEmailSender } from './resend.js';
import { TwilioSmsSender } from './twilio.js';
import type { MessageSender } from './types.js';

export interface Senders {
  email: MessageSender;
  sms: MessageSender;
}

export const demoSenders = (): Senders => ({ email: new DemoSender('email'), sms: new DemoSender('sms') });

/**
 * Expéditeurs configurés par variables d'environnement (serveur) :
 * SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM ou TWILIO_MESSAGING_SERVICE_SID ;
 * EMAIL_PROVIDER=resend + RESEND_API_KEY, EMAIL_FROM. À défaut : mode démonstration.
 */
export function createSenders(): Senders {
  const senders = demoSenders();
  if (env('SMS_PROVIDER') === 'twilio') {
    const sid = env('TWILIO_ACCOUNT_SID');
    const token = env('TWILIO_AUTH_TOKEN');
    const from = env('TWILIO_FROM');
    const service = env('TWILIO_MESSAGING_SERVICE_SID');
    if (!sid || !token || (!from && !service)) throw new Error('SMS_PROVIDER=twilio nécessite TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM (ou TWILIO_MESSAGING_SERVICE_SID)');
    senders.sms = new TwilioSmsSender(sid, token, from, service);
  }
  if (env('EMAIL_PROVIDER') === 'resend') {
    const key = env('RESEND_API_KEY');
    const from = env('EMAIL_FROM');
    if (!key || !from) throw new Error('EMAIL_PROVIDER=resend nécessite RESEND_API_KEY et EMAIL_FROM');
    senders.email = new ResendEmailSender(key, from);
  }
  return senders;
}

export type { MessageSender };
export { DemoSender, ResendEmailSender, TwilioSmsSender };
