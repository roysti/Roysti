import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

/**
 * Normalise un numéro saisi (« 034 12 345 67 », « +261 34… ») au format E.164 (« +261341234567 »).
 * - strict : exige un numéro attribué (inscription, ajout d'un numéro) ;
 * - sinon : accepte tout numéro « possible » (connexion), ce qui couvre aussi les plages fictives.
 * Renvoie null si le texte ne peut pas être un numéro.
 */
export function normalizePhone(input: string, defaultCountry?: string, strict = false): string | null {
  const country = defaultCountry && /^[A-Z]{2}$/.test(defaultCountry.toUpperCase()) ? (defaultCountry.toUpperCase() as CountryCode) : undefined;
  const parsed = parsePhoneNumberFromString(input.trim(), country);
  if (!parsed) return null;
  if (strict ? !parsed.isValid() : !parsed.isPossible()) return null;
  return parsed.number;
}

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  // Validation volontairement simple ; la preuve de possession se fait par code.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254 ? email : null;
}

/** Masque une destination pour l'affichage : « +26134•••••67 », « de•••@exemple.com ». */
export function maskDestination(destination: string): string {
  if (destination.includes('@')) {
    const [local = '', domain = ''] = destination.split('@');
    return `${local.slice(0, 2)}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
  return `${destination.slice(0, 6)}${'•'.repeat(Math.max(1, destination.length - 8))}${destination.slice(-2)}`;
}
