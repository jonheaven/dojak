/**
 * Wallet Assets media URLs that do not depend on the local dogex tunnel.
 * Doggy CDN + MyDoge stay up when Cloudflare 530s /api/indexer.
 */
import { doggyMarketInscriptionCdnContentUrl } from './doggy-market-inscription';
import { normalizeDoginalInscriptionId } from '../utils/api';

export function mydogeInscriptionContentUrl(inscriptionId: string): string {
  const id = normalizeDoginalInscriptionId(inscriptionId);
  return `https://api.mydoge.com/content/${encodeURIComponent(id)}`;
}

export function sameOriginDoggyContentUrl(inscriptionId: string): string | null {
  if (typeof window === 'undefined') return null;
  const id = normalizeDoginalInscriptionId(inscriptionId);
  return `${window.location.origin}/api/doggy/content/${encodeURIComponent(id)}`;
}

function isOurIndexerUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('/api/indexer') ||
    u.includes('/__indexer') ||
    u.includes('dogex.command.dog') ||
    u.includes('/cdn/content/')
  );
}

function rewriteRelativeContent(raw: string, inscriptionId: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const id = normalizeDoginalInscriptionId(inscriptionId);
  if (t.startsWith('/content/')) {
    const rest = t.slice('/content/'.length).split(/[/?#]/)[0] || id;
    return doggyMarketInscriptionCdnContentUrl(rest);
  }
  try {
    const u = new URL(t, typeof window !== 'undefined' ? window.location.origin : 'https://invalid.local');
    const idx = u.pathname.toLowerCase().lastIndexOf('/content/');
    if (idx >= 0) {
      const rest = u.pathname.slice(idx + '/content/'.length).split(/[/?#]/)[0];
      if (rest && (u.hostname === 'localhost' || u.hostname.endsWith('.dog') || u.pathname.startsWith('/content/'))) {
        if (u.hostname.includes('mydoge.com')) return mydogeInscriptionContentUrl(rest);
        if (u.hostname.includes('doggy.market')) return doggyMarketInscriptionCdnContentUrl(rest);
        if (isOurIndexerUrl(t) || u.hostname === (typeof window !== 'undefined' ? window.location.hostname : '')) {
          return doggyMarketInscriptionCdnContentUrl(rest || id);
        }
      }
    }
  } catch {
    /* keep */
  }
  return null;
}

/** Ordered src list: provider URL (if not dogex), Doggy CDN, MyDoge, same-origin doggy proxy last. */
export function inscriptionContentCandidates(opts: {
  inscriptionId?: string | null;
  content?: string | null;
  preview?: string | null;
}): string[] {
  const out: string[] = [];
  const push = (u?: string | null) => {
    const s = (u || '').trim();
    if (s && !out.includes(s)) out.push(s);
  };

  const id = (opts.inscriptionId || '').trim();
  const consider = (raw?: string | null) => {
    const t = (raw || '').trim();
    if (!t) return;
    if (isOurIndexerUrl(t)) {
      if (id) push(doggyMarketInscriptionCdnContentUrl(id));
      return;
    }
    const rewritten = id ? rewriteRelativeContent(t, id) : null;
    if (rewritten && rewritten !== t) {
      push(rewritten);
      if (!isOurIndexerUrl(t)) push(t);
      return;
    }
    push(t);
  };

  consider(opts.content);
  consider(opts.preview);
  if (id) {
    push(doggyMarketInscriptionCdnContentUrl(id));
    push(mydogeInscriptionContentUrl(id));
    push(sameOriginDoggyContentUrl(id));
  }
  return out;
}

export function inscriptionContentPrimary(opts: {
  inscriptionId?: string | null;
  content?: string | null;
  preview?: string | null;
}): string {
  return inscriptionContentCandidates(opts)[0] || '';
}
