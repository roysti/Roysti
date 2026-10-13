import { timeoutSignal } from '../lib/env.js';
import { DeliveryError, type MessageSender, type OutgoingMessage } from './types.js';

/** E-mail via l'API Resend : POST https://api.resend.com/emails (Authorization: Bearer <clé>). */
export class ResendEmailSender implements MessageSender {
  readonly channel = 'email' as const;
  readonly name = 'resend';
  readonly demo = false;

  constructor(
    private readonly apiKey: string,
    /** Expéditeur vérifié chez Resend, ex. « Roysti <no-reply@votre-domaine.com> ». */
    private readonly from: string,
    private readonly fetcher?: typeof fetch,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    const res = await (this.fetcher ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text }),
      signal: timeoutSignal(15000),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; name?: string };
      throw new DeliveryError(`Resend : ${err.message ?? `HTTP ${res.status}`}`);
    }
  }
}
