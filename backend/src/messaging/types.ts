export type Channel = 'email' | 'sms';

export interface OutgoingMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoi d'un message (code de connexion…). Implémentations portables (fetch seulement),
 * utilisables par le serveur Node comme par l'application.
 */
export interface MessageSender {
  readonly channel: Channel;
  readonly name: string;
  /** Vrai si aucun message n'est réellement envoyé (mode démonstration). */
  readonly demo: boolean;
  send(message: OutgoingMessage): Promise<void>;
}

export class DeliveryError extends Error {
  constructor(message: string) {
    super(message);
  }
}
