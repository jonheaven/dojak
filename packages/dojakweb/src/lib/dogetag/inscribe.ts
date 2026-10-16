/**
 * inscribe.ts — Canonical Doginals P2SH commit-reveal for plain text.
 *
 * Produces exactly 2 transactions (commit + reveal) for text up to
 * INSCRIPTION_MAX_CONTENT_BYTES, matching the format wonky-ord and compatible
 * indexers parse from `vin[0].scriptSig` of the reveal transaction.
 *
 * Reference: ref/Dogecoin-Tools/scripts/doginals.js  `inscribe()` function.
 *
 * Envelope layout in the reveal scriptSig:
 *   [bufToChunk("ord")]
 *   [numToChunk(partsCount)]
 *   [bufToChunk(contentType)]
 *   for each part: [numToChunk(countdown)]  [bufToChunk(data)]
 *   [sig + SIGHASH_ALL]
 *   [lockScript]
 *
 * Lock (redeem) script per partial:
 *   <compressedPubkey>  OP_CHECKSIGVERIFY  OP_DROP×n  OP_1
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as secp from '@noble/secp256k1';
import { DogeMemoryWallet, createP2PKHTransaction, decodePrivateKeyFromWIF } from 'doge-sdk';
import { fetchSpendableUtxosConservativeForAddress, filterPaymentSpendableUtxos } from '../broadcast/dogecoinTxBroadcast';
import { enforceBroadcastFeeRateKoinuPerKb } from '../fees/dogecoinFeePolicy';
import { selectSmallestSufficient } from '../fees/selectSmallestSufficient';
import {
  HARD_DUST_KOINU,
  SOFT_DUST_KOINU,
  discardSoftDustChangeKoinu,
  softDustFeePenaltyKoinu,
} from '../dogecoin/softDust';
import { DOGE_NETWORK, legacyOutputVbytes, parseDogecoinReceiveAddress } from './dogecoinAddress';

// ── Protocol constants (matching doginals.js) ─────────────────────────────────

const MAX_CHUNK_LEN  = 240;   // max data bytes per inscription chunk
const MAX_PAYLOAD_LEN = 1500; // max scriptSig payload per partial

export const INSCRIPTION_CONTENT_TYPE = 'text/plain;charset=utf-8';

/**
 * Maximum UTF-8 bytes guaranteed to fit in ONE partial payload,
 * so the inscription always produces exactly 2 transactions.
 */
export const INSCRIPTION_MAX_CONTENT_BYTES = 1390;

/** Satoshi value forwarded to the inscription recipient after reveal (Doginals carrier). */
const INSCRIPTION_DEST_AMOUNT = HARD_DUST_KOINU; // 0.001 DOGE — soft-dust fee paid via reveal MIN_FEE / penalty

/**
 * Per-transaction minimum fee floor for inscriptions (commit + reveal planning).
 * Doginals P2SH traffic is relay-sensitive; Blockchair/Core often reject below ~0.02 DOGE on typical sizes.
 */
const MIN_FEE_SATS = 2_000_000; // 0.02 DOGE

/** Extra margin on commit fee only — doge-sdk tx can be larger than naive 148-byte/input estimates. */
const COMMIT_FEE_HEADROOM_NUM = 125;
const COMMIT_FEE_HEADROOM_DEN = 100;

/** Conservative signed P2PKH input size (scriptSig length varies with DER). */
const COMMIT_VBYTES_PER_P2PKH_INPUT = 182;

// ── Chunk helpers (exact equivalents of doginals.js helpers) ─────────────────

interface ScriptChunk {
  buf?: Buffer;
  opcodenum: number;
}

function bufToChunk(b: Buffer): ScriptChunk {
  const len = b.length;
  return {
    buf: len ? b : undefined,
    opcodenum: len <= 75 ? len : len <= 255 ? 0x4c : 0x4d,
  };
}

function numToChunk(n: number): ScriptChunk {
  return {
    buf:
      n <= 16     ? undefined
      : n < 128   ? Buffer.from([n])
      :               Buffer.from([n % 256, Math.floor(n / 256)]),
    opcodenum:
      n === 0    ? 0x00
      : n <= 16  ? 0x50 + n   // OP_1 … OP_16
      : n < 128  ? 0x01
      :              0x02,
  };
}

/** Serialise an array of ScriptChunks — equivalent of bitcore Script.toBuffer(). */
function chunksToBuffer(chunks: ScriptChunk[]): Buffer {
  const parts: Buffer[] = [];
  for (const c of chunks) {
    if (c.buf === undefined) {
      parts.push(Buffer.from([c.opcodenum]));
    } else if (c.opcodenum <= 75) {
      parts.push(Buffer.from([c.opcodenum]), c.buf);
    } else if (c.opcodenum === 0x4c) {
      parts.push(Buffer.from([0x4c, c.buf.length]), c.buf);
    } else {
      const lb = Buffer.alloc(2);
      lb.writeUInt16LE(c.buf.length, 0);
      parts.push(Buffer.from([0x4d]), lb, c.buf);
    }
  }
  return Buffer.concat(parts);
}

// ── Inscription chunk sequence ────────────────────────────────────────────────

function buildInscriptionChunks(content: Buffer, contentType: string): ScriptChunk[] {
  const parts: Buffer[] = [];
  let rem = content;
  while (rem.length > 0) {
    parts.push(rem.slice(0, MAX_CHUNK_LEN));
    rem = rem.slice(MAX_CHUNK_LEN);
  }

  const chunks: ScriptChunk[] = [];
  chunks.push(bufToChunk(Buffer.from('ord')));        // protocol marker
  chunks.push(numToChunk(parts.length));              // total part count
  chunks.push(bufToChunk(Buffer.from(contentType)));  // MIME type

  parts.forEach((part, i) => {
    chunks.push(numToChunk(parts.length - i - 1));    // countdown (descending)
    chunks.push(bufToChunk(part));                    // data chunk
  });

  return chunks;
}

