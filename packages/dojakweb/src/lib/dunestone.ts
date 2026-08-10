/**
 * Dunestone encoder for Dogecoin Ðunes.
 *
 * **v1:** OP_RETURN + OP_PUSHNUM_13 (0x5d) — wonky / Runes parity
 * **v2:** OP_RETURN + push 0xD0 (Ð) + push version 0x02 — Dogenals-native
 *
 * Tags/varints must match dogex or the tx becomes a cenotaph.
 * Spec: dogenals/spec/protocols/dunes/{spec.md,V2.md}
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
/** Dunes v2 / Ðunes tags (even = must-understand when present). */
const TAG_VERSION      = 24n;
const TAG_AGENT        = 26n;
const TAG_POOL         = 28n;
const TAG_MIN_OUT      = 30n;
const TAG_BURN_TO_MINT = 32n;
const TAG_PARENT       = 34n;
const TAG_SOUL         = 36n;
const TAG_FAST_MINT    = 38n;
const TAG_CONTRACT     = 40n;
const TAG_LAUNCH_CURVE_OP                = 46n;
const TAG_LAUNCH_CURVE_TARGET            = 48n;
const TAG_LAUNCH_CURVE_MAX_SUPPLY        = 50n;
const TAG_LAUNCH_CURVE_TYPE              = 52n;
const TAG_LAUNCH_CURVE_BASE_PRICE        = 54n;
const TAG_LAUNCH_CURVE_SLOPE             = 56n;
const TAG_LAUNCH_CURVE_GRADUATION_SUPPLY = 58n;
const TAG_LAUNCH_CURVE_CREATOR_FEE_BPS   = 60n;
const TAG_LAUNCH_CURVE_OUTPUT            = 62n;
const TAG_LAUNCH_CURVE_MIN_TOKENS_OUT    = 64n;
const TAG_LAUNCH_CURVE_MIN_DOGE_OUT      = 66n;
const TAG_LAUNCH_CURVE_METADATA          = 68n;
const TAG_LAUNCH_CURVE_CREATOR_OUTPUT    = 70n;
const TAG_LAUNCH_CURVE_TREASURY_OUTPUT   = 72n;
const TAG_LAUNCH_CURVE_DOGE_IN           = 74n;
const TAG_LAUNCH_CURVE_TOKEN_AMOUNT      = 76n;

// ── Flag bitmask constants ────────────────────────────────────────────────────
const FLAG_ETCHING = 1n;  // bit 0
const FLAG_TERMS   = 2n;  // bit 1
const FLAG_TURBO   = 4n;  // bit 2

// ── Script opcodes ────────────────────────────────────────────────────────────
const OP_RETURN      = 0x6a;
const OP_PUSHNUM_13  = 0x5d; // v1 magic (Runes parity)
/** Dunes v2 / Ðunes magic — 0xD0 is fucking cool. */
export const DUNE_V2_MAGIC = 0xd0;
export const DUNE_V2_VERSION = 0x02;
const OP_PUSHDATA1   = 0x4c;
const OP_PUSHDATA2   = 0x4d;

export type DunestoneMagic = 'v1' | 'v2';

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

