/**
 * DOTC v1 — Dogecoin OTC Deal Protocol
 *
 * Lightweight OP_RETURN receipt for private / live inscription deals.
 * Canonical spec: dogenals/spec/protocols/dotc/spec.md
 *
 * Relation to ÐMP (informative, not on-chain):
 *   DOTC = cheap real-time receipt in the same tx that moves the inscription.
 *   ÐMP settle = optional later inscription for richer marketplace provenance.
 *   A ÐMP settle MAY reference the DOTC txid. DOTC MUST NOT encode venue
 *   names (no "doge.cam") — the wire format is generic for any OTC UI.
 *
 * Envelope (pipe-delimited UTF-8):
 *   dotc|1|<id>|<i>|<f>|<t>|<p>|<ts>[|<n>]
 *
 * Byte budget: Dogecoin standardness is ~80 bytes of OP_RETURN *data*.
 * Full addresses + full txid:vout cannot fit. Builders compact `i`/`f`/`t`
 * under size pressure; the same transaction's value outputs carry the full
 * seller/buyer addresses and the inscription UTXO movement is the atomic proof.
 */

export const DOTC_MARKER = 'dotc';
export const DOTC_VERSION = 1;
export const DOTC_MAX_DATA_BYTES = 80;
export const DOTC_STRETCH_MAX_BYTES = 90;
export const DOTC_NOTE_MAX_CHARS = 25;
export const DOTC_ID_LENGTH = 10;
export const DOTC_COMPACT_TXID_PREFIX = 8;
export const DOTC_COMPACT_ADDR_HEAD = 8;
export const DOTC_COMPACT_ADDR_TAIL = 3;

/** Whole DOGE (v1). Fractional koinu pricing is reserved for a future `k` prefix. */
export type DotcPriceUnit = 'doge';

export type DotcDealFields = {
  id: string;
  inscriptionRef: string;
  from: string;
  to: string;
  /** Integer whole DOGE. */
  price: number;
  /** Unix timestamp (seconds). */
  ts: number;
  /** Optional short note. Omit or empty → field dropped from the wire. */
  note?: string;
};

export type DotcDeal = DotcDealFields & {
  marker: typeof DOTC_MARKER;
  version: typeof DOTC_VERSION;
  priceUnit: DotcPriceUnit;
  /** Exact OP_RETURN UTF-8 string that was (or will be) written. */
  payload: string;
  /** UTF-8 byte length of `payload`. */
  byteLength: number;
  compacted: boolean;
};

export type DotcValidationOk = { ok: true; deal: DotcDeal };
export type DotcValidationErr = { ok: false; errors: string[] };
export type DotcValidation = DotcValidationOk | DotcValidationErr;

export type BuildDotcPayloadInput = {
  id: string;
  inscriptionRef: string;
  from: string;
  to: string;
  price: number;
  ts: number;
  note?: string;
};

/**
 * Recommended PSBT / tx output order for an atomic DOTC inscription sale.
 * Compatible with Dogestash-style Doginals transfers: the inscription-carrying
 * UTXO is spent as input 0 and received as output 0 so the new satpoint is
 * `txid:0`. Dojak / bitcoinjs-lib PSBTs use version 1 + nonWitnessUtxo +
 * SIGHASH_ALL on Dogecoin P2PKH.
 *
 * Inputs:
 *   0  seller inscription carrier (never used as fee)
 *   1+ buyer payment UTXO(s)
 *   optional seller extra UTXOs only if needed for fee (avoid if possible)
 *
 * Outputs:
 *   0  inscription → buyer   (same dust/value as the carrier)
 *   1  payment → seller      (price in koinu = price * 1e8)
 *   2  OP_RETURN DOTC        (value 0; exactly one)
 *   3  optional voluntary tip → treasury (normal P2PKH; not in OP_RETURN)
 *   4+ change → buyer (and seller only if they added extra inputs)
 *
 * Zero forced marketplace fee. Dual-sign: seller signs input 0, buyer signs
 * payment inputs; show {@link formatDotcConfirmation} + the exact payload
 * before either party signs.
 */
