/**
 * Services dépendant de la plateforme, injectés dans la logique métier :
 * node:crypto côté serveur, expo-crypto + @noble/hashes dans l'application.
 */
export interface Runtime {
  /** Identifiant unique (UUID v4). */
  uuid(): string;
  /** `bytes` octets aléatoires cryptographiquement sûrs, encodés en hexadécimal. */
  randomHex(bytes: number): string;
  /** Empreinte d'un mot de passe salé, en hexadécimal. */
  hashPassword(password: string, salt: string): string;
  /** Comparaison de deux chaînes hexadécimales en temps constant. */
  safeEqual(a: string, b: string): boolean;
}

/** Comparaison en temps constant, utilisable par les implémentations sans node:crypto. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