/**
 * Ordinals-style tags for dogex: content-type=1, parent=3, metaprotocol=7, body after empty push.
 * Used when parents / metaprotocol are set (Ðclaims and similar).
 */
function buildTaggedInscriptionChunks(
  content: Buffer,
  contentType: string,
  opts?: { parents?: Buffer[]; delegates?: Buffer[]; metaprotocol?: string; metadata?: Buffer },
): ScriptChunk[] {
  const parts: Buffer[] = [];
  let rem = content;
  while (rem.length > 0) {
    parts.push(rem.slice(0, MAX_CHUNK_LEN));
    rem = rem.slice(MAX_CHUNK_LEN);
  }

  const chunks: ScriptChunk[] = [];
  chunks.push(bufToChunk(Buffer.from('ord')));
  // tag 1 content-type
  chunks.push(bufToChunk(Buffer.from([1])));
  chunks.push(bufToChunk(Buffer.from(contentType)));
  if (opts?.parents?.length) {
    for (const p of opts.parents) {
      chunks.push(bufToChunk(Buffer.from([3])));
      chunks.push(bufToChunk(p));
    }
  }
  if (opts?.delegates?.length) {
    for (const d of opts.delegates) {
      chunks.push(bufToChunk(Buffer.from([11])));
      chunks.push(bufToChunk(d));
    }
  }
  if (opts?.metadata?.length) {
    chunks.push(bufToChunk(Buffer.from([5])));
    chunks.push(bufToChunk(opts.metadata));
  }
  if (opts?.metaprotocol) {
    chunks.push(bufToChunk(Buffer.from([7])));
    chunks.push(bufToChunk(Buffer.from(opts.metaprotocol, 'utf8')));
  }
  // body separator — empty push (OP_0). Must remain a distinct stack item so dogex
  // can split metaprotocol (tag 7) from the JSON body.
  chunks.push({ buf: undefined, opcodenum: 0x00 });
  for (const part of parts) {
    chunks.push(bufToChunk(part));
  }
  return chunks;
}

/** 36-byte parent field: txid internal order + index BE (matches dogex InscriptionId::to_bytes). */
export function inscriptionIdToParentBytes(inscriptionId: string): Buffer {
  const s = inscriptionId.trim().toLowerCase();
  const i = s.lastIndexOf('i');
  if (i < 0) throw new Error(`Invalid inscription id: ${inscriptionId}`);
  const tx = s.slice(0, i);
  const idx = s.slice(i + 1);
  if (tx.length !== 64 || !/^[0-9a-f]+$/.test(tx)) {
    throw new Error(`Invalid inscription txid: ${inscriptionId}`);
  }
  const index = Number.parseInt(idx, 10);
  if (!Number.isFinite(index) || index < 0) {
    throw new Error(`Invalid inscription index: ${inscriptionId}`);
  }
  const txidInternal = Buffer.from(tx, 'hex').reverse();
  const indexBe = Buffer.alloc(4);
  indexBe.writeUInt32BE(index >>> 0, 0);
  return Buffer.concat([txidInternal, indexBe]);
}

/**
 * Pull one partial payload from the front of the queue, mirroring the
 * while-loop in doginals.js inscribe().
 */
function extractPartial(queue: ScriptChunk[], isFirst: boolean): ScriptChunk[] {
  const partial: ScriptChunk[] = [];

  if (isFirst && queue.length > 0) {
    partial.push(queue.shift()!); // 'ord' always starts the first partial
  }

  while (chunksToBuffer(partial).length <= MAX_PAYLOAD_LEN && queue.length > 0) {
    partial.push(queue.shift()!); // countdown
    partial.push(queue.shift()!); // data
  }

  // Back off one pair if we exceeded the limit
  if (chunksToBuffer(partial).length > MAX_PAYLOAD_LEN) {
    queue.unshift(partial.pop()!); // return data
    queue.unshift(partial.pop()!); // return countdown
  }

  return partial;
}

// ── P2SH script helpers ───────────────────────────────────────────────────────

/**
 * Lock (redeem) script for a given partial:
 *   <pubkey>  OP_CHECKSIGVERIFY  OP_DROP×n  OP_1
 *
 * n = partial.length (one drop per chunk on the stack).
 */
function buildLockScript(pubkey: Buffer, partial: ScriptChunk[]): Buffer {
  const items: (number | Buffer)[] = [
    pubkey,
    0xad,                                            // OP_CHECKSIGVERIFY
    ...Array<number>(partial.length).fill(0x75),    // OP_DROP × n
    0x51,                                            // OP_1 (OP_TRUE)
  ];
  return bitcoin.script.compile(items);
}

/** P2SH output scriptPubKey: OP_HASH160 <hash160(lock)> OP_EQUAL */
function buildP2shOutputScript(lockScript: Buffer): Buffer {
  return bitcoin.script.compile([
    bitcoin.opcodes.OP_HASH160,
    bitcoin.crypto.hash160(lockScript),
    bitcoin.opcodes.OP_EQUAL,
  ]);
}

// ── Fee helpers ───────────────────────────────────────────────────────────────

function feeFor(txBytes: number, feeRate: number): number {
  return Math.max(MIN_FEE_SATS, Math.ceil((txBytes * feeRate) / 1000));
}

/** Commit tx vbytes: P2SH + P2PKH change (2 outputs) — matches our usual 2-output commit. */
function estimateCommitTxVbytes(
  inputCount: number,
  p2shScriptPubKey: Buffer,
  changeScriptPubKey: Buffer,
): number {
  return (
    10 +
    inputCount * COMMIT_VBYTES_PER_P2PKH_INPUT +
    legacyOutputVbytes(p2shScriptPubKey) +
    legacyOutputVbytes(changeScriptPubKey)
  );
}

