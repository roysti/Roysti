import { AsYouType, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/max';

/** Indicatif international d'un pays (« MG » → « +261 »), ou chaîne vide si inconnu. */
export function dialCode(country: string): string {
  try {
    return `+${getCountryCallingCode(country.toUpperCase() as CountryCode)}`;
  } catch {
    return '';
  }
}

/** Mise en forme pendant la saisie (« 0341234567 » → « 034 12 345 67 »). */
export function formatAsYouType(text: string, country: string): string {
  return new AsYouType(country.toUpperCase() as CountryCode).input(text);
}

/** Drapeau emoji à partir du code pays (indicateurs régionaux Unicode). */
export function flag(country: string): string {
  return country
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

export const DEFAULT_PHONE_COUNTRY = 'MG';
