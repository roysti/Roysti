import { toBase64 } from '../lib/base64.js';
import { timeoutSignal } from '../lib/env.js';
import { DeliveryError, type MessageSender, type OutgoingMessage } from './types.js';

/**
 * SMS via l'API Messages de Twilio :
 * POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 * (formulaire x-www-form-urlencoded : To, From ou MessagingServiceSid, Body ; authentification Basic).
 */
export class TwilioSmsSender implements MessageSender {
  readonly channel = 'sms' as const;
  readonly name = 'twilio';
  readonly demo = false;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    /** Numéro expéditeur (+1…) ou identifiant alphanumérique ; sinon messagingServiceSid. */
    private readonly from: string | undefined,
    private readonly messagingServiceSid: string | undefined,
    private readonly fetcher?: typeof fetch,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    const body = new URLSearchParams({ To: message.to, Body: message.text });
    if (this.messagingServiceSid) body.set('MessagingServiceSid', this.messagingServiceSid);
    else if (this.from) body.set('From', this.from);
    const res = await (this.fetcher ?? fetch)(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${toBase64(`${this.accountSid}:${this.authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: timeoutSignal(15000),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
      throw new DeliveryError(`Twilio : ${err.message ?? `HTTP ${res.status}`}${err.code ? ` (code ${err.code})` : ''}`);
    }
  }
}