function commitFeeFromEstimate(estimatedVbytes: number, feeRate: number): number {
  const base = Math.max(MIN_FEE_SATS, Math.ceil((estimatedVbytes * feeRate) / 1000));
  return Math.ceil((base * COMMIT_FEE_HEADROOM_NUM) / COMMIT_FEE_HEADROOM_DEN);
}

function estimateRevealTxBytes(
  partial: ScriptChunk[],
  lockScript: Buffer,
  inscriptionScriptPubKey: Buffer,
  changeScriptPubKey: Buffer,
  /** Extra P2PKH (or similar 34-vB) outputs on the reveal — e.g. ÐLaunch creator payment. */
  extraOutputCount = 0,
): number {
  const partialLen = chunksToBuffer(partial).length;
  const sigLen = 73;
  const lockPushLen = lockScript.length <= 75
    ? 1 + lockScript.length
    : lockScript.length <= 255
      ? 2 + lockScript.length
      : 3 + lockScript.length;

  const scriptSigLen = partialLen + 1 + sigLen + lockPushLen;
  const scriptSigVarint = scriptSigLen < 0xfd ? 1 : 3;
  const inputBytes = 36 + scriptSigVarint + scriptSigLen + 4;
  // Standard P2PKH output ~34 vB (used as upper bound for extra payments).
  const extraOutBytes = Math.max(0, extraOutputCount) * 34;

  return (
    10 +
    inputBytes +
    legacyOutputVbytes(inscriptionScriptPubKey) +
    legacyOutputVbytes(changeScriptPubKey) +
    extraOutBytes
  );
}

/**
 * The P2SH output must hold enough for the reveal fee, inscription dust,
 * and optional same-tx payment outputs (ÐLaunch buy → creator).
 */
function computeP2shAmount(
  partial: ScriptChunk[],
  lockScript: Buffer,
  feeRate: number,
  inscriptionScriptPubKey: Buffer,
  changeScriptPubKey: Buffer,
  extraPaymentSatoshis = 0,
  extraOutputCount = 0,
  extraPaymentValues: number[] = [],
): number {
  const revealSize = estimateRevealTxBytes(
    partial,
    lockScript,
    inscriptionScriptPubKey,
    changeScriptPubKey,
    extraOutputCount,
  );
  const sizeFee = feeFor(revealSize, feeRate);
  // Carrier (0.001) + any soft-dust reveal payments require +0.01 Ð each on top of size fee.
  const soft = softDustFeePenaltyKoinu([INSCRIPTION_DEST_AMOUNT, ...extraPaymentValues]);
  const revealFeeFinal = Math.max(MIN_FEE_SATS, sizeFee + soft);
  return INSCRIPTION_DEST_AMOUNT + Math.max(0, extraPaymentSatoshis) + revealFeeFinal;
}

// ── Helpers exported to UI ────────────────────────────────────────────────────

/** Estimated total fees (commit + reveal) for display in the UI. */
export function estimateInscriptionFees(
  text: string,
  feeRate: number,
): { commitFee: number; revealFee: number; total: number; p2shAmount: number } {
  const contentBuf = Buffer.from(text, 'utf8');
  const contentType = INSCRIPTION_CONTENT_TYPE;
  const chunks = buildInscriptionChunks(contentBuf, contentType);
  const partial = extractPartial([...chunks], true);

  // Dummy pubkey (33 bytes) — lock-script length depends only on partial.length
  const dummyPubkey = Buffer.alloc(33, 0x02);
  const lock = buildLockScript(dummyPubkey, partial);

  const dummyP2pkh = bitcoin.payments.p2pkh({ hash: Buffer.alloc(20), network: DOGE_NETWORK }).output!;
  const revealFee = feeFor(estimateRevealTxBytes(partial, lock, dummyP2pkh, dummyP2pkh), feeRate);
  const dummyP2sh = buildP2shOutputScript(lock);
  const commitVb = estimateCommitTxVbytes(1, dummyP2sh, dummyP2pkh);
  const commitFee = commitFeeFromEstimate(commitVb, feeRate);
  const p2shAmount = INSCRIPTION_DEST_AMOUNT + revealFee;

  return { commitFee, revealFee, total: commitFee + revealFee, p2shAmount };
}

// ── UTXO fetching (shared with OP_RETURN path + short retries for indexer lag) ─

interface NormUtxo { tx_hash: string; tx_output_n: number; value: number }

