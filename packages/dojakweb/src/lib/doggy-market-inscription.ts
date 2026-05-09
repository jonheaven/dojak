/**
 * Doggy Market indexer JSON + helpers for buy-flow inscription preview.
 * @see https://api.doggy.market/inscriptions/{inscriptionId}
 */

import * as bitcoin from 'bitcoinjs-lib';
import { normalizeDoginalInscriptionId } from '../utils/api';
import { DOGE_NETWORK } from './doginal-psdt';

export const DOGGY_INSCRIPTION_API_BASE = 'https://api.doggy.market/inscriptions/';

export type DoggyMarketInscriptionMeta = {
  inscriptionId: string;
  content: string;
  contentType?: string;
  preview?: string;
  output?: string;
  inscriptionNumber?: number;
};

export function doggyMarketInscriptionJsonUrl(inscriptionId: string): string {
  return `${DOGGY_INSCRIPTION_API_BASE}${encodeURIComponent(normalizeDoginalInscriptionId(inscriptionId))}`;
}

export function doggyMarketInscriptionPageUrl(inscriptionId: string): string {
  return `https://doggy.market/inscription/${encodeURIComponent(normalizeDoginalInscriptionId(inscriptionId))}`;
}

/** Raw inscription bytes on Doggy CDN (often an image); works when JSON metadata fetch fails. */
export function doggyMarketInscriptionCdnContentUrl(inscriptionId: string): string {
  const id = normalizeDoginalInscriptionId(inscriptionId).trim();
  return `https://cdn.doggy.market/content/${encodeURIComponent(id)}`;
}

/**
 * Best-effort id when the paste has no `?inscription=` — uses seller PSBT input 0 as `{txid}i{vout}`.
 * This matches some indexers for inscriptions still at that outpoint; transferred inscriptions may need a full listing URL.
 */
export function inscriptionIdCandidateFromSellerPsdt(psbtBase64: string): string | null {
  try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64.trim(), { network: DOGE_NETWORK });
    if (psbt.txInputs.length < 1) return null;
    const tin = psbt.txInputs[0];
    const txid = Buffer.from(tin.hash).reverse().toString('hex');
    return `${txid}i${tin.index}`;
  } catch {
    return null;
  }
}

/** Compare indexer `output` (e.g. txid:vout) to the listing UTXO from validation. */
export function doggyOutputMatchesListingUtxo(
  doggyOutput: string | undefined,
  listingUtxo: string | null | undefined,
): boolean | null {
  if (!doggyOutput?.trim() || !listingUtxo?.trim()) return null;
  const a = doggyOutput.replace(/\s/g, '').toLowerCase();
  const b = listingUtxo.replace(/\s/g, '').toLowerCase();
  return a === b;
}

export async function fetchDoggyMarketInscription(
  inscriptionId: string,
  signal?: AbortSignal,
): Promise<DoggyMarketInscriptionMeta | null> {
  const id = normalizeDoginalInscriptionId(inscriptionId).trim();
  if (!/^([0-9a-fA-F]{64})i\d+$/.test(id)) return null;

  const urls: string[] = [
    ...(typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
      ? [`http://localhost:7070/api/inscriptions/${encodeURIComponent(id)}`]
      : []),
    `/api/doggy-inscription?id=${encodeURIComponent(id)}`,
    doggyMarketInscriptionJsonUrl(id),
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const j = (await res.json()) as DoggyMarketInscriptionMeta;
      if (!j || typeof j.inscriptionId !== 'string' || typeof j.content !== 'string') continue;
      return j;
    } catch {
      /* try next */
    }
  }
  return null;
}
