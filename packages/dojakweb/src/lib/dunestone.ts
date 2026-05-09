/**
 * Dunestone encoder for the Dogecoin Dunes protocol.
 * Produces OP_RETURN scripts that index nodes interpret as dune operations.
 *
 * Protocol spec derived from the dog/wonky-dogeord Rust implementations.
 * Tags, flags, and varint encoding must match exactly or the transaction
 * becomes a cenotaph (burned/invalid).
 */

// ── Tag constants (even = must-understand; odd = ignored-if-unknown) ─────────
const TAG_BODY         = 0n;
const TAG_FLAGS        = 2n;
const TAG_DUNE         = 4n;
const TAG_PREMINE      = 6n;
const TAG_CAP          = 8n;
const TAG_AMOUNT       = 10n;
const TAG_HEIGHT_START = 12n;
const TAG_HEIGHT_END   = 14n;
const TAG_OFFSET_START = 16n;
const TAG_OFFSET_END   = 18n;
const TAG_MINT         = 20n;
const TAG_POINTER      = 22n;
const TAG_DIVISIBILITY = 1n;
const TAG_SPACERS      = 3n;
const TAG_SYMBOL       = 5n;

// ── Flag bitmask constants ────────────────────────────────────────────────────
const FLAG_ETCHING = 1n;  // bit 0
const FLAG_TERMS   = 2n;  // bit 1
const FLAG_TURBO   = 4n;  // bit 2

// ── Script opcodes ────────────────────────────────────────────────────────────
const OP_RETURN      = 0x6a;
const OP_PUSHNUM_13  = 0x5d; // magic number identifying a dunestone
const OP_PUSHDATA1   = 0x4c;
const OP_PUSHDATA2   = 0x4d;

// ── LEB128 varint encoding for u128 values ────────────────────────────────────