async function fetchUtxosWithRetry(address: string): Promise<NormUtxo[]> {
  let last: NormUtxo[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await fetchSpendableUtxosConservativeForAddress(address);
      if (last.length > 0 || attempt === 2) return last;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  return last;
}

function filterExcluded(utxos: NormUtxo[], excluded?: string[]): NormUtxo[] {
  if (!excluded?.length) return utxos;
  const set = new Set(excluded.map((o) => o.trim().toLowerCase()));
  return utxos.filter((u) => !set.has(`${u.tx_hash.toLowerCase()}:${u.tx_output_n}`));
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RevealPaymentOutput {
  /** Dogecoin address that receives payment on the *reveal* (inscription) tx. */
  address: string;
  /** Amount in koinu (1 DOGE = 1e8). */
  satoshis: number;
}

export interface SignInscriptionParams {
  /** Plain text / JSON string to inscribe. Omit when `contentBytes` is set. */
  text?: string;
  /** Raw body bytes (PNG and other non-UTF-8 content). Wins over `text`. */
  contentBytes?: Buffer | Uint8Array;
  /** Sender's Dogecoin address (funds and change). */
  fromAddress: string;
  /** WIF private key from the local Dojakweb browser wallet. */
  privateKeyWIF: string;
  /** Fee rate in satoshis per kilobyte (default 1 000). */
  feeRate?: number;
  /** Outpoints to exclude from UTXO selection (format "txid:vout"). */
  excludedOutpoints?: string[];
  /** Recipient of the inscribed UTXO; defaults to `fromAddress`. */
  inscriptionReceiveAddress?: string;
  /**
   * MIME type for the inscription envelope (default text/plain;charset=utf-8).
   * Use `application/json` for ÐLaunch / protocol JSON.
   */
  contentType?: string;
  /**
   * Extra outputs on the reveal tx — paid from the P2SH reserve.
   * Spec-compliant path for ÐLaunch `buy`: same-tx payment to creator.
   */
  extraRevealPayments?: RevealPaymentOutput[];
  /**
   * UTF-8 nulldata on the reveal (value 0). Clipped to 80 bytes.
   * Dogecoin indexes the inscription from scriptSig only — this memo is not a second name.
   */
  opReturn?: string;
  /**
   * Parent inscription ids (`txid`i`vout`). When set, builds ordinals-style tag 3
   * fields so dogex records parent-child provenance (required for Ðclaims).
   */
  parents?: string[];
  /**
   * Delegate inscription ids (envelope tag 11). The copy renders as that
   * inscription and stays independently spendable.
   */
  delegates?: string[];
  /** Metaprotocol string (envelope tag 7), e.g. `dclaims`. */
  metaprotocol?: string;
  /** Optional metadata bytes (envelope tag 5). */
  metadata?: Buffer | Uint8Array;
}

export interface SignedInscriptionPair {
  /** Fully-signed commit tx hex — broadcast first. */
  commitTxHex: string;
  /** Fully-signed reveal tx hex — broadcast second. */
  revealTxHex: string;
  /** Commit txid (display / big-endian). */
  commitTxid: string;
  /** Reveal txid (display / big-endian). This is the inscription's txid. */
  revealTxid: string;
  /** Doginals inscription ID: `${revealTxid}i0` */
  inscriptionId: string;
  commitFeeSatoshis: number;
  revealFeeSatoshis: number;
  /** Sum of extra reveal payments (koinu), if any. */
  paymentSatoshis: number;
  /** Commit inputs (for mempool spend overlay after broadcast). */
  commitSpent: Array<{ txid: string; vout: number }>;
  /** Commit change back to sender, if any. */
  commitChange: { vout: number; value: number } | null;
}

/**
 * Encode a compact secp256k1 signature (64 bytes: r || s) as DER.
 * @noble/secp256k1 v3 removed built-in DER support; this helper fills the gap.
 */
function compactSigToDER(compact: Uint8Array): Buffer {
  function encodeInt(bytes: Uint8Array): Buffer {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++; // strip leading zeros
    let trimmed = bytes.slice(i);
    if (trimmed[0] & 0x80) trimmed = Buffer.concat([Buffer.from([0x00]), Buffer.from(trimmed)]);
    return Buffer.concat([Buffer.from([0x02, trimmed.length]), Buffer.from(trimmed)]);
  }
  const r = encodeInt(compact.slice(0, 32));
  const s = encodeInt(compact.slice(32, 64));
  return Buffer.concat([Buffer.from([0x30, r.length + s.length]), r, s]);
}

/** Value-0 `OP_RETURN` push. Empty or oversized input becomes null. */
function opReturnScriptFromUtf8(raw: string | undefined): Buffer | null {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  let s = text;
  while (Buffer.from(s, 'utf8').length > 80) {
    const chars = [...s];
    chars.pop();
    s = chars.join('');
  }
  const payload = Buffer.from(s, 'utf8');
  if (!payload.length) return null;
  return bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, payload]);
}

/**
 * Reveal spends one commit P2SH output. Inscription carrier is always vout 0 of the reveal
 * (`txid`i0). Dogecoin's era-1 indexer reads `vin[0].scriptSig` only, so one reveal = one doginal.
 */
async function signP2shReveal(opts: {
  commitTxid: string;
  vout: number;
  lockScript: Buffer;
  partial: ScriptChunk[];
  inscriptionScriptPubKey: Buffer;
  paymentScripts: { script: Buffer; satoshis: number }[];
  opReturnScript: Buffer | null;
  privKeyBytes: Uint8Array;
  pubKeyBytes: Buffer;
}): Promise<{ revealTxHex: string; revealTxid: string; inscriptionId: string }> {
  const revealTx = new bitcoin.Transaction();
  revealTx.version = 1;
  revealTx.addInput(
    Buffer.from(opts.commitTxid, 'hex').reverse(),
    opts.vout,
    0xfffffffd,
  );
  revealTx.addOutput(Buffer.from(opts.inscriptionScriptPubKey), BigInt(INSCRIPTION_DEST_AMOUNT));
  for (const pay of opts.paymentScripts) {
    revealTx.addOutput(Buffer.from(pay.script), BigInt(pay.satoshis));
  }
  if (opts.opReturnScript) {
    revealTx.addOutput(opts.opReturnScript, 0n);
  }

  const SIGHASH_ALL = 0x01;
  const sigHash = revealTx.hashForSignature(0, opts.lockScript, SIGHASH_ALL);
  const compact = await secp.signAsync(sigHash, opts.privKeyBytes, { lowS: true, prehash: false });
  const derBytes = compactSigToDER(compact);
  const txSig = Buffer.concat([derBytes, Buffer.from([SIGHASH_ALL])]);
  const sigOk = await secp.verifyAsync(compact, sigHash, opts.pubKeyBytes, { prehash: false });
  if (!sigOk) throw new Error('[inscribe] Signature verification failed — aborting reveal tx build.');

  const scriptSigItems: (number | Buffer)[] = [];
  for (const chunk of opts.partial) {
    scriptSigItems.push(chunk.buf !== undefined ? chunk.buf : chunk.opcodenum);
  }
  scriptSigItems.push(txSig);
  scriptSigItems.push(opts.lockScript);
  revealTx.ins[0].script = bitcoin.script.compile(scriptSigItems);

  const revealTxHex = revealTx.toHex();
  const revealTxid = bitcoin.Transaction.fromHex(revealTxHex).getId();
  return { revealTxHex, revealTxid, inscriptionId: `${revealTxid}i0` };
}

