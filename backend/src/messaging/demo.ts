import type { Channel, MessageSender, OutgoingMessage } from './types.js';

/**
 * N'envoie rien : le code est renvoyé à l'application (et journalisé) pour pouvoir tester
 * la connexion sans fournisseur SMS/e-mail. À ne jamais utiliser en production.
 */
export class DemoSender implements MessageSender {
  readonly name = 'demo';
  readonly demo = true;
  constructor(readonly channel: Channel) {}

  async send(message: OutgoingMessage): Promise<void> {
    console.info(`[démo ${this.channel}] → ${message.to} : ${message.text}`);
  }
}
