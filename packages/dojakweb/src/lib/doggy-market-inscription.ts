/**
 * Doggy Market indexer JSON + helpers for buy-flow inscription preview.
 * @see https://api.doggy.market/inscriptions/{inscriptionId}
 */

import * as bitcoin from 'bitcoinjs-lib';
import { getIndexerApiBase, getWalletDataProviderConfig, normalizeDoginalInscriptionId } from '../utils/api';
import { DOGE_NETWORK } from './doginal-psdt';

export const DOGGY_INSCRIPTION_API_BASE = 'https://api.doggy.market/inscriptions/';

export type DoggyMarketInscriptionMeta = {
  inscriptionId: string;
  content: string;
  contentType?: string;
  preview?: string;
  output?: string;
  inscriptionNumber?: number;
  owner?: string;
  contentLength?: number;
  blockHeight?: number;
  collectionName?: string;
  collectionSlug?: string;
  itemName?: string;
  traits?: Array<{ key: string; value: string }>;
  outputValue?: number | string;
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
  ];
  // Same-origin `/api/doggy` (Express → api.doggy.market, Vercel → command.dog).
  // Do not fetch api.doggy.market from the browser (CORS). Do not require dogex.
  urls.push(`/api/doggy/inscriptions/${encodeURIComponent(id)}`);
  const cfg = typeof window !== 'undefined' ? getWalletDataProviderConfig() : null;
  if (cfg?.walletDataProvider === 'dogex') {
    urls.push(`${getIndexerApiBase()}/api/compat/doggy/inscriptions/${encodeURIComponent(id)}`);
  }

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, unknown>;
      const inscriptionId = typeof j.inscriptionId === 'string' ? j.inscriptionId : '';
      const content = typeof j.content === 'string' ? j.content : '';
      if (!inscriptionId) continue;
      const nft = (j.nft && typeof j.nft === 'object' ? j.nft : {}) as Record<string, unknown>;
      const collection =
        nft.collection && typeof nft.collection === 'object'
          ? (nft.collection as Record<string, unknown>)
          : {};
      const rawTraits = Array.isArray(nft.traits) ? nft.traits : [];
      const traits = rawTraits
        .map((row) => {
          const t = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
          const key = String(t.key ?? t.trait_type ?? '').trim();
          const value = String(t.value ?? '').trim();
          return key && value ? { key, value } : null;
        })
        .filter((row): row is { key: string; value: string } => Boolean(row));
      return {
        inscriptionId,
        content: content || doggyMarketInscriptionCdnContentUrl(inscriptionId),
        contentType: typeof j.contentType === 'string' ? j.contentType : undefined,
        preview: typeof j.preview === 'string' ? j.preview : undefined,
        output: typeof j.output === 'string' ? j.output : undefined,
        inscriptionNumber: typeof j.inscriptionNumber === 'number' ? j.inscriptionNumber : undefined,
        owner: typeof j.owner === 'string' ? j.owner : typeof j.ownerAddress === 'string' ? j.ownerAddress : undefined,
        contentLength: typeof j.contentLength === 'number' ? j.contentLength : undefined,
        blockHeight: typeof j.blockHeight === 'number' ? j.blockHeight : undefined,
        collectionName:
          typeof collection.name === 'string'
            ? collection.name
            : typeof nft.collectionName === 'string'
              ? nft.collectionName
              : undefined,
        collectionSlug:
          typeof collection.collectionId === 'string'
            ? collection.collectionId
            : typeof nft.collectionId === 'string'
              ? nft.collectionId
              : undefined,
        itemName: typeof nft.itemName === 'string' ? nft.itemName : undefined,
        traits: traits.length ? traits : undefined,
        outputValue:
          typeof j.outputValue === 'number' || typeof j.outputValue === 'string' ? j.outputValue : undefined,
      };
    } catch {
      /* try next */
    }
  }
  return null;
}