/**
 * Build and sign both the commit and reveal transactions for a plain-text
 * Doginals inscription.  Both transactions are signed with the local private
 * key; the caller is responsible for broadcasting them in sequence.
 */
export async function signInscriptionTxs(
  params: SignInscriptionParams,
): Promise<SignedInscriptionPair> {
  const {
    text = '',
    contentBytes,
    fromAddress,
    privateKeyWIF,
    feeRate: requestedFeeRate = 0,
    excludedOutpoints,
    inscriptionReceiveAddress: inscriptionReceiveRaw,
    contentType: contentTypeRaw,
    extraRevealPayments = [],
    opReturn: opReturnRaw,
    parents: parentIds = [],
    delegates: delegateIds = [],
    metaprotocol,
    metadata,
  } = params;
  const feeRate = await enforceBroadcastFeeRateKoinuPerKb({
    requestedKoinuPerKb: requestedFeeRate,
    context: 'signInscriptionTxs',
  });

  // ── Input validation ────────────────────────────────────────────────────────
  const contentBuf = contentBytes?.length
    ? Buffer.from(contentBytes)
    : Buffer.from(text, 'utf8');
  if (!contentBuf.length) throw new Error('Inscription text cannot be empty.');
  if (contentBuf.length > INSCRIPTION_MAX_CONTENT_BYTES) {
    throw new Error(
      `Text too long: ${contentBuf.length} bytes ` +
      `(max ${INSCRIPTION_MAX_CONTENT_BYTES} for a 2-transaction inscription).`,
    );
  }
  const contentType = (contentTypeRaw?.trim() || INSCRIPTION_CONTENT_TYPE).slice(0, 80);

  const payments = extraRevealPayments
    .map((p) => ({
      address: p.address.trim(),
      satoshis: Math.floor(Number(p.satoshis)),
    }))
    .filter((p) => p.address && p.satoshis >= HARD_DUST_KOINU);
  const paymentSatoshis = payments.reduce((s, p) => s + p.satoshis, 0);

  // ── Key material ────────────────────────────────────────────────────────────
  const privKeyBytes = decodePrivateKeyFromWIF(privateKeyWIF);
  const pubKeyBytes  = Buffer.from(secp.getPublicKey(privKeyBytes, true)); // compressed

  const inscriptionReceiveDisplay = (inscriptionReceiveRaw?.trim() || fromAddress).trim();
  const { scriptPubKey: inscriptionScriptPubKey } = parseDogecoinReceiveAddress(inscriptionReceiveDisplay);
  const changeScriptPubKey = bitcoin.payments.p2pkh({ address: fromAddress, network: DOGE_NETWORK }).output!;

  const paymentScripts: { script: Buffer; satoshis: number; address: string }[] = [];
  for (const p of payments) {
    const { scriptPubKey } = parseDogecoinReceiveAddress(p.address);
    paymentScripts.push({ script: scriptPubKey, satoshis: p.satoshis, address: p.address });
  }
  const opReturnScript = opReturnScriptFromUtf8(opReturnRaw);

  // ── Plan the inscription ─────────────────────────────────────────────────────
  const useTagged =
    parentIds.length > 0 ||
    delegateIds.length > 0 ||
    Boolean(metaprotocol?.trim()) ||
    Boolean(metadata?.length);
  const parentBytes = parentIds.map((id) => inscriptionIdToParentBytes(id));
  const delegateBytes = delegateIds.map((id) => inscriptionIdToParentBytes(id));
  const allChunks = useTagged
    ? buildTaggedInscriptionChunks(contentBuf, contentType, {
        parents: parentBytes,
        delegates: delegateBytes,
        metaprotocol: metaprotocol?.trim() || undefined,
        metadata: metadata ? Buffer.from(metadata) : undefined,
      })
    : buildInscriptionChunks(contentBuf, contentType);
  let partial: ScriptChunk[];
  if (useTagged) {
    // Tagged envelopes: pack entire script into one partial (JSON claims fit easily).
    partial = allChunks;
    if (chunksToBuffer(partial).length > MAX_PAYLOAD_LEN + 200) {
      throw new Error(
        'Tagged inscription envelope too large for a single P2SH partial. Reduce payload.',
      );
    }
  } else {
    const queue = [...allChunks];
    partial = extractPartial(queue, true);
    if (queue.length > 0) {
      throw new Error(
        'Internal: content did not fit in a single partial. Reduce message size.',
      );
    }
  }

  const lockScript    = buildLockScript(pubKeyBytes, partial);
  const p2shScript    = buildP2shOutputScript(lockScript);
  const p2shAddress   = bitcoin.address.fromOutputScript(p2shScript, DOGE_NETWORK);
  const p2shAmount    = computeP2shAmount(
    partial,
    lockScript,
    feeRate,
    inscriptionScriptPubKey,
    changeScriptPubKey,
    paymentSatoshis,
    paymentScripts.length + (opReturnScript ? 1 : 0),
    payments.map((p) => p.satoshis),
  );
  const revealFee     = p2shAmount - INSCRIPTION_DEST_AMOUNT - paymentSatoshis;

  console.log('[inscribe] plan', {
    contentBytes:  contentBuf.length,
    partialChunks: partial.length,
    lockScriptLen: lockScript.length,
    p2shAddress,
    p2shAmount,
    revealFee,
  });

  // ── Fetch and select UTXOs ──────────────────────────────────────────────────
  const rawUtxos = await fetchUtxosWithRetry(fromAddress);
  if (!rawUtxos.length) {
    throw new Error('No confirmed UTXOs found. Send DOGE to your wallet before inscribing.');
  }

  const afterExcludes = filterExcluded(rawUtxos, excludedOutpoints);
  const { safe: spendable } = await filterPaymentSpendableUtxos(fromAddress, afterExcludes as any);
  if (!spendable.length) {
    throw new Error('No spendable UTXOs remain after excluding protected and inscription-likely outputs.');
  }

  const selected = selectSmallestSufficient(spendable, (n) => {
    const cFee = commitFeeFromEstimate(
      estimateCommitTxVbytes(Math.max(1, n), p2shScript, changeScriptPubKey),
      feeRate,
    );
    return cFee + p2shAmount;
  });
  const totalSats = selected.reduce((sum, u) => sum + u.value, 0);

  const commitFee = commitFeeFromEstimate(
    estimateCommitTxVbytes(selected.length, p2shScript, changeScriptPubKey),
    feeRate,
  );
  if (totalSats < commitFee + p2shAmount) {
    throw new Error(
      `Insufficient funds: need ≥ ${((commitFee + p2shAmount) / 1e8).toFixed(4)} DOGE ` +
      `(commit fee + inscription reserve), have ${(totalSats / 1e8).toFixed(4)} DOGE.`,
    );
  }

  let commitChange = totalSats - commitFee - p2shAmount;
  commitChange = discardSoftDustChangeKoinu(commitChange);

  // ── Build and sign commit tx ────────────────────────────────────────────────
  // Standard P2PKH inputs → P2SH output + change.
  // doge-sdk handles P2PKH signing robustly (same as OP_RETURN path).
  const dogeSigner   = DogeMemoryWallet.fromWIF(privateKeyWIF, 'doge');
  const commitBuilder = createP2PKHTransaction(dogeSigner, {
    address: fromAddress,
    inputs:  selected.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
    outputs: [
      { script: p2shScript, value: p2shAmount },
      ...(commitChange >= SOFT_DUST_KOINU ? [{ address: fromAddress, value: commitChange }] : []),
    ] as any,
  });

  const signedCommit = await commitBuilder.finalizeAndSign();
  const commitTxHex  = signedCommit.toHex();
  const commitBtcTx  = bitcoin.Transaction.fromHex(commitTxHex);
  const commitTxid   = commitBtcTx.getId();

  const commitInputSats = selected.reduce((s, u) => s + u.value, 0);
  const commitOutputSats = commitBtcTx.outs.reduce((s, o) => s + Number(o.value), 0);
  const commitPaidFee = commitInputSats - commitOutputSats;
  const commitVsize = commitBtcTx.virtualSize();
  const commitMinForSize = Math.max(MIN_FEE_SATS, Math.ceil((commitVsize * feeRate) / 1000));
  if (commitPaidFee < commitMinForSize) {
    throw new Error(
      `[inscribe] Commit pays ${commitPaidFee} koinu fee but ${commitVsize} vB at your rate needs ≥ ${commitMinForSize} koinu. ` +
        'Raise the fee rate in ÐogeTags (or your inscription flow) and rebuild.',
    );
  }

  console.log('[inscribe] commit tx built', {
    commitTxid,
    outputs:      commitBtcTx.outs.length,
    commitChange,
    p2shAddress,
    p2shAmount,
    commitVsize,
    commitPaidFee,
    commitMinForSize,
    commitTxHex,
  });

  // ── Build and sign reveal tx ────────────────────────────────────────────────
  // One P2SH input with canonical Doginals scriptSig → inscription UTXO (+ optional payments).
  // All outputs MUST be present before signing (SIGHASH_ALL).
  const revealed = await signP2shReveal({
    commitTxid,
    vout: 0,
    lockScript,
    partial,
    inscriptionScriptPubKey,
    paymentScripts,
    opReturnScript,
    privKeyBytes,
    pubKeyBytes,
  });
  const revealTxHex = revealed.revealTxHex;
  const revealTxid = revealed.revealTxid;
  const inscriptionId = revealed.inscriptionId;

  console.log('[inscribe] reveal tx built', {
    revealTxid,
    inscriptionId,
    revealFee,
    paymentSatoshis,
    paymentOutputs: paymentScripts.length,
    commitTxHex,
    revealTxHex,
  });

  return {
    commitTxHex,
    revealTxHex,
    commitTxid,
    revealTxid,
    inscriptionId,
    commitFeeSatoshis: commitFee,
    revealFeeSatoshis: revealFee,
    paymentSatoshis,
    commitSpent: selected.map((u) => ({
      txid: u.tx_hash.trim().toLowerCase(),
      vout: u.tx_output_n,
    })),
    commitChange:
      commitChange >= SOFT_DUST_KOINU
        ? {
            // outs: [P2SH, ...?change] — change is last when present
            vout: commitBtcTx.outs.length - 1,
            value: commitChange,
          }
        : null,
  };
}

