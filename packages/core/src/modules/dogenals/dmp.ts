/**
 * ÐMP envelope — dogenals/spec/protocols/dmp/spec.md
 * Public canonical: github.com/jonheaven/dmp-spec
 *
 * Marker is `p: "Ð:MP"`. Ops are `list` / `bid` / `settle` / `cancel` / …
 * Price is a decimal string of koinu. PSDT is the fill contract.
 */

export const DMP_MARKER = 'Ð:MP';
export const DMP_VERSION = '1.0';

export type DmpOp = 'list' | 'bid' | 'settle' | 'cancel' | 'collection' | 'auction' | 'offer';

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
  ts?: number;
  [key: string]: unknown;
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

export function buildDmpEnvelope(op: DmpOp, fields: Record<string, unknown>): DmpEnvelope {
  const body: DmpEnvelope = {
    p: DMP_MARKER,
    op,
    ...fields,
  };
  if (body.price !== undefined) body.price = koinuString(body.price as string | number);
  return body;
}

export function buildDmpListEnvelope(opts: {
  inscriptionId: string;
  priceKoinu: string | number;
  seller: string;
  psdt?: string;
  ts?: number;
  extra?: Record<string, unknown>;
}): DmpEnvelope {
  return buildDmpEnvelope('list', {
    inscription_id: opts.inscriptionId.trim().toLowerCase(),
    price: koinuString(opts.priceKoinu),
    seller: opts.seller,
    ...(opts.psdt ? { psdt: opts.psdt } : {}),
    ts: opts.ts ?? Math.floor(Date.now() / 1000),
    ...opts.extra,
  });
}

export function stringifyDmpEnvelope(envelope: DmpEnvelope): string {
  return JSON.stringify(envelope);
}

export function isDmpEnvelope(value: unknown): value is DmpEnvelope {
  if (!value || typeof value !== 'object') return false;
  const p = (value as { p?: unknown }).p;
  return p === DMP_MARKER || p === 'dmp';
}
