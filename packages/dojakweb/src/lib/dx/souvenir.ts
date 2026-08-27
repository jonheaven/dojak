/**
 * Product-layer Ð𝕏 souvenir discovery.
 *
 * dogex indexes the OP_RETURN `DX` bind only. The HTML card is a collectible —
 * find it by scanning the address's `text/html` inscriptions for the souvenir marker.
 */

import { doggyMarketInscriptionCdnContentUrl } from '../doggy-market-inscription';
import { dogexCdnContentUrl, walletDataApi, type MyDogeInscription } from '../../utils/api';
import { isHtmlInscription, loadInscriptionTextBody } from '../../utils/inscription-text';
import { isDxSouvenirHtml } from './displayHtml';

export type DxSouvenirHit = {
  inscriptionId: string;
  inscriptionNumber?: number;
  contentType?: string;
  content?: string;
  preview?: string;
  html: string;
};

function contentUrls(item: Pick<MyDogeInscription, 'inscriptionId' | 'content' | 'preview'>): string[] {
  const out: string[] = [];
  const push = (u?: string | null) => {
    const s = (u || '').trim();
    if (s && !out.includes(s)) out.push(s);
  };
  push(item.content);
  push(item.preview);
  const id = String(item.inscriptionId || '').trim();
  if (id) {
    try {
      push(doggyMarketInscriptionCdnContentUrl(id));
    } catch {
      /* ignore */
    }
    try {
      push(dogexCdnContentUrl(id));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function handleInBody(html: string, xHandle?: string | null): boolean {
  if (!xHandle?.trim()) return true;
  const h = xHandle.trim().replace(/^@+/, '').toLowerCase();
  if (!h) return true;
  return html.toLowerCase().includes(`@${h}`) || html.toLowerCase().includes(h);
}

export async function findDxSouvenirInInscriptions(
  inscriptions: Array<Pick<MyDogeInscription, 'inscriptionId' | 'inscriptionNumber' | 'contentType' | 'content' | 'preview' | 'contentBody'>>,
  opts?: { xHandle?: string | null; signal?: AbortSignal },
): Promise<DxSouvenirHit | null> {
  const htmlItems = inscriptions.filter((row) => isHtmlInscription(row.contentType));
  let fallback: DxSouvenirHit | null = null;
  for (const item of htmlItems.slice(0, 24)) {
    if (opts?.signal?.aborted) return fallback;
    const urls = contentUrls(item);
    const body = await loadInscriptionTextBody({
      contentBody: item.contentBody,
      contentUrl: urls[0],
      inscriptionId: item.inscriptionId,
      fallbackContentUrl: urls[1],
      extraFallbackUrls: urls.slice(2),
      signal: opts?.signal,
    });
    if (!isDxSouvenirHtml(body)) continue;
    const hit: DxSouvenirHit = {
      inscriptionId: item.inscriptionId,
      inscriptionNumber: item.inscriptionNumber,
      contentType: item.contentType,
      content: item.content,
      preview: item.preview,
      html: body!,
    };
    if (handleInBody(body!, opts?.xHandle)) return hit;
    if (!fallback) fallback = hit;
  }
  return fallback;
}

export async function findDxSouvenirForAddress(opts: {
  address: string;
  inscriptions?: MyDogeInscription[];
  xHandle?: string | null;
  signal?: AbortSignal;
}): Promise<DxSouvenirHit | null> {
  const address = opts.address.trim();
  if (!address) return null;
  const fromProp = opts.inscriptions?.length
    ? await findDxSouvenirInInscriptions(opts.inscriptions, opts)
    : null;
  if (fromProp) return fromProp;
  try {
    const listed = await walletDataApi.fetchInscriptions(address);
    return findDxSouvenirInInscriptions(listed, opts);
  } catch {
    return null;
  }
}