export interface SignInscriptionBatchItem {
  text: string;
  contentType?: string;
  inscriptionReceiveAddress?: string;
  extraRevealPayments?: RevealPaymentOutput[];
  /** UTF-8 nulldata on this item's reveal. Clipped to 80 bytes. */
  opReturn?: string;
}

export interface SignedInscriptionBatchReveal {
  revealTxHex: string;
  revealTxid: string;
  inscriptionId: string;
  /** Commit output this reveal spends. */
  vout: number;
}

export interface SignedInscriptionBatch {
  commitTxHex: string;
  commitTxid: string;
  commitFeeSatoshis: number;
  commitSpent: Array<{ txid: string; vout: number }>;
  commitChange: { vout: number; value: number } | null;
  reveals: SignedInscriptionBatchReveal[];
}

/** Hard cap. One commit can fund this many independent reveals. */
export const INSCRIPTION_BATCH_MAX = 20;

/**
 * One wallet spend, many doginals.
 *
 * Dogecoin indexes an era-1 inscription from `vin[0].scriptSig` only, so N names
 * cannot share one reveal. This builds one commit with N P2SH outputs and N reveal
 * transactions that spend those outputs. The reveals do not share inputs, so they
 * cannot race the same UTXO.
 *
 * The P2SH lock is `<pubkey> CHECKSIGVERIFY DROP×n OP_1`. It commits to the chunk
 * count, not the bytes, so two short names share a scriptPubKey. Outputs stay
 * separate; each reveal carries its own payload. Tell them apart by value and vout.
 *
 * Nothing is broadcast here.
 */