function appendDuneIdTag(tag: bigint, id: { block: bigint; tx: bigint }, payload: number[]): void {
  appendTagValue(tag, id.block, payload);
  appendTagValue(tag, id.tx, payload);
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

export type LaunchCurveOp = 'launch' | 'buy' | 'sell' | 'graduate';

export interface DuneLaunchCurve {
  op: LaunchCurveOp;
  /** Target DuneId for buy/sell/graduate. Launch omits this because the etch tx defines it. */
  target?: { block: bigint; tx: bigint };
  /** Total launch supply reserved to real curve inventory on launch. */
  maxSupply?: bigint;
  /** 1=linear, 2=exponential, 3=sigmoid. */
  curveType?: bigint;
  /** Base price in koinu. */
  basePrice?: bigint;
  /** Curve slope/coefficient. */
  slope?: bigint;
  /** Bought supply threshold that closes the bonding venue. */
  graduationSupply?: bigint;
  /** Creator share of each buy, in basis points. */
  creatorFeeBps?: bigint;
  /** Buyer output for buy; seller DOGE payout hint for sell; pool hint for graduate. */
  output?: number;
  /** Buy slippage guard. */
  minTokensOut?: bigint;
  /** Sell slippage guard. */
  minDogeOut?: bigint;
  /** Optional compact metadata pointer/hash. */
  metadata?: bigint;
  /** Launch creator DOGE fee output. */
  creatorOutput?: number;
  /** Launch treasury/inventory output; sell return output. */
  treasuryOutput?: number;
  /** DOGE paid into a buy, in koinu. */
  dogeIn?: bigint;
  /** Tokens sold back to the curve. */
  tokenAmount?: bigint;
}

export interface DunestoneParams {
  etching?: DunestoneEtching;
  /** DuneId to mint (encode block and tx separately under Tag::Mint). */
  mint?: { block: bigint; tx: bigint };
  /** Default output index for unassigned dune balances. */
  pointer?: number;
  /** Transfer edicts (required for send operations). */
  edicts?: DuneEdict[];
  /** Default **v2** (0xD0) for new etches; use v1 for wonky-era compatibility. */
  magic?: DunestoneMagic;
  /** v2 protocol version byte (default 0x02). */
  protocolVersion?: number;
  /** v2: agent mode crumb */
  agent?: bigint;
  /** v2: pool intent crumb */
  pool?: bigint;
  /** v2: min output (slippage) */
  minOut?: bigint;
  /** v2: burn-to-mint koinu */
  burnToMint?: bigint;
  /** v2: parent dune id */
  parent?: { block: bigint; tx: bigint };
  /** v2: soulbound hint */
  soul?: boolean;
  /** v2: fast-mint offset blocks */
  fastMint?: bigint;
  /** v2: lightweight contract class */
  contract?: bigint;
  /** v2: native Dunes launch-curve operation. */
  launchCurve?: DuneLaunchCurve;
}

// ── Script push helpers ───────────────────────────────────────────────────────

function scriptPushSlice(data: number[]): number[] {
  const len = data.length;
  if (len === 0) return [];
  if (len <= 75) return [len, ...data];
  if (len <= 255) return [OP_PUSHDATA1, len, ...data];
  return [OP_PUSHDATA2, len & 0xff, (len >> 8) & 0xff, ...data];
}

function launchCurveOpToWire(op: LaunchCurveOp): bigint {
  switch (op) {
    case 'launch':
      return 1n;
    case 'buy':
      return 2n;
    case 'sell':
      return 3n;
    case 'graduate':
      return 4n;
  }
}

// ── Main encoder ──────────────────────────────────────────────────────────────

/**
 * Encode a dunestone into an OP_RETURN locking script (value = 0).
 *
 * - **v1:** `OP_RETURN OP_PUSHNUM_13 [payload]`
 * - **v2:** `OP_RETURN push(0xD0) push(version) [payload]`
 */
export function encodeDunestone(params: DunestoneParams): Uint8Array {
  const payload: number[] = [];
  const magic: DunestoneMagic = params.magic ?? 'v2';
  const protocolVersion = params.protocolVersion ?? DUNE_V2_VERSION;

  if (magic === 'v2') {
    appendTagValue(TAG_VERSION, BigInt(protocolVersion), payload);
  }

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
  if (params.mint) {
    appendTagValue(TAG_MINT, params.mint.block, payload);
    appendTagValue(TAG_MINT, params.mint.tx,    payload);
  }

  // ── Pointer ───────────────────────────────────────────────────────────────
  if (params.pointer !== undefined) {
    appendTagValue(TAG_POINTER, BigInt(params.pointer), payload);
  }

  // ── v2 extensions (safe optional construction) ────────────────────────────
  if (magic === 'v2') {
    appendTagValueOpt(TAG_AGENT, params.agent, payload);
    appendTagValueOpt(TAG_POOL, params.pool, payload);
    appendTagValueOpt(TAG_MIN_OUT, params.minOut, payload);
    appendTagValueOpt(TAG_BURN_TO_MINT, params.burnToMint, payload);
    if (params.parent) {
      appendTagValue(TAG_PARENT, params.parent.block, payload);
      appendTagValue(TAG_PARENT, params.parent.tx, payload);
    }
    if (params.soul) appendTagValue(TAG_SOUL, 1n, payload);
    appendTagValueOpt(TAG_FAST_MINT, params.fastMint, payload);
    appendTagValueOpt(TAG_CONTRACT, params.contract, payload);

    if (params.launchCurve) {
      const lc = params.launchCurve;
      appendTagValue(TAG_LAUNCH_CURVE_OP, launchCurveOpToWire(lc.op), payload);
      if (lc.target) appendDuneIdTag(TAG_LAUNCH_CURVE_TARGET, lc.target, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_MAX_SUPPLY, lc.maxSupply, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_TYPE, lc.curveType, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_BASE_PRICE, lc.basePrice, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_SLOPE, lc.slope, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_GRADUATION_SUPPLY, lc.graduationSupply, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_CREATOR_FEE_BPS, lc.creatorFeeBps, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_OUTPUT, lc.output !== undefined ? BigInt(lc.output) : undefined, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_MIN_TOKENS_OUT, lc.minTokensOut, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_MIN_DOGE_OUT, lc.minDogeOut, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_METADATA, lc.metadata, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_CREATOR_OUTPUT, lc.creatorOutput !== undefined ? BigInt(lc.creatorOutput) : undefined, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_TREASURY_OUTPUT, lc.treasuryOutput !== undefined ? BigInt(lc.treasuryOutput) : undefined, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_DOGE_IN, lc.dogeIn, payload);
      appendTagValueOpt(TAG_LAUNCH_CURVE_TOKEN_AMOUNT, lc.tokenAmount, payload);
    }
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
  const script: number[] = [OP_RETURN];
  if (magic === 'v2') {
    // OP_RETURN <push 0xD0> <push version> [payload]
    script.push(...scriptPushSlice([DUNE_V2_MAGIC]));
    script.push(...scriptPushSlice([protocolVersion & 0xff]));
  } else {
    script.push(OP_PUSHNUM_13);
  }
  if (payload.length > 0) {
    script.push(...scriptPushSlice(payload));
  }

  return new Uint8Array(script);
}

// ── Convenience constructors ──────────────────────────────────────────────────

/**
 * Build the OP_RETURN script for an etch (deploy) transaction.
 *
 * Premine and open-mint terms are **independent** and may both be set:
 * - `premineUnits` → amount allocated to the etcher (edict to output 1)
 * - `terms` → open mint (anyone can mint until cap × amount)
 * Max supply ≈ premine + amount × cap when both are set.
 *
 * @param name         Dune name with optional spacers, e.g. "DOGE•COIN"
 * @param premineUnits Premine in smallest units (0 = no premine)
 * @param divisibility Decimal places (0-38)
 * @param symbol       Optional single-char symbol
 * @param terms        Optional open-mint terms
 * @param turbo        Enable turbo flag
 */
export function buildEtchScript(
  name: string,
  premineUnits: bigint,
  divisibility: number,
  symbol?: string,
  terms?: DuneTerms,
  turbo = false,
): Uint8Array {
  const { dune, spacers } = parseSpacedDune(name);
  const premine = premineUnits > 0n ? premineUnits : undefined;

  return encodeDunestone({
    magic: 'v2',
    etching: {
      dune,
      spacers: spacers > 0n ? spacers : undefined,
      divisibility,
      symbol,
      premine,
      turbo,
      terms,
    },
    // Self-ref edict (0:0) assigns premine to output 1 (postage dust to etcher)
    edicts: premineUnits > 0n
      ? [{ id: { block: 0n, tx: 0n }, amount: premineUnits, output: 1 }]
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
 * @param pointer  Output that receives unallocated Ðunes (change). Required for
 *                 partial sends — without it, remainder defaults to the first
 *                 non-OP_RETURN (the recipient) and over-sends.
 */
export function buildSendScript(
  duneId: string,
  amount: bigint,
  output = 1,
  pointer?: number,
): Uint8Array {
  const { block, tx } = parseDuneId(duneId);
  return encodeDunestone({
    ...(pointer !== undefined ? { pointer } : {}),
    edicts: [{ id: { block, tx }, amount, output }],
  });
}

export interface LaunchCurveEtchScriptParams {
  name: string;
  maxSupply: bigint;
  basePrice: bigint;
  creatorOutput: number;
  treasuryOutput: number;
  divisibility?: number;
  symbol?: string;
  curveType?: bigint;
  slope?: bigint;
  graduationSupply?: bigint;
  creatorFeeBps?: bigint;
  metadata?: bigint;
  inventoryOutput?: number;
}

export function buildLaunchCurveEtchScript(params: LaunchCurveEtchScriptParams): Uint8Array {
  if (params.maxSupply <= 0n) throw new Error('maxSupply must be positive');
  const { dune, spacers } = parseSpacedDune(params.name);
  const inventoryOutput = params.inventoryOutput ?? params.treasuryOutput;

  return encodeDunestone({
    magic: 'v2',
    pointer: inventoryOutput,
    etching: {
      dune,
      spacers: spacers > 0n ? spacers : undefined,
      divisibility: params.divisibility ?? 0,
      symbol: params.symbol ?? '\u00d0',
      premine: params.maxSupply,
      turbo: true,
    },
    launchCurve: {
      op: 'launch',
      maxSupply: params.maxSupply,
      curveType: params.curveType ?? 1n,
      basePrice: params.basePrice,
      slope: params.slope ?? 0n,
      graduationSupply: params.graduationSupply ?? params.maxSupply,
      creatorFeeBps: params.creatorFeeBps ?? 100n,
      metadata: params.metadata,
      creatorOutput: params.creatorOutput,
      treasuryOutput: params.treasuryOutput,
    },
    edicts: [{ id: { block: 0n, tx: 0n }, amount: params.maxSupply, output: inventoryOutput }],
  });
}

export interface LaunchCurveBuyScriptParams {
  duneId: string;
  dogeIn: bigint;
  tokensOut: bigint;
  buyerOutput?: number;
  /** Output that receives unallocated curve inventory after the buyer edict. */
  treasuryOutput?: number;
  minTokensOut?: bigint;
}

export function buildLaunchCurveBuyScript(params: LaunchCurveBuyScriptParams): Uint8Array {
  if (params.dogeIn <= 0n) throw new Error('dogeIn must be positive');
  if (params.tokensOut <= 0n) throw new Error('tokensOut must be positive');
  const target = parseDuneId(params.duneId);
  const buyerOutput = params.buyerOutput ?? 1;
  const treasuryOutput = params.treasuryOutput ?? 3;

  return encodeDunestone({
    magic: 'v2',
    pointer: treasuryOutput,
    launchCurve: {
      op: 'buy',
      target,
      output: buyerOutput,
      dogeIn: params.dogeIn,
      minTokensOut: params.minTokensOut ?? params.tokensOut,
      treasuryOutput,
    },
    edicts: [{ id: target, amount: params.tokensOut, output: buyerOutput }],
  });
}

export interface LaunchCurveSellScriptParams {
  duneId: string;
  tokenAmount: bigint;
  treasuryOutput: number;
  sellerOutput?: number;
  minDogeOut?: bigint;
}

export function buildLaunchCurveSellScript(params: LaunchCurveSellScriptParams): Uint8Array {
  if (params.tokenAmount <= 0n) throw new Error('tokenAmount must be positive');
  const target = parseDuneId(params.duneId);

  return encodeDunestone({
    magic: 'v2',
    launchCurve: {
      op: 'sell',
      target,
      output: params.sellerOutput ?? 1,
      tokenAmount: params.tokenAmount,
      minDogeOut: params.minDogeOut,
      treasuryOutput: params.treasuryOutput,
    },
    edicts: [{ id: target, amount: params.tokenAmount, output: params.treasuryOutput }],
  });
}

export interface LaunchCurveGraduateScriptParams {
  duneId: string;
  poolOutput?: number;
  poolTokenAmount?: bigint;
}

export function buildLaunchCurveGraduateScript(params: LaunchCurveGraduateScriptParams): Uint8Array {
  const target = parseDuneId(params.duneId);
  const edicts = params.poolOutput !== undefined && params.poolTokenAmount !== undefined
    ? [{ id: target, amount: params.poolTokenAmount, output: params.poolOutput }]
    : undefined;

  return encodeDunestone({
    magic: 'v2',
    launchCurve: {
      op: 'graduate',
      target,
      output: params.poolOutput,
    },
    edicts,
  });
}