function encodeVarint(n: bigint): number[] {
  if (n < 0n) throw new Error('varint must be non-negative');
  const bytes: number[] = [];
  do {
    let byte = Number(n & 0x7fn);
    n >>= 7n;
    if (n > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (n > 0n);
  return bytes;
}

function appendTagValue(tag: bigint, value: bigint, payload: number[]): void {
  payload.push(...encodeVarint(tag));
  payload.push(...encodeVarint(value));
}

function appendTagValueOpt(tag: bigint, value: bigint | undefined, payload: number[]): void {
  if (value !== undefined) appendTagValue(tag, value, payload);
}

// ── Dune name codec ───────────────────────────────────────────────────────────

/**
 * Convert an uppercase A-Z dune name (no spacers) to its u128 integer.
 * Encoding: positional base-26 with subtract-1-then-multiply-26 for non-last chars.
 */
export function duneNameToNumber(name: string): bigint {
  let n = 0n;
  for (let i = 0; i < name.length; i++) {
    if (i > 0) {
      n += 1n;
      n *= 26n;
    }
    const code = name.charCodeAt(i);
    if (code < 65 || code > 90) {
      throw new Error(`Invalid character '${name[i]}' in dune name — must be A-Z`);
    }
    n += BigInt(code - 65);
  }
  return n;
}

/**
 * Convert a u128 dune integer back to an uppercase A-Z string.
 */
export function duneNumberToLetters(n: bigint): string {
  let remaining = n;
  let letters = '';
  while (remaining > 25n) {
    letters = String.fromCharCode(65 + Number(remaining % 26n)) + letters;
    remaining = remaining / 26n - 1n;
  }
  return String.fromCharCode(65 + Number(remaining)) + letters;
}

/**
 * Parse a spaced dune name like "DOGE•COIN" or "DOGE.COIN" into its
 * integer representation and spacer bitmask.
 */
export function parseSpacedDune(name: string): { dune: bigint; spacers: bigint } {
  let spacers = 0n;
  let letterIndex = 0;
  let duneChars = '';

  for (const c of name) {
    if (c === '.' || c === '•') {
      if (letterIndex === 0) throw new Error('Spacer cannot be at the start of the dune name');
      spacers |= (1n << BigInt(letterIndex - 1));
    } else {
      const upper = c.toUpperCase();
      const code = upper.charCodeAt(0);
      if (code < 65 || code > 90) throw new Error(`Invalid character '${c}' in dune name`);
      duneChars += upper;
      letterIndex++;
    }
  }

  if (!duneChars) throw new Error('Dune name cannot be empty');
  return { dune: duneNameToNumber(duneChars), spacers };
}

/**
 * Render a dune integer + spacer bitmask as a human-readable spaced name.
 */
export function renderSpacedDune(dune: bigint, spacers = 0n): string {
  const letters = duneNumberToLetters(dune);
  if (spacers === 0n) return letters;
  let result = '';
  for (let i = 0; i < letters.length; i++) {
    result += letters[i];
    if (i < letters.length - 1 && ((spacers >> BigInt(i)) & 1n)) {
      result += '•';
    }
  }
  return result;
}

/**
 * Parse a dune ID from "block:tx" format.
 */
export function parseDuneId(id: string): { block: bigint; tx: bigint } {
  const parts = id.split(':');
  if (parts.length !== 2) throw new Error(`Invalid dune ID format "${id}" — expected "block:tx"`);
  return { block: BigInt(parts[0]), tx: BigInt(parts[1]) };
}

// ── Public parameter types ────────────────────────────────────────────────────

export interface DuneTerms {
  /** Tokens issued per mint call. */
  amount?: bigint;
  /** Maximum number of mints allowed. */
  cap?: bigint;
  /** Absolute block-height window for minting. */
  heightStart?: bigint;
  heightEnd?: bigint;
  /** Relative block-offset from the etching block for minting. */
  offsetStart?: bigint;
  offsetEnd?: bigint;
}

export interface DunestoneEtching {
  /** u128 integer representation of the dune name (from duneNameToNumber). */
  dune: bigint;
  /** Spacer bitmask (from parseSpacedDune). */
  spacers?: bigint;
  /** Decimal places, 0-38. */
  divisibility?: number;
  /** Single Unicode symbol character. */
  symbol?: string;
  /** Pre-mined amount in smallest units. */
  premine?: bigint;
  /** Enable experimental Turbo flag. */
  turbo?: boolean;
  /** Optional open-mint terms; makes the dune mintable by others. */
  terms?: DuneTerms;
}

export interface DuneEdict {
  id: { block: bigint; tx: bigint };
  amount: bigint;
  output: number;
}

export interface DunestoneParams {
  etching?: DunestoneEtching;
  /** DuneId to mint (encode block and tx separately under Tag::Mint). */
  mint?: { block: bigint; tx: bigint };
  /** Default output index for unassigned dune balances. */
  pointer?: number;
  /** Transfer edicts (required for send operations). */
  edicts?: DuneEdict[];
}

// ── Script push helpers ───────────────────────────────────────────────────────

function scriptPushSlice(data: number[]): number[] {
  const len = data.length;
  if (len === 0) return [];
  if (len <= 75) return [len, ...data];
  if (len <= 255) return [OP_PUSHDATA1, len, ...data];
  return [OP_PUSHDATA2, len & 0xff, (len >> 8) & 0xff, ...data];
}

// ── Main encoder ──────────────────────────────────────────────────────────────

/**
 * Encode a dunestone into an OP_RETURN locking script.
 *
 * The returned bytes can be used directly as a transaction output's scriptPubKey
 * with value = 0 satoshis.
 *
 * Structure: OP_RETURN OP_PUSHNUM_13 push(payload)
 */
export function encodeDunestone(params: DunestoneParams): Uint8Array {
  const payload: number[] = [];

  // ── Etching fields ────────────────────────────────────────────────────────
  if (params.etching) {
    const e = params.etching;

    let flags = FLAG_ETCHING;
    if (e.terms) flags |= FLAG_TERMS;
    if (e.turbo) flags |= FLAG_TURBO;

    appendTagValue(TAG_FLAGS, flags, payload);
    appendTagValue(TAG_DUNE, e.dune, payload);
    appendTagValueOpt(TAG_DIVISIBILITY, e.divisibility !== undefined ? BigInt(e.divisibility) : undefined, payload);
    appendTagValueOpt(TAG_SPACERS, e.spacers, payload);

    if (e.symbol) {
      const cp = e.symbol.codePointAt(0);
      if (cp !== undefined) appendTagValue(TAG_SYMBOL, BigInt(cp), payload);
    }

    appendTagValueOpt(TAG_PREMINE, e.premine, payload);

    if (e.terms) {
      appendTagValueOpt(TAG_AMOUNT,        e.terms.amount,      payload);
      appendTagValueOpt(TAG_CAP,           e.terms.cap,         payload);
      appendTagValueOpt(TAG_HEIGHT_START,  e.terms.heightStart, payload);
      appendTagValueOpt(TAG_HEIGHT_END,    e.terms.heightEnd,   payload);
      appendTagValueOpt(TAG_OFFSET_START,  e.terms.offsetStart, payload);
      appendTagValueOpt(TAG_OFFSET_END,    e.terms.offsetEnd,   payload);
    }
  }

  // ── Mint ──────────────────────────────────────────────────────────────────
  // Encoded as two consecutive Tag::Mint entries: one for block, one for tx
  if (params.mint) {
    appendTagValue(TAG_MINT, params.mint.block, payload);
    appendTagValue(TAG_MINT, params.mint.tx,    payload);
  }

  // ── Pointer ───────────────────────────────────────────────────────────────
  if (params.pointer !== undefined) {
    appendTagValue(TAG_POINTER, BigInt(params.pointer), payload);
  }

  // ── Edicts ────────────────────────────────────────────────────────────────
  if (params.edicts && params.edicts.length > 0) {
    const sorted = [...params.edicts].sort((a, b) => {
      if (a.id.block !== b.id.block) return a.id.block < b.id.block ? -1 : 1;
      return a.id.tx < b.id.tx ? -1 : 1;
    });

    payload.push(...encodeVarint(TAG_BODY));

    let prevBlock = 0n;
    let prevTx    = 0n;

    for (const edict of sorted) {
      const blockDelta = edict.id.block - prevBlock;
      // tx delta: if same block, relative; otherwise absolute
      const txDelta = edict.id.block === prevBlock
        ? edict.id.tx - prevTx
        : edict.id.tx;

      payload.push(...encodeVarint(blockDelta));
      payload.push(...encodeVarint(txDelta));
      payload.push(...encodeVarint(edict.amount));
      payload.push(...encodeVarint(BigInt(edict.output)));

      prevBlock = edict.id.block;
      prevTx    = edict.id.tx;
    }
  }

  // ── Assemble script ───────────────────────────────────────────────────────
  // OP_RETURN OP_PUSHNUM_13 [push_slice(payload)]
  const script: number[] = [OP_RETURN, OP_PUSHNUM_13];
  if (payload.length > 0) {
    script.push(...scriptPushSlice(payload));
  }

  return new Uint8Array(script);
}

// ── Convenience constructors ──────────────────────────────────────────────────

/**
 * Build the OP_RETURN script for an etch (deploy) transaction.
 *
 * @param name         Dune name with optional spacers, e.g. "DOGE•COIN"
 * @param supply       Total supply in smallest units (premine = supply when no terms)
 * @param divisibility Decimal places (0-38)
 * @param symbol       Optional single-char symbol
 * @param terms        Optional open-mint terms (makes the dune mintable)
 * @param turbo        Enable turbo flag
 */
export function buildEtchScript(
  name: string,
  supply: bigint,
  divisibility: number,
  symbol?: string,
  terms?: DuneTerms,
  turbo = false,
): Uint8Array {
  const { dune, spacers } = parseSpacedDune(name);

  // If there are open-mint terms the supply is cap * amount + premine.
  // The premine edict uses id {0,0} (self-reference in etching tx, output 1).
  const premine = terms ? undefined : supply;

  return encodeDunestone({
    etching: {
      dune,
      spacers: spacers > 0n ? spacers : undefined,
      divisibility,
      symbol,
      premine,
      turbo,
      terms,
    },
    edicts: supply > 0n && !terms
      ? [{ id: { block: 0n, tx: 0n }, amount: supply, output: 1 }]
      : undefined,
  });
}

/**
 * Build the OP_RETURN script for a mint transaction.
 *
 * @param duneId Dune ID as "block:tx" string
 */
export function buildMintScript(duneId: string): Uint8Array {
  const { block, tx } = parseDuneId(duneId);
  return encodeDunestone({ mint: { block, tx } });
}

/**
 * Build the OP_RETURN script for a send (transfer) transaction.
 *
 * @param duneId   Dune ID as "block:tx" string
 * @param amount   Amount to send in smallest units
 * @param output   Output index of the recipient (typically 1)
 */
export function buildSendScript(duneId: string, amount: bigint, output = 1): Uint8Array {
  const { block, tx } = parseDuneId(duneId);
  return encodeDunestone({
    edicts: [{ id: { block, tx }, amount, output }],
  });
}