export async function signInscriptionBatch(params: {
  items: SignInscriptionBatchItem[];
  fromAddress: string;
  privateKeyWIF: string;
  feeRate?: number;
  excludedOutpoints?: string[];
}): Promise<SignedInscriptionBatch> {
  const items = params.items;
  if (items.length === 0) throw new Error('Nothing to inscribe.');
  if (items.length > INSCRIPTION_BATCH_MAX) {
    throw new Error(`At most ${INSCRIPTION_BATCH_MAX} inscriptions per payment.`);
  }
  const feeRate = await enforceBroadcastFeeRateKoinuPerKb({
    requestedKoinuPerKb: params.feeRate ?? 0,
    context: 'signInscriptionBatch',
  });
  const fromAddress = params.fromAddress.trim();
  const privKeyBytes = decodePrivateKeyFromWIF(params.privateKeyWIF);
  const pubKeyBytes = Buffer.from(secp.getPublicKey(privKeyBytes, true));
  const changeScriptPubKey = bitcoin.payments.p2pkh({
    address: fromAddress,
    network: DOGE_NETWORK,
  }).output!;

  type Plan = {
    partial: ScriptChunk[];
    lockScript: Buffer;
    p2shScript: Buffer;
    p2shHex: string;
    p2shAmount: number;
    inscriptionScriptPubKey: Buffer;
    paymentScripts: { script: Buffer; satoshis: number }[];
    opReturnScript: Buffer | null;
  };
  const plans: Plan[] = [];
  const seenBody = new Set<string>();

  for (const item of items) {
    const contentBuf = Buffer.from(item.text ?? '', 'utf8');
    if (!contentBuf.length) throw new Error('Inscription text cannot be empty.');
    if (contentBuf.length > INSCRIPTION_MAX_CONTENT_BYTES) {
      throw new Error(`Text too long: ${contentBuf.length} bytes (max ${INSCRIPTION_MAX_CONTENT_BYTES}).`);
    }
    const contentType = (item.contentType?.trim() || INSCRIPTION_CONTENT_TYPE).slice(0, 80);
    const bodyKey = `${contentType}\0${contentBuf.toString('hex')}`;
    if (seenBody.has(bodyKey)) {
      throw new Error('Two items committed to the same inscription. Remove the duplicate.');
    }
    seenBody.add(bodyKey);
    const queue = [...buildInscriptionChunks(contentBuf, contentType)];
    const partial = extractPartial(queue, true);
    if (queue.length > 0) {
      throw new Error('Content did not fit in a single inscription partial.');
    }
    const payments = (item.extraRevealPayments ?? [])
      .map((p) => ({
        address: p.address.trim(),
        satoshis: Math.floor(Number(p.satoshis)),
      }))
      .filter((p) => p.address && p.satoshis >= HARD_DUST_KOINU);
    const paymentSatoshis = payments.reduce((s, p) => s + p.satoshis, 0);
    const receive = (item.inscriptionReceiveAddress?.trim() || fromAddress).trim();
    const { scriptPubKey: inscriptionScriptPubKey } = parseDogecoinReceiveAddress(receive);
    const paymentScripts: { script: Buffer; satoshis: number }[] = [];
    for (const p of payments) {
      const { scriptPubKey } = parseDogecoinReceiveAddress(p.address);
      paymentScripts.push({ script: scriptPubKey, satoshis: p.satoshis });
    }
    const opReturnScript = opReturnScriptFromUtf8(item.opReturn);
    const lockScript = buildLockScript(pubKeyBytes, partial);
    const p2shScript = buildP2shOutputScript(lockScript);
    const p2shHex = p2shScript.toString('hex');
    const p2shAmount = computeP2shAmount(
      partial,
      lockScript,
      feeRate,
      inscriptionScriptPubKey,
      changeScriptPubKey,
      paymentSatoshis,
      paymentScripts.length + (opReturnScript ? 1 : 0),
      payments.map((p) => p.satoshis),
    );
    plans.push({
      partial,
      lockScript,
      p2shScript,
      p2shHex,
      p2shAmount,
      inscriptionScriptPubKey,
      paymentScripts,
      opReturnScript,
    });
  }

  const reserve = plans.reduce((s, p) => s + p.p2shAmount, 0);
  const outputScripts = [...plans.map((p) => p.p2shScript), changeScriptPubKey];
  const rawUtxos = await fetchUtxosWithRetry(fromAddress);
  if (!rawUtxos.length) {
    throw new Error('No confirmed UTXOs found. Send DOGE to your wallet before inscribing.');
  }
  const afterExcludes = filterExcluded(rawUtxos, params.excludedOutpoints);
  const { safe: spendable } = await filterPaymentSpendableUtxos(fromAddress, afterExcludes as any);
  if (!spendable.length) {
    throw new Error('No spendable UTXOs remain after excluding protected and inscription-likely outputs.');
  }
  const selected = selectSmallestSufficient(spendable, (n) => {
    const estimated =
      10 +
      Math.max(1, n) * COMMIT_VBYTES_PER_P2PKH_INPUT +
      outputScripts.reduce((s, script) => s + legacyOutputVbytes(script), 0);
    return commitFeeFromEstimate(estimated, feeRate) + reserve;
  });
  const totalSats = selected.reduce((sum, u) => sum + u.value, 0);
  const commitFee = commitFeeFromEstimate(
    10 +
      selected.length * COMMIT_VBYTES_PER_P2PKH_INPUT +
      outputScripts.reduce((s, script) => s + legacyOutputVbytes(script), 0),
    feeRate,
  );
  if (totalSats < commitFee + reserve) {
    throw new Error(
      `Insufficient funds: need ≥ ${((commitFee + reserve) / 1e8).toFixed(4)} DOGE ` +
        `for ${plans.length} inscriptions, have ${(totalSats / 1e8).toFixed(4)} DOGE.`,
    );
  }
  let commitChange = discardSoftDustChangeKoinu(totalSats - commitFee - reserve);
  const dogeSigner = DogeMemoryWallet.fromWIF(params.privateKeyWIF, 'doge');
  const commitBuilder = createP2PKHTransaction(dogeSigner, {
    address: fromAddress,
    inputs: selected.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
    outputs: [
      ...plans.map((p) => ({ script: p.p2shScript, value: p.p2shAmount })),
      ...(commitChange >= SOFT_DUST_KOINU ? [{ address: fromAddress, value: commitChange }] : []),
    ] as any,
  });
  const signedCommit = await commitBuilder.finalizeAndSign();
  const commitTxHex = signedCommit.toHex();
  const commitBtcTx = bitcoin.Transaction.fromHex(commitTxHex);
  const commitTxid = commitBtcTx.getId();
  const commitInputSats = selected.reduce((s, u) => s + u.value, 0);
  const commitOutputSats = commitBtcTx.outs.reduce((s, o) => s + Number(o.value), 0);
  const commitPaidFee = commitInputSats - commitOutputSats;
  const commitVsize = commitBtcTx.virtualSize();
  const commitMinForSize = Math.max(MIN_FEE_SATS, Math.ceil((commitVsize * feeRate) / 1000));
  if (commitPaidFee < commitMinForSize) {
    throw new Error(
      `[inscribe] Commit pays ${commitPaidFee} koinu fee but ${commitVsize} vB at your rate needs ≥ ${commitMinForSize} koinu.`,
    );
  }

  const usedVout = new Set<number>();
  const reveals: SignedInscriptionBatchReveal[] = [];
  for (const plan of plans) {
    const candidates = commitBtcTx.outs
      .map((out, i) => ({ i, out }))
      .filter(
        ({ i, out }) =>
          !usedVout.has(i) && Buffer.from(out.script).toString('hex') === plan.p2shHex,
      );
    const exact = candidates.find(({ out }) => Number(out.value) === plan.p2shAmount);
    const vout = exact?.i ?? (candidates.length === 1 ? candidates[0]!.i : -1);
    if (vout < 0) {
      throw new Error('Commit did not include every inscription output. Nothing was broadcast.');
    }
    usedVout.add(vout);
    const revealed = await signP2shReveal({
      commitTxid,
      vout,
      lockScript: plan.lockScript,
      partial: plan.partial,
      inscriptionScriptPubKey: plan.inscriptionScriptPubKey,
      paymentScripts: plan.paymentScripts,
      opReturnScript: plan.opReturnScript,
      privKeyBytes,
      pubKeyBytes,
    });
    reveals.push({ ...revealed, vout });
  }

  let changeVout: number | null = null;
  if (commitChange >= SOFT_DUST_KOINU) {
    const want = changeScriptPubKey.toString('hex');
    const idx = commitBtcTx.outs.findIndex(
      (out, i) => !usedVout.has(i) && Buffer.from(out.script).toString('hex') === want,
    );
    changeVout = idx >= 0 ? idx : null;
  }

  return {
    commitTxHex,
    commitTxid,
    commitFeeSatoshis: commitFee,
    commitSpent: selected.map((u) => ({
      txid: u.tx_hash.trim().toLowerCase(),
      vout: u.tx_output_n,
    })),
    commitChange: changeVout != null ? { vout: changeVout, value: commitChange } : null,
    reveals,
  };
}

/**
 * High-level: sign + broadcast commit→reveal for JSON (or text) inscriptions.
 * Used by ÐLaunch launch/buy one-flow UX.
 */
export async function signAndBroadcastInscription(params: SignInscriptionParams & {
  /** Optional progress callback for UI. */
  onProgress?: (step: string) => void;
}): Promise<SignedInscriptionPair & { mode: 'on_chain' }> {
  const { onProgress, ...signParams } = params;
  onProgress?.('Signing commit + reveal…');
  const pair = await signInscriptionTxs(signParams);

  const { broadcastSignedTransaction } = await import('../broadcast/dogecoinTxBroadcast');

  onProgress?.('Broadcasting commit…');
  await broadcastSignedTransaction(pair.commitTxHex);

  // Brief pause so relays see the commit before the child reveal.
  await new Promise((r) => setTimeout(r, 900));

  onProgress?.('Broadcasting reveal (inscription)…');
  await broadcastSignedTransaction(pair.revealTxHex);

  onProgress?.(`Inscribed ${pair.inscriptionId}`);
  return { ...pair, mode: 'on_chain' };
}
