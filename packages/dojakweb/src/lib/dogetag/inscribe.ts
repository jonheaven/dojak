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
import { fetchSpendableUtxosConservativeForAddress, filterSafeSpendableUtxos } from '../broadcast/dogecoinTxBroadcast';
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

/** Satoshi value forwarded to the inscription recipient after reveal. */
const INSCRIPTION_DEST_AMOUNT = 100_000; // 0.001 DOGE

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

  return (
    10 +
    inputBytes +
    legacyOutputVbytes(inscriptionScriptPubKey) +
    legacyOutputVbytes(changeScriptPubKey)
  );
}

/**
 * The P2SH output must hold enough for the reveal fee AND the inscription
 * destination amount.  Dynamic so high fee-rates still work correctly.
 */
function computeP2shAmount(
  partial: ScriptChunk[],
  lockScript: Buffer,
  feeRate: number,
  inscriptionScriptPubKey: Buffer,
  changeScriptPubKey: Buffer,
): number {
  const revealFee = feeFor(
    estimateRevealTxBytes(partial, lockScript, inscriptionScriptPubKey, changeScriptPubKey),
    feeRate,
  );
  return INSCRIPTION_DEST_AMOUNT + revealFee;
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

export interface SignInscriptionParams {
  /** Plain text to inscribe. */
  text: string;
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

/**
 * Build and sign both the commit and reveal transactions for a plain-text
 * Doginals inscription.  Both transactions are signed with the local private
 * key; the caller is responsible for broadcasting them in sequence.
 */
export async function signInscriptionTxs(
  params: SignInscriptionParams,
): Promise<SignedInscriptionPair> {
  const {
    text,
    fromAddress,
    privateKeyWIF,
    feeRate = 1000,
    excludedOutpoints,
    inscriptionReceiveAddress: inscriptionReceiveRaw,
  } = params;

  // ── Input validation ────────────────────────────────────────────────────────
  const contentBuf = Buffer.from(text, 'utf8');
  if (!contentBuf.length) throw new Error('Inscription text cannot be empty.');
  if (contentBuf.length > INSCRIPTION_MAX_CONTENT_BYTES) {
    throw new Error(
      `Text too long: ${contentBuf.length} bytes ` +
      `(max ${INSCRIPTION_MAX_CONTENT_BYTES} for a 2-transaction inscription).`,
    );
  }

  // ── Key material ────────────────────────────────────────────────────────────
  const privKeyBytes = decodePrivateKeyFromWIF(privateKeyWIF);
  const pubKeyBytes  = Buffer.from(secp.getPublicKey(privKeyBytes, true)); // compressed

  const inscriptionReceiveDisplay = (inscriptionReceiveRaw?.trim() || fromAddress).trim();
  const { scriptPubKey: inscriptionScriptPubKey } = parseDogecoinReceiveAddress(inscriptionReceiveDisplay);
  const changeScriptPubKey = bitcoin.payments.p2pkh({ address: fromAddress, network: DOGE_NETWORK }).output!;

  // ── Plan the inscription ─────────────────────────────────────────────────────
  const allChunks = buildInscriptionChunks(contentBuf, INSCRIPTION_CONTENT_TYPE);
  const queue     = [...allChunks];
  const partial   = extractPartial(queue, true);

  if (queue.length > 0) {
    throw new Error(
      'Internal: content did not fit in a single partial. Reduce message size.',
    );
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
  );
  const revealFee     = p2shAmount - INSCRIPTION_DEST_AMOUNT;

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
  const { safe: spendable } = filterSafeSpendableUtxos(fromAddress, afterExcludes as any);
  if (!spendable.length) {
    throw new Error('No spendable UTXOs remain after excluding protected and inscription-likely outputs.');
  }

  const sorted   = [...spendable].sort((a, b) => b.value - a.value);
  const selected: NormUtxo[] = [];
  let totalSats = 0;

  for (const u of sorted) {
    if (!Number.isFinite(u.value) || u.value <= 0) continue;
    selected.push(u);
    totalSats += u.value;
    const cFee = commitFeeFromEstimate(
      estimateCommitTxVbytes(selected.length, p2shScript, changeScriptPubKey),
      feeRate,
    );
    if (totalSats >= cFee + p2shAmount + 100_000) break; // 100k dust guard on change
  }

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

  const commitChange = totalSats - commitFee - p2shAmount;

  // ── Build and sign commit tx ────────────────────────────────────────────────
  // Standard P2PKH inputs → P2SH output + change.
  // doge-sdk handles P2PKH signing robustly (same as OP_RETURN path).
  const dogeSigner   = DogeMemoryWallet.fromWIF(privateKeyWIF, 'doge');
  const commitBuilder = createP2PKHTransaction(dogeSigner, {
    address: fromAddress,
    inputs:  selected.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
    outputs: [
      { script: p2shScript, value: p2shAmount },
      ...(commitChange >= 100_000 ? [{ address: fromAddress, value: commitChange }] : []),
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
  // One P2SH input with canonical Doginals scriptSig → inscription output (doginals.js `tx.to(address, 100000)`).
  const revealTx = new bitcoin.Transaction();
  revealTx.version = 1;

  // Input 0: the P2SH output from commit tx (vout 0)
  revealTx.addInput(
    Buffer.from(commitTxid, 'hex').reverse(), // txid in LE (internal) byte order
    0,
    0xfffffffd, // BIP-125 opt-in RBF — matches RBF_SEQUENCE used in doginal-chain.ts
  );

  revealTx.addOutput(Buffer.from(inscriptionScriptPubKey), BigInt(INSCRIPTION_DEST_AMOUNT));

  // Sign input 0 — P2SH convention: sign against the redeemScript (lockScript)
  const SIGHASH_ALL = 0x01;
  const sigHash = revealTx.hashForSignature(0, lockScript, SIGHASH_ALL);
  // @noble/secp256k1 v3 returns compact 64-byte Uint8Array by default; prehash must be false
  // since sigHash is already a 32-byte hash from hashForSignature.
  const compact = await secp.signAsync(sigHash, privKeyBytes, { lowS: true, prehash: false });
  const derBytes = compactSigToDER(compact);
  const txSig    = Buffer.concat([derBytes, Buffer.from([SIGHASH_ALL])]);

  // Verify the signature locally before assembling — surfaces key/signing mismatches early.
  const sigOk = await secp.verifyAsync(compact, sigHash, pubKeyBytes, { prehash: false });
  console.log('[inscribe] sig verify', {
    ok: sigOk,
    sigHashHex:  Buffer.from(sigHash).toString('hex'),
    pubKeyHex:   Buffer.from(pubKeyBytes).toString('hex'),
    derHex:      Buffer.from(derBytes).toString('hex'),
    lockScriptHex: Buffer.from(lockScript).toString('hex'),
    p2shScriptHex: Buffer.from(p2shScript).toString('hex'),
  });
  if (!sigOk) throw new Error('[inscribe] Signature verification failed — aborting reveal tx build.');

  // Assemble scriptSig: [partial_chunks…] [sig] [lockScript]
  // This is exactly what indexers (wonky-ord et al.) parse to extract inscription data.
  const scriptSigItems: (number | Buffer)[] = [];
  for (const chunk of partial) {
    scriptSigItems.push(chunk.buf !== undefined ? chunk.buf : chunk.opcodenum);
  }
  scriptSigItems.push(txSig);
  scriptSigItems.push(lockScript);

  revealTx.ins[0].script = bitcoin.script.compile(scriptSigItems);

  const revealTxHex    = revealTx.toHex();
  const revealTxid     = bitcoin.Transaction.fromHex(revealTxHex).getId();
  const inscriptionId  = `${revealTxid}i0`;

  console.log('[inscribe] reveal tx built', {
    revealTxid,
    inscriptionId,
    revealFee,
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
  };
}
