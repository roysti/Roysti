/**
 * Outils de lecture défensive des réponses JSON des fournisseurs : les champs peuvent
 * être absents, null, des nombres envoyés en chaînes (« 25.90 ») ou des tableaux vides
 * à la place d'objets. Rien ici ne dépend de Node : ce code tourne aussi sur le téléphone.
 */
export type Json = Record<string, unknown>;

export const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};
export const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
export const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Nombre strictement positif, sinon undefined (0 signifie souvent « inconnu »). */
export const positive = (v: unknown): number | undefined => {
  const n = num(v, 0);
  return n > 0 ? n : undefined;
};

/** Les CDN Alibaba renvoient souvent des URL sans schéma (//img.alicdn.com/...) ou en http. */
export function normalizeImageUrl(url: unknown): string {
  const u = str(url).trim();
  if (!u) return '';
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`;
  return u;
}

/** URL avec paramètres de requête, sans dépendre de l'objet URL (incomplet sur certains moteurs). */
export function buildUrl(base: string, path: string, params: Record<string, string | number | boolean | undefined>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${base.replace(/\/+$/, '')}${path}${query ? `?${query}` : ''}`;
}

/** Combinaison « pid:vid;pid:vid » → { pid: vid }. */
export function parsePropPath(path: unknown): Record<string, string> {
  const props: Record<string, string> = {};
  for (const pair of str(path).split(';')) {
    const [pid, vid] = pair.split(':');
    if (pid && vid) props[pid] = vid;
  }
  return props;
}

/** Masque une clé dans un message d'erreur ou un journal. */
export function redact(text: string, ...secrets: (string | undefined)[]): string {
  let out = text;
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join('•••');
  return out;
}
