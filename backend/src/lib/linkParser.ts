import type { Platform } from '../types.js';
import { timeoutSignal } from './env.js';

export interface ParsedLink {
  platform: Platform;
  itemId: string;
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>，。「」【】]+/i;

/**
 * Extrait la première URL d'un texte de partage, par exemple :
 * « 【淘宝】https://m.tb.cn/h.abc?tk=xyz 「T恤」点击链接直接打开 ».
 * Accepte aussi une URL sans schéma (« item.taobao.com/item.htm?id=1 »).
 */
export function extractFirstUrl(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(URL_IN_TEXT);
  if (match) return match[0];
  if (/^[\w.-]+\.(com|cn)\//i.test(trimmed)) return `https://${trimmed.split(/\s/)[0]}`;
  return null;
}

function toUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function numericParam(url: URL, ...names: string[]): string | null {
  for (const name of names) {
    for (const [key, value] of url.searchParams) {
      if (key.toLowerCase() === name.toLowerCase() && /^\d{5,}$/.test(value)) return value;
    }
  }
  return null;
}

/** Liens d'agents d'achat (Superbuy, CSSBuy, etc.) qui encapsulent le lien d'origine. */
function parseAgentLink(url: URL, depth: number): ParsedLink | null {
  for (const key of ['url', 'productLink', 'link', 'goodsUrl']) {
    const inner = url.searchParams.get(key);
    if (inner) {
      const parsed = parseProductLinkInternal(inner, depth + 1);
      if (parsed) return parsed;
    }
  }

  // CSSBuy : /item-<id>.html (Taobao), /item-1688-<id>.html, /item-micro-<id>.html (Weidian)
  if (url.hostname.endsWith('cssbuy.com')) {
    const m = url.pathname.match(/\/item-(?:(1688|micro|jd|tmall)-)?(\d{5,})\.html/i);
    if (m && m[2]) {
      const kind = m[1]?.toLowerCase();
      const platform: Platform =
        kind === '1688' ? '1688' : kind === 'micro' ? 'weidian' : kind === 'jd' ? 'jd' : kind === 'tmall' ? 'tmall' : 'taobao';
      return { platform, itemId: m[2] };
    }
  }
  return null;
}

function parseProductLinkInternal(input: string, depth: number): ParsedLink | null {
  if (depth > 3) return null;
  const raw = extractFirstUrl(input);
  if (!raw) return null;
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host.endsWith('tmall.com') || host.endsWith('tmall.hk')) {
    const id = numericParam(url, 'id', 'itemId');
    return id ? { platform: 'tmall', itemId: id } : null;
  }

  if (host.endsWith('taobao.com')) {
    const id = numericParam(url, 'id', 'itemId');
    if (id) return { platform: 'taobao', itemId: id };
    const m = path.match(/\/item\/(\d{5,})\.htm/);
    return m && m[1] ? { platform: 'taobao', itemId: m[1] } : null;
  }

  if (host.endsWith('1688.com')) {
    const m = path.match(/\/offer\/(\d{5,})\.html/);
    if (m && m[1]) return { platform: '1688', itemId: m[1] };
    const id = numericParam(url, 'offerId', 'offerid', 'id');
    return id ? { platform: '1688', itemId: id } : null;
  }

  if (host.endsWith('alibaba.com')) {
    const detail = path.match(/_(\d{6,})\.html/);
    if (detail && detail[1]) return { platform: 'alibaba', itemId: detail[1] };
    const product = path.match(/\/product\/(\d{6,})/);
    return product && product[1] ? { platform: 'alibaba', itemId: product[1] } : null;
  }

  if (host.endsWith('jd.com') || host.endsWith('jd.hk')) {
    const m = path.match(/\/(?:product\/)?(\d{5,})\.html/);
    if (m && m[1]) return { platform: 'jd', itemId: m[1] };
    const id = numericParam(url, 'sku', 'wareId');
    return id ? { platform: 'jd', itemId: id } : null;
  }

  if (host.endsWith('weidian.com')) {
    const id = numericParam(url, 'itemID', 'itemId', 'id');
    return id ? { platform: 'weidian', itemId: id } : null;
  }

  return parseAgentLink(url, depth);
}

/**
 * Analyse un lien produit (ou un texte de partage contenant un lien) et renvoie
 * la plateforme et l'identifiant de l'article. Renvoie null si le lien n'est pas reconnu.
 */
export function parseProductLink(input: string): ParsedLink | null {
  return parseProductLinkInternal(input, 0);
}

/** Domaines de liens courts qui doivent être résolus par une requête réseau. */
const SHORT_LINK_HOSTS = ['m.tb.cn', 'e.tb.cn', 's.tb.cn', 'tb.cn', 'qr.1688.com', 'u.jd.com', '3.cn'];

export function isShortLink(input: string): boolean {
  const raw = extractFirstUrl(input);
  const url = raw ? toUrl(raw) : null;
  return !!url && SHORT_LINK_HOSTS.includes(url.hostname.toLowerCase());
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Résout un lien court (m.tb.cn…) en suivant les redirections puis, à défaut,
 * en cherchant une URL d'article dans le corps HTML renvoyé.
 * Fonctionnement au mieux : les plateformes peuvent changer ce format sans préavis.
 */
export async function resolveProductLink(input: string, fetcher?: Fetcher): Promise<ParsedLink | null> {
  const direct = parseProductLink(input);
  if (direct) return direct;
  if (!isShortLink(input)) return null;

  const raw = extractFirstUrl(input)!;
  try {
    const res = await (fetcher ?? fetch)(raw, { redirect: 'follow', signal: timeoutSignal(8000) });
    const fromFinalUrl = parseProductLink(res.url);
    if (fromFinalUrl) return fromFinalUrl;
    const body = await res.text();
    const candidates = body.match(/https?:\/\/[^\s"'<>\\]+/g) ?? [];
    for (const candidate of candidates) {
      const parsed = parseProductLink(candidate.replace(/&amp;/g, '&'));
      if (parsed) return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

/** Construit l'URL publique de l'article sur sa plateforme d'origine. */
export function buildSourceUrl(platform: Platform, itemId: string): string {
  switch (platform) {
    case 'taobao':
      return `https://item.taobao.com/item.htm?id=${itemId}`;
    case 'tmall':
      return `https://detail.tmall.com/item.htm?id=${itemId}`;
    case '1688':
      return `https://detail.1688.com/offer/${itemId}.html`;
    case 'alibaba':
      return `https://www.alibaba.com/product-detail/_${itemId}.html`;
    case 'jd':
      return `https://item.jd.com/${itemId}.html`;
    case 'weidian':
      return `https://weidian.com/item.html?itemID=${itemId}`;
  }
}
