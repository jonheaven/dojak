/**
 * ÐMP envelope — dogenals/spec/protocols/dmp/spec.md
 * Public canonical: github.com/jonheaven/dmp-spec
 *
 * Marker is `p: "Ð:MP"`. Write budget: embed `psdt` when it fits; else `psdt_hash`
 * (PSDT off-band). Chatty bids prefer DogeTag; sale truth is the payment tx.
 */

import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from './hash16';

export const DMP_MARKER = 'Ð:MP';
export const DMP_VERSION = '1.0';

/** Soft body cap (~4 KB) before falling back to hash-only list. */
export const DMP_LIST_MAX_JSON_BYTES = 3_800;

export type DmpOp =
  | 'list'
  | 'bid'
  | 'settle'
  | 'cancel'
  | 'collection'
  | 'collection-update'
  | 'vote'
  | 'auction'
  | 'offer'
  | 'counteroffer'
  | 'accept'
  | 'decline'
  | 'transfer';

export type DmpEnvelope = {
  p: typeof DMP_MARKER;
  v?: typeof DMP_VERSION;
  op: DmpOp;
  seller?: string;
  inscription_id?: string;
  listing_id?: string;
  bid_id?: string;
  price?: string;
  psdt?: string;
  psdt_hash?: string;
  ts?: number;
  [key: string]: unknown;
};

export type DmpListBuildResult = {
  envelope: DmpEnvelope;
  json: string;
  embeddedPsdt: boolean;
  psdtHash: string | null;
  sellerPsdtB64: string;
};

function koinuString(price: string | number): string {
  if (typeof price === 'number') {
    if (!Number.isSafeInteger(price) || price <= 0) throw new Error('ÐMP price must be a positive integer koinu');
    return String(price);
  }
  const s = price.trim();
  if (!/^[1-9]\d*$/.test(s)) throw new Error('ÐMP price must be a decimal string of koinu');
  return s;
}

function decodePsdtBase64(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64.trim());
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const Buf = (globalThis as { Buffer?: { from: (s: string, enc: string) => Uint8Array } }).Buffer;
  if (Buf) return new Uint8Array(Buf.from(b64.trim(), 'base64'));
  throw new Error('base64 decode unavailable');
}

/** SHA-256 hex of raw PSDT bytes (MUST-110). */
export function hashPsdtBase64(psdtB64: string): string {
  return bytesToHex(sha256(decodePsdtBase64(psdtB64)));
}

function utf8Len(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function buildDmpEnvelope(op: DmpOp, fields: Record<string, unknown>): DmpEnvelope {
  const body: DmpEnvelope = {
    p: DMP_MARKER,
    op,
    ...fields,
  };
  if (body.price !== undefined) body.price = koinuString(body.price as string | number);
  return body;
}

type ListOpts = {
  inscriptionId: string;
  priceKoinu: string | number;
  seller: string;
  psdt?: string;
  /** When set without a fitting `psdt`, emit hash-only list. */
  psdtHash?: string;
  ts?: number;
  extra?: Record<string, unknown>;
  maxJsonBytes?: number;
};

/**
 * Build a ÐMP `list` with write-budget fallback (`psdt` → slim → `psdt_hash`).
 */
export function buildDmpListPayload(opts: ListOpts): DmpListBuildResult {
  const maxBytes = opts.maxJsonBytes ?? DMP_LIST_MAX_JSON_BYTES;
  const psdt = opts.psdt?.trim() || '';
  const explicitHash = opts.psdtHash?.trim().toLowerCase() || '';
  const baseFields: Record<string, unknown> = {
    inscription_id: opts.inscriptionId.trim().toLowerCase(),
    price: koinuString(opts.priceKoinu),
    seller: opts.seller,
    ts: opts.ts ?? Math.floor(Date.now() / 1000),
    ...opts.extra,
  };

  const finish = (
    fields: Record<string, unknown>,
    embedded: boolean,
    hash: string | null,
    sellerB64: string,
  ): DmpListBuildResult => {
    const envelope = buildDmpEnvelope('list', fields);
    return {
      envelope,
      json: JSON.stringify(envelope),
      embeddedPsdt: embedded,
      psdtHash: hash,
      sellerPsdtB64: sellerB64,
    };
  };

  if (psdt) {
    const hash = explicitHash || hashPsdtBase64(psdt);
    if (explicitHash && hashPsdtBase64(psdt) !== explicitHash) {
      throw new Error('ÐMP psdt_hash mismatch with provided psdt');
    }
    let candidate = finish({ ...baseFields, psdt }, true, hash, psdt);
    if (utf8Len(candidate.json) > maxBytes) {
      const slimExtra = { ...(opts.extra || {}) };
      delete slimExtra.listing_marketplace;
      candidate = finish(
        {
          inscription_id: baseFields.inscription_id,
          price: baseFields.price,
          seller: baseFields.seller,
          ts: baseFields.ts,
          psdt,
          ...slimExtra,
        },
        true,
        hash,
        psdt,
      );
    }
    if (utf8Len(candidate.json) > maxBytes) {
      const slimExtra = { ...(opts.extra || {}) };
      delete slimExtra.listing_marketplace;
      return finish(
        {
          inscription_id: baseFields.inscription_id,
          price: baseFields.price,
          seller: baseFields.seller,
          ts: baseFields.ts,
          psdt_hash: hash,
          ...slimExtra,
        },
        false,
        hash,
        psdt,
      );
    }
    return candidate;
  }

  if (explicitHash) {
    if (explicitHash.length !== 64 || !/^[0-9a-f]+$/.test(explicitHash)) {
      throw new Error('ÐMP psdt_hash must be 64-char lowercase hex');
    }
    return finish({ ...baseFields, psdt_hash: explicitHash }, false, explicitHash, '');
  }

  return finish(baseFields, false, null, '');
}

/** Envelope-only helper (backward compatible). Prefer `buildDmpListPayload` for hash-only metadata. */
export function buildDmpListEnvelope(opts: ListOpts): DmpEnvelope {
  return buildDmpListPayload(opts).envelope;
}

export function stringifyDmpEnvelope(envelope: DmpEnvelope): string {
  return JSON.stringify(envelope);
}

export function isDmpEnvelope(value: unknown): value is DmpEnvelope {
  if (!value || typeof value !== 'object') return false;
  const p = (value as { p?: unknown }).p;
  return p === DMP_MARKER || p === 'dmp';
}