export const DOTC_PSBT_OUTPUT_ORDER = [
  'inscription_to_buyer',
  'payment_to_seller',
  'op_return_dotc',
  'optional_tip',
  'change',
] as const;

export type DotcPsbtOutputRole = (typeof DOTC_PSBT_OUTPUT_ORDER)[number];

export type DotcPsbtPlan = {
  inscriptionOutpoint: string;
  buyerAddress: string;
  sellerAddress: string;
  priceKoinu: number;
  payload: string;
  tipAddress?: string;
  tipKoinu?: number;
  outputs: Array<{
    role: DotcPsbtOutputRole;
    address?: string;
    valueKoinu: number;
    opReturn?: string;
  }>;
};

const PIPE = '|';
const ID_RE = /^\d{6}[0-9a-f]{4}$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const PRICE_RE = /^(0|[1-9]\d*)$/;
const TS_RE = /^(0|[1-9]\d*)$/;

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

function randomHex(chars: number): string {
  const n = Math.ceil(chars / 2);
  const buf = new Uint8Array(n);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, chars);
}

function stripPipes(s: string): string {
  return s.replace(/\|/g, '').trim();
}

function utcYymmdd(now: Date): string {
  const y = String(now.getUTCFullYear()).slice(-2);
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** YYMMDD + 4 hex, e.g. `260814a3f9`. */
export function generateDealId(now: Date = new Date()): string {
  return `${utcYymmdd(now)}${randomHex(4)}`;
}

export function parseInscriptionRef(raw: string): {
  txid: string;
  vout: number;
  form: 'outpoint' | 'inscription_id' | 'compact' | 'other';
} | null {
  const s = stripPipes(raw);
  if (!s) return null;
  const colon = s.match(/^([0-9a-f]{8,64}):(\d+)$/i);
  if (colon) {
    const txid = colon[1]!.toLowerCase();
    const vout = Number.parseInt(colon[2]!, 10);
    const form = txid.length === 64 ? 'outpoint' : 'compact';
    return { txid, vout, form };
  }
  const ins = s.match(/^([0-9a-f]{8,64})i(\d+)$/i);
  if (ins) {
    const txid = ins[1]!.toLowerCase();
    const vout = Number.parseInt(ins[2]!, 10);
    const form = txid.length === 64 ? 'inscription_id' : 'compact';
    return { txid, vout, form };
  }
  return { txid: s.toLowerCase(), vout: 0, form: 'other' };
}

export function compactInscriptionRef(raw: string): string {
  const parsed = parseInscriptionRef(raw);
  if (!parsed) return stripPipes(raw).slice(0, 12);
  const prefix = parsed.txid.slice(0, DOTC_COMPACT_TXID_PREFIX);
  return `${prefix}:${parsed.vout}`;
}

export function compactAddress(addr: string): string {
  const s = stripPipes(addr);
  if (s.length <= DOTC_COMPACT_ADDR_HEAD + DOTC_COMPACT_ADDR_TAIL) return s;
  return `${s.slice(0, DOTC_COMPACT_ADDR_HEAD)}${s.slice(-DOTC_COMPACT_ADDR_TAIL)}`;
}

function sanitizeNote(note: string | undefined): string | undefined {
  if (note == null) return undefined;
  const s = stripPipes(note).replace(/[\r\n\t]/g, ' ').trim();
  if (!s) return undefined;
  return s.slice(0, DOTC_NOTE_MAX_CHARS);
}

function joinPayload(parts: {
  id: string;
  i: string;
  f: string;
  t: string;
  p: string;
  ts: string;
  n?: string;
}): string {
  const core = [DOTC_MARKER, String(DOTC_VERSION), parts.id, parts.i, parts.f, parts.t, parts.p, parts.ts];
  if (parts.n) core.push(parts.n);
  return core.join(PIPE);
}

function assertBuildFields(input: BuildDotcPayloadInput): string[] {
  const errors: string[] = [];
  const id = stripPipes(input.id);
  if (!ID_RE.test(id)) {
    errors.push(`id must be YYMMDD + 4 hex (${DOTC_ID_LENGTH} chars), got ${JSON.stringify(input.id)}`);
  }
  if (!stripPipes(input.inscriptionRef)) errors.push('inscriptionRef is required');
  if (!stripPipes(input.from)) errors.push('from (seller) address is required');
  if (!stripPipes(input.to)) errors.push('to (buyer) address is required');
  if (!Number.isInteger(input.price) || input.price < 0) {
    errors.push('price must be a non-negative integer (whole DOGE)');
  }
  if (!Number.isInteger(input.ts) || input.ts < 0) {
    errors.push('ts must be a non-negative unix timestamp (seconds)');
  }
  const brand = `${input.inscriptionRef} ${input.from} ${input.to} ${input.note ?? ''}`.toLowerCase();
  if (brand.includes('doge.cam') || brand.includes('dogecam')) {
    errors.push('on-chain DOTC data must not include venue brand names');
  }
  return errors;
}

/**
 * Build the exact OP_RETURN UTF-8 string. Compacts inscription ref and
 * addresses if the full form exceeds {@link DOTC_MAX_DATA_BYTES}.
 */
export function buildDotcPayload(input: BuildDotcPayloadInput): string {
  const errors = assertBuildFields(input);
  if (errors.length) throw new Error(errors.join('; '));

  const id = stripPipes(input.id).toLowerCase();
  const price = String(input.price);
  const ts = String(input.ts);
  const note = sanitizeNote(input.note);
  const fullI = stripPipes(input.inscriptionRef);
  const fullF = stripPipes(input.from);
  const fullT = stripPipes(input.to);

  const attempts: Array<{ i: string; f: string; t: string; n?: string; compacted: boolean }> = [
    { i: fullI, f: fullF, t: fullT, n: note, compacted: false },
    { i: compactInscriptionRef(fullI), f: fullF, t: fullT, n: note, compacted: true },
    {
      i: compactInscriptionRef(fullI),
      f: compactAddress(fullF),
      t: compactAddress(fullT),
      n: note,
      compacted: true,
    },
    {
      i: compactInscriptionRef(fullI),
      f: compactAddress(fullF),
      t: compactAddress(fullT),
      compacted: true,
    },
  ];

  for (const a of attempts) {
    const payload = joinPayload({ id, i: a.i, f: a.f, t: a.t, p: price, ts, n: a.n });
    if (utf8Bytes(payload) <= DOTC_MAX_DATA_BYTES) return payload;
  }

  throw new Error(
    `DOTC payload exceeds ${DOTC_MAX_DATA_BYTES} bytes even after compacting fields`,
  );
}

export function parseDotc(opReturnString: string): DotcDeal | null {
  if (typeof opReturnString !== 'string') return null;
  let s = opReturnString.trim();
  if (!s) return null;
  if (/^[0-9a-f]+$/i.test(s) && s.length % 2 === 0 && s.toLowerCase().startsWith('6a')) {
    try {
      const hex = s.toLowerCase().startsWith('6a') ? s.slice(2) : s;
      let payloadHex = hex;
      const first = Number.parseInt(hex.slice(0, 2), 16);
      if (first <= 75) payloadHex = hex.slice(2);
      else if (first === 0x4c) payloadHex = hex.slice(4);
      s = new TextDecoder().decode(
        Uint8Array.from(payloadHex.match(/.{1,2}/g)!.map((b) => Number.parseInt(b, 16))),
      );
    } catch {
      return null;
    }
  }
  if (s.startsWith('OP_RETURN ')) s = s.slice('OP_RETURN '.length).trim();

  const parts = s.split(PIPE);
  if (parts.length !== 8 && parts.length !== 9) return null;
  const [marker, ver, id, i, f, t, p, ts, n] = parts;
  if (marker !== DOTC_MARKER) return null;
  if (ver !== String(DOTC_VERSION)) return null;
  if (!id || !i || !f || !t || p == null || ts == null) return null;
  if (parts.length === 9 && !n) return null;
  if (!PRICE_RE.test(p) || !TS_RE.test(ts)) return null;
  if (utf8Bytes(s) > DOTC_STRETCH_MAX_BYTES) return null;

  const deal: DotcDeal = {
    marker: DOTC_MARKER,
    version: DOTC_VERSION,
    id,
    inscriptionRef: i,
    from: f,
    to: t,
    price: Number.parseInt(p, 10),
    ts: Number.parseInt(ts, 10),
    note: parts.length === 9 ? n : undefined,
    priceUnit: 'doge',
    payload: s,
    byteLength: utf8Bytes(s),
    compacted: i.length < 66 || f.length < 26 || t.length < 26,
  };
  return deal;
}

export function validateDotcPayload(
  input: string | BuildDotcPayloadInput | DotcDeal,
): DotcValidation {
  const errors: string[] = [];
  let payload: string;
  if (typeof input === 'string') {
    payload = input.trim();
  } else if ('payload' in input && typeof input.payload === 'string') {
    payload = input.payload;
  } else {
    try {
      payload = buildDotcPayload(input);
    } catch (e) {
      return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
    }
  }

  const parsed = parseDotc(payload);
  if (!parsed) {
    errors.push('not a valid dotc|1|… envelope');
    return { ok: false, errors };
  }
  if (parsed.byteLength > DOTC_MAX_DATA_BYTES) {
    errors.push(`payload is ${parsed.byteLength} bytes (max ${DOTC_MAX_DATA_BYTES} for standard OP_RETURN)`);
  }
  if (!ID_RE.test(parsed.id) && !/^[0-9a-z]{6,16}$/i.test(parsed.id)) {
    errors.push('id is empty or malformed');
  }
  if (parsed.note && parsed.note.length > DOTC_NOTE_MAX_CHARS) {
    errors.push(`note exceeds ${DOTC_NOTE_MAX_CHARS} chars`);
  }
  if (parsed.version !== DOTC_VERSION) {
    errors.push(`unsupported version ${parsed.version}`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, deal: parsed };
}

export function dogeToKoinu(priceDoge: number): number {
  if (!Number.isInteger(priceDoge) || priceDoge < 0) {
    throw new Error('price must be a non-negative integer DOGE');
  }
  return priceDoge * 100_000_000;
}

export function planDotcPsbtOutputs(opts: {
  payload: string;
  buyerAddress: string;
  sellerAddress: string;
  inscriptionValueKoinu: number;
  priceDoge: number;
  tipAddress?: string;
  tipKoinu?: number;
}): DotcPsbtPlan {
  const v = validateDotcPayload(opts.payload);
  if (!v.ok) throw new Error(v.errors.join('; '));
  const priceKoinu = dogeToKoinu(opts.priceDoge);
  const outputs: DotcPsbtPlan['outputs'] = [
    {
      role: 'inscription_to_buyer',
      address: opts.buyerAddress,
      valueKoinu: opts.inscriptionValueKoinu,
    },
    {
      role: 'payment_to_seller',
      address: opts.sellerAddress,
      valueKoinu: priceKoinu,
    },
    {
      role: 'op_return_dotc',
      valueKoinu: 0,
      opReturn: v.deal.payload,
    },
  ];
  if (opts.tipAddress && opts.tipKoinu && opts.tipKoinu > 0) {
    outputs.push({
      role: 'optional_tip',
      address: opts.tipAddress,
      valueKoinu: opts.tipKoinu,
    });
  }
  return {
    inscriptionOutpoint: v.deal.inscriptionRef,
    buyerAddress: opts.buyerAddress,
    sellerAddress: opts.sellerAddress,
    priceKoinu,
    payload: v.deal.payload,
    tipAddress: opts.tipAddress,
    tipKoinu: opts.tipKoinu,
    outputs,
  };
}

export function buildDotcOpReturnScript(payload: string): Uint8Array {
  const v = validateDotcPayload(payload);
  if (!v.ok) throw new Error(v.errors.join('; '));
  const data = new TextEncoder().encode(v.deal.payload);
  if (data.length > DOTC_MAX_DATA_BYTES) {
    throw new Error(`OP_RETURN payload too large: ${data.length} bytes`);
  }
  const head = data.length <= 75 ? Uint8Array.of(0x6a, data.length) : Uint8Array.of(0x6a, 0x4c, data.length);
  const out = new Uint8Array(head.length + data.length);
  out.set(head, 0);
  out.set(data, head.length);
  return out;
}

/** Plain-language copy both parties must see before signing. */
export const DOTC_CONFIRMATION_COPY = {
  title: 'On-chain deal receipt',
  lead:
    'This transaction writes a public DOTC receipt on Dogecoin in the same transfer that moves the inscription. Anyone with an explorer can read it. There is no marketplace fee.',
  checkPayload: 'Confirm this exact OP_RETURN string before you sign:',
  afterBroadcast: 'After broadcast, open the explorer link and check that the OP_RETURN parses as DOTC v1.',
  noBrand: 'The receipt is a generic OTC record — it does not name any app or venue.',
} as const;

export function formatDotcConfirmation(deal: DotcDeal | string): {
  title: string;
  lead: string;
  lines: string[];
  payload: string;
  footer: string;
} {
  const parsed = typeof deal === 'string' ? parseDotc(deal) : deal;
  if (!parsed) {
    throw new Error('Cannot format confirmation for an invalid DOTC payload');
  }
  const lines = [
    `Deal id: ${parsed.id}`,
    `Inscription: ${parsed.inscriptionRef}`,
    `Seller (from): ${parsed.from}`,
    `Buyer (to): ${parsed.to}`,
    `Price: ${parsed.price} DOGE`,
    `Time: ${parsed.ts} (unix)`,
  ];
  if (parsed.note) lines.push(`Note: ${parsed.note}`);
  lines.push(`OP_RETURN bytes: ${parsed.byteLength} / ${DOTC_MAX_DATA_BYTES}`);
  return {
    title: DOTC_CONFIRMATION_COPY.title,
    lead: DOTC_CONFIRMATION_COPY.lead,
    lines,
    payload: parsed.payload,
    footer: `${DOTC_CONFIRMATION_COPY.checkPayload}\n${parsed.payload}\n\n${DOTC_CONFIRMATION_COPY.afterBroadcast} ${DOTC_CONFIRMATION_COPY.noBrand}`,
  };
}

/** Realistic v1 examples (compact form — what actually fits in 80 bytes). */
export const DOTC_EXAMPLE_INPUTS: BuildDotcPayloadInput[] = [
  {
    id: '260814a3f9',
    inscriptionRef: 'a2950ec5c4d8e1f0a1b2c3d4e5f6071890abcdef1234567890abcdeff1904f:0',
    from: 'DLScxKmcQv9p2nR4sT6uW8xY0zA1b2c3zd8',
    to: 'DStKUAm3Hq7jK9mN1pQr5tVw8xYz2A3Mbs',
    price: 33250,
    ts: 1723573015,
  },
  {
    id: '260814a3f9',
    inscriptionRef: 'a2950ec5c4d8e1f0a1b2c3d4e5f6071890abcdef1234567890abcdeff1904f:0',
    from: 'DLScxKmcQv9p2nR4sT6uW8xY0zA1b2c3zd8',
    to: 'DStKUAm3Hq7jK9mN1pQr5tVw8xYz2A3Mbs',
    price: 33250,
    ts: 1723573015,
    note: 'webcam',
  },
  {
    id: '260814b7c2',
    inscriptionRef: 'c0ffee12ab89cd34ef56017890aabbccddeeff00112233445566778899aa01i0',
    from: 'DBxYkLmnPq3RsTuVwXyZ0123456789abcd',
    to: 'DQaRstuVwx9YzAbCdEfGhIjKlMnOpQrSt',
    price: 420,
    ts: 1755201000,
  },
];

export function buildDotcExamples(): { payload: string; bytes: number; note?: string }[] {
  return DOTC_EXAMPLE_INPUTS.map((input) => {
    const payload = buildDotcPayload(input);
    return { payload, bytes: utf8Bytes(payload), note: input.note };
  });
}
