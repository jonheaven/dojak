/**
 * Multi-transaction Doginals (P2SH) inscription chain — ports the `inscribe()` loop
 * from ref/Dogecoin-Tools/scripts/doginals.js for arbitrary binary + MIME type.
 *
 * 1 partial  → commit + final reveal (2 txs)
 * N partials → commit + (N−1) link txs + final reveal (N+1 txs)
 *
 * Inscription data lives in P2SH `scriptSig` chunks — not in OP_RETURN. For optional
 * indexable OP_RETURN metadata (Dogenals Era-2, custom payloads), use `lib/tx` +
 * `lib/dogenals` and attach via a separate tx or future “advanced outputs” UI — not here.
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as secp from '@noble/secp256k1';
import { createP2PKHTransaction, DogeMemoryWallet, decodePrivateKeyFromWIF } from 'doge-sdk';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterSafeSpendableUtxos,
  type NormalisedUtxo,
} from '../broadcast/dogecoinTxBroadcast';
import {
  DOGE_NETWORK,
  legacyOutputVbytes,
  parseDogecoinReceiveAddress,
} from './dogecoinAddress';
import { getInscriptionMarker } from '../../utils/inscription-settings';
import {
  HARD_DUST_KOINU,
  SOFT_DUST_KOINU,
  softDustFeePenaltyKoinu,
} from '../dogecoin/softDust';

const MAX_CHUNK_LEN = 240;
const MAX_PAYLOAD_LEN = 1500;
/** doginals.js MAX_SCRIPT_ELEMENT_SIZE */
export const DOGINAL_MAX_CONTENT_TYPE_LEN = 520;

const INSCRIPTION_DEST_AMOUNT = HARD_DUST_KOINU;
/** Floor high enough to cover soft-dust on the 0.001 carrier + size fee. */
const MIN_FEE_SATS = 2_000_000;
const SIGHASH_ALL = 0x01;
/** Change must clear soft dust or be discarded into fee. */
const DUST_SATS = SOFT_DUST_KOINU;
/** BIP-125 opt-in: inputs must use nSequence ≤ 0xfffffffd so fee bumps (RBF) are possible. */
const RBF_SEQUENCE = 0xfffffffd;

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
      n <= 16 ? undefined : n < 128 ? Buffer.from([n]) : Buffer.from([n % 256, Math.floor(n / 256)]),
    opcodenum:
      n === 0 ? 0x00 : n <= 16 ? 0x50 + n : n < 128 ? 0x01 : 0x02,
  };
}

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

function buildInscriptionChunks(content: Buffer, contentType: string): ScriptChunk[] {
  const parts: Buffer[] = [];
  let rem = content;
  while (rem.length > 0) {
    parts.push(rem.slice(0, MAX_CHUNK_LEN));
    rem = rem.slice(MAX_CHUNK_LEN);
  }
  const chunks: ScriptChunk[] = [];
  chunks.push(bufToChunk(Buffer.from(getInscriptionMarker())));
  chunks.push(numToChunk(parts.length));
  chunks.push(bufToChunk(Buffer.from(contentType)));
  parts.forEach((part, i) => {
    chunks.push(numToChunk(parts.length - i - 1));
    chunks.push(bufToChunk(part));
  });
  return chunks;
}

function extractPartial(queue: ScriptChunk[], isFirst: boolean): ScriptChunk[] {
  const partial: ScriptChunk[] = [];
  if (isFirst && queue.length > 0) {
    partial.push(queue.shift()!);
  }
  while (chunksToBuffer(partial).length <= MAX_PAYLOAD_LEN && queue.length > 0) {
    partial.push(queue.shift()!);
    partial.push(queue.shift()!);
  }
  if (chunksToBuffer(partial).length > MAX_PAYLOAD_LEN) {
    queue.unshift(partial.pop()!);
    queue.unshift(partial.pop()!);
  }
  return partial;
}

export function splitIntoPartials(content: Buffer, contentType: string): ScriptChunk[][] {
  const queue = [...buildInscriptionChunks(content, contentType)];
  const partials: ScriptChunk[][] = [];
  while (queue.length) {
    partials.push(extractPartial(queue, partials.length === 0));
  }
  return partials;
}

/** Number of raw transactions: one commit + (partials−1) links + one reveal. */
export function countDoginalTransactionsForContent(content: Buffer, contentType: string): number {
  const n = splitIntoPartials(content, contentType.trim()).length;
  return n + 1;
}

function buildLockScript(pubkey: Buffer, partial: ScriptChunk[]): Buffer {
  const items: (number | Buffer)[] = [
    pubkey,
    0xad,
    ...Array<number>(partial.length).fill(0x75),
    0x51,
  ];
  return bitcoin.script.compile(items);
}

function buildP2shOutputScript(lockScript: Buffer): Buffer {
  return bitcoin.script.compile([
    bitcoin.opcodes.OP_HASH160,
    bitcoin.crypto.hash160(lockScript),
    bitcoin.opcodes.OP_EQUAL,
  ]);
}

function feeFor(txBytes: number, feeRate: number, softDustOutputs: number[] = [INSCRIPTION_DEST_AMOUNT]): number {
  const sizeFee = Math.max(MIN_FEE_SATS, Math.ceil((txBytes * feeRate) / 1000));
  return Math.max(MIN_FEE_SATS, sizeFee + softDustFeePenaltyKoinu(softDustOutputs));
}

/** Size of a tx that spends this P2SH and pays to `nextOutputScriptPubKey` (next P2SH carry, or used only for fee math). */
function estimateSpendP2shOneOutputBytes(
  partial: ScriptChunk[],
  lockScript: Buffer,
  nextOutputScriptPubKey: Buffer,
): number {
  const partialLen = chunksToBuffer(partial).length;
  const sigLen = 73;
  const lockPushLen =
    lockScript.length <= 75 ? 1 + lockScript.length : lockScript.length <= 255 ? 2 + lockScript.length : 3 + lockScript.length;
  const scriptSigLen = partialLen + 1 + sigLen + lockPushLen;
  const scriptSigVarint = scriptSigLen < 0xfd ? 1 : 3;
  const inputBytes = 36 + scriptSigVarint + scriptSigLen + 4;
  return 10 + inputBytes + legacyOutputVbytes(nextOutputScriptPubKey);
}

/** Satoshis locked in P2SH so the next step (link or final reveal) can be paid. */
function computeP2shAmountForPartial(
  partial: ScriptChunk[],
  lockScript: Buffer,
  feeRate: number,
  nextP2shOutputScript: Buffer | null,
  inscriptionScriptPubKey: Buffer,
  changeScriptPubKey: Buffer,
): number {
  if (nextP2shOutputScript) {
    const revealFee = feeFor(estimateSpendP2shOneOutputBytes(partial, lockScript, nextP2shOutputScript), feeRate);
    return INSCRIPTION_DEST_AMOUNT + revealFee;
  }
  const revealFee = feeFor(
    estimateFinalRevealTxBytes(0, partial, lockScript, inscriptionScriptPubKey, changeScriptPubKey, true),
    feeRate,
  );
  return INSCRIPTION_DEST_AMOUNT + revealFee;
}

function estimateCommitBytes(inputCount: number): number {
  return 10 + inputCount * 148 + 32 + 34;
}

function estimateLinkBytes(
  walletInputCount: number,
  revealPartial: ScriptChunk[],
  revealLockScript: Buffer,
): number {
  const partialLen = chunksToBuffer(revealPartial).length;
  const lockPushLen =
    revealLockScript.length <= 75
      ? 1 + revealLockScript.length
      : revealLockScript.length <= 255
        ? 2 + revealLockScript.length
        : 3 + revealLockScript.length;
  const scriptSigLen = partialLen + 1 + 73 + lockPushLen;
  const scriptSigVarint = scriptSigLen < 0xfd ? 1 : 3;
  const in0 = 36 + scriptSigVarint + scriptSigLen + 4;
  const inW = walletInputCount * 148;
  return 10 + in0 + inW + 32 + 34 + 34;
}

/** Final reveal: P2SH in + optional wallet ins + inscription output + optional change to spender. */
function estimateFinalRevealTxBytes(
  walletInputCount: number,
  revealPartial: ScriptChunk[],
  revealLockScript: Buffer,
  inscriptionScriptPubKey: Buffer,
  changeScriptPubKey: Buffer,
  includeChangeOutput: boolean,
): number {
  const partialLen = chunksToBuffer(revealPartial).length;
  const lockPushLen =
    revealLockScript.length <= 75
      ? 1 + revealLockScript.length
      : revealLockScript.length <= 255
        ? 2 + revealLockScript.length
        : 3 + revealLockScript.length;
  const scriptSigLen = partialLen + 1 + 73 + lockPushLen;
  const scriptSigVarint = scriptSigLen < 0xfd ? 1 : 3;
  const in0 = 36 + scriptSigVarint + scriptSigLen + 4;
  const inW = walletInputCount * 148;
  let out = legacyOutputVbytes(inscriptionScriptPubKey);
  if (includeChangeOutput) out += legacyOutputVbytes(changeScriptPubKey);
  return 10 + in0 + inW + out;
}

async function signP2shRevealInput(
  tx: bitcoin.Transaction,
  vin: number,
  redeemScript: Buffer,
  partial: ScriptChunk[],
  privKey: Uint8Array,
): Promise<void> {
  const hash = tx.hashForSignature(vin, redeemScript, SIGHASH_ALL);
  const compact = await secp.signAsync(hash, privKey, { lowS: true, prehash: false });
  const sigBuf = bitcoin.script.signature.encode(compact, SIGHASH_ALL);
  const items: (number | Buffer)[] = [];
  for (const chunk of partial) {
    items.push(chunk.buf !== undefined ? chunk.buf : chunk.opcodenum);
  }
  items.push(Buffer.from(sigBuf));
  items.push(redeemScript);
  tx.ins[vin].script = bitcoin.script.compile(items);
}

async function signP2pkhInputs(
  tx: bitcoin.Transaction,
  fromVin: number,
  toVin: number,
  privKey: Uint8Array,
  prevOutScript: Buffer,
): Promise<void> {
  const pubKey = Buffer.from(secp.getPublicKey(privKey, true));
  for (let i = fromVin; i <= toVin; i++) {
    const hash = tx.hashForSignature(i, prevOutScript, SIGHASH_ALL);
    const compact = await secp.signAsync(hash, privKey, { lowS: true, prehash: false });
    const sigBuf = bitcoin.script.signature.encode(compact, SIGHASH_ALL);
    tx.ins[i].script = bitcoin.script.compile([Buffer.from(sigBuf), pubKey]);
  }
}

function filterExcluded(utxos: NormalisedUtxo[], excluded?: string[]): NormalisedUtxo[] {
  if (!excluded?.length) return utxos;
  const set = new Set(excluded.map((o) => o.trim().toLowerCase()));
  return utxos.filter((u) => !set.has(`${u.tx_hash.toLowerCase()}:${u.tx_output_n}`));
}

function removeSpentInTx(pool: NormalisedUtxo[], tx: bitcoin.Transaction): NormalisedUtxo[] {
  const spent = new Set(
    tx.ins.map((inp) => `${Buffer.from(inp.hash).reverse().toString('hex').toLowerCase()}:${inp.index}`),
  );
  return pool.filter((u) => !spent.has(`${u.tx_hash.toLowerCase()}:${u.tx_output_n}`));
}

function addOurP2pkhChange(pool: NormalisedUtxo[], tx: bitcoin.Transaction, p2pkhScript: Buffer): NormalisedUtxo[] {
  const txid = tx.getId();
  const next = [...pool];
  tx.outs.forEach((out, vout) => {
    const scr = Buffer.from(out.script);
    if (scr.equals(Buffer.from(p2pkhScript)) && out.value >= BigInt(DUST_SATS)) {
      next.push({ tx_hash: txid, tx_output_n: vout, value: Number(out.value) });
    }
  });
  return next;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchUtxosWithRetry(address: string): Promise<NormalisedUtxo[]> {
  let last: NormalisedUtxo[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await fetchSpendableUtxosConservativeForAddress(address);
      // Guard: never use 0.001 DOGE (100 000 koinu) UTXOs — those are inscription carriers.
      // Also skips any UTXOs locked in the dojakweb lock registry for this address.
      const { safe } = filterSafeSpendableUtxos(address, raw);
      if (safe.length > 0 || attempt === 2) return safe;
    } catch {
      /* retry */
    }
    await sleepMs(1200 * (attempt + 1));
  }
  return last;
}

/** Inputs of a signed raw tx as `txid:vout` (lowercase txid) — for excluding stale coins after a failed broadcast. */
export function outpointsFromRawTxHex(rawTxHex: string): string[] {
  const tx = bitcoin.Transaction.fromHex(rawTxHex);
  return tx.ins.map(
    (inp) => `${Buffer.from(inp.hash).reverse().toString('hex').toLowerCase()}:${inp.index}`,
  );
}

export interface DoginalChainStage {
  index: number;
  kind: 'commit' | 'link' | 'reveal';
  txHex: string;
  txid: string;
  feeSatoshis: number;
}

export interface DoginalChainResult {
  stages: DoginalChainStage[];
  inscriptionId: string;
  revealTxid: string;
  partialCount: number;
  contentBytes: number;
  contentType: string;
  totalFeeSatoshis: number;
  /** Address that receives the 100k inscription UTXO (reveal output v0). */
  inscriptionReceiveAddress: string;
}

export interface SignDoginalChainParams {
  content: Buffer;
  contentType: string;
  fromAddress: string;
  privateKeyWIF: string;
  feeRate?: number;
  excludedOutpoints?: string[];
  /**
   * Recipient for the inscribed UTXO (reveal tx output 0). Defaults to `fromAddress`.
   * Change from fees still returns to the spending wallet (`fromAddress`).
   */
  inscriptionReceiveAddress?: string;
}

/**
 * Build and sign a full doginals inscription chain (binary-safe).
 */
export async function signDoginalInscriptionChain(params: SignDoginalChainParams): Promise<DoginalChainResult> {
  const {
    content,
    contentType,
    fromAddress,
    privateKeyWIF,
    feeRate = 1_000_000,
    excludedOutpoints,
    inscriptionReceiveAddress: inscriptionReceiveRaw,
  } = params;

  if (!content.length) throw new Error('Inscription content is empty.');
  const ct = contentType.trim();
  if (!ct) throw new Error('Content type is required.');
  if (Buffer.from(ct, 'utf8').length > DOGINAL_MAX_CONTENT_TYPE_LEN) {
    throw new Error(`Content type exceeds ${DOGINAL_MAX_CONTENT_TYPE_LEN} bytes.`);
  }

  const privKeyBytes = decodePrivateKeyFromWIF(privateKeyWIF);
  const pubKeyBytes = Buffer.from(secp.getPublicKey(privKeyBytes, true));
  const p2pkhPay = bitcoin.payments.p2pkh({ address: fromAddress, network: DOGE_NETWORK });
  const p2pkhPrevScript = p2pkhPay.output!;
  const changeScriptPubKey = Buffer.from(p2pkhPrevScript);
  const inscriptionReceiveDisplay = (inscriptionReceiveRaw?.trim() || fromAddress).trim();
  const { scriptPubKey: inscriptionScriptPubKey } = parseDogecoinReceiveAddress(inscriptionReceiveDisplay);
  const dogeSigner = DogeMemoryWallet.fromWIF(privateKeyWIF, 'doge');

  const partials = splitIntoPartials(content, ct);
  if (!partials.length) throw new Error('Could not split inscription into partials.');

  let pool: NormalisedUtxo[] = [];

  const stages: DoginalChainStage[] = [];
  let totalFees = 0;

  type Carry = {
    txid: string;
    vout: number;
    value: number;
    lockScript: Buffer;
    partial: ScriptChunk[];
    p2shScript: Buffer;
  };
  let carry: Carry | null = null;

  const P = partials.length;
  for (let i = 0; i < P; i++) {
    const partial = partials[i]!;
    const lockScript = buildLockScript(pubKeyBytes, partial);
    const p2shScript = buildP2shOutputScript(lockScript);
    const nextP2sh =
      i < P - 1 ? buildP2shOutputScript(buildLockScript(pubKeyBytes, partials[i + 1]!)) : null;
    const p2shAmount = computeP2shAmountForPartial(
      partial,
      lockScript,
      feeRate,
      nextP2sh,
      inscriptionScriptPubKey,
      changeScriptPubKey,
    );

    if (i === 0) {
      await sleepMs(600);
      pool = filterExcluded(await fetchUtxosWithRetry(fromAddress), excludedOutpoints);
      if (!pool.length) {
        throw new Error(
          'No spendable UTXOs from the wallet data provider. Wait a minute and try again, or check Coins & UTXOs / Release local holds.',
        );
      }
      const sorted = [...pool].sort((a, b) => b.value - a.value);
      const selected: NormalisedUtxo[] = [];
      let totalSats = 0;
      for (const u of sorted) {
        if (!Number.isFinite(u.value) || u.value <= 0) continue;
        selected.push(u);
        totalSats += u.value;
        const cFee = feeFor(estimateCommitBytes(selected.length), feeRate);
        if (totalSats >= cFee + p2shAmount + DUST_SATS) break;
      }
      const commitFee = feeFor(estimateCommitBytes(selected.length), feeRate);
      if (totalSats < commitFee + p2shAmount) {
        throw new Error(
          `Insufficient funds for inscription commit: need ≥ ${((commitFee + p2shAmount) / 1e8).toFixed(4)} DOGE.`,
        );
      }
      const commitChange = totalSats - commitFee - p2shAmount;
      const commitBuilder = createP2PKHTransaction(dogeSigner, {
        address: fromAddress,
        inputs: selected.map((u) => ({
          txid: u.tx_hash,
          vout: u.tx_output_n,
          value: u.value,
          sequence: RBF_SEQUENCE,
        })),
        outputs: [
          { script: p2shScript, value: p2shAmount },
          ...(commitChange >= DUST_SATS ? [{ address: fromAddress, value: commitChange }] : []),
        ] as any,
      });
      const signedCommit = await commitBuilder.finalizeAndSign();
      const commitHex = signedCommit.toHex();
      const commitTx = bitcoin.Transaction.fromHex(commitHex);
      const commitTxid = commitTx.getId();

      stages.push({ index: stages.length, kind: 'commit', txHex: commitHex, txid: commitTxid, feeSatoshis: commitFee });
      totalFees += commitFee;
      pool = addOurP2pkhChange(removeSpentInTx(pool, commitTx), commitTx, Buffer.from(p2pkhPrevScript));
      carry = { txid: commitTxid, vout: 0, value: p2shAmount, lockScript, partial, p2shScript };
    } else {
      if (!carry) throw new Error('Internal: missing carry for link tx');

      const sorted = [...pool].sort((a, b) => b.value - a.value);
      let selected: NormalisedUtxo[] = [];
      let linkTx: bitcoin.Transaction | null = null;
      let linkFee = 0;

      for (let tries = 0; tries < 40; tries++) {
        let sumW = 0;
        selected = [];
        linkFee = feeFor(estimateLinkBytes(0, carry.partial, carry.lockScript), feeRate);
        for (const u of sorted) {
          if (!Number.isFinite(u.value) || u.value <= 0) continue;
          selected.push(u);
          sumW += u.value;
          linkFee = feeFor(estimateLinkBytes(selected.length, carry.partial, carry.lockScript), feeRate);
          if (carry.value + sumW >= p2shAmount + linkFee + DUST_SATS) break;
        }
        if (carry.value + sumW < p2shAmount + linkFee) {
          throw new Error('Insufficient funds for inscription link transaction.');
        }

        const changeAmt = carry.value + sumW - p2shAmount - linkFee;
        linkTx = new bitcoin.Transaction();
        linkTx.version = 1;
        linkTx.addInput(Buffer.from(carry.txid, 'hex').reverse(), carry.vout, RBF_SEQUENCE);
        for (const u of selected) {
          linkTx.addInput(Buffer.from(u.tx_hash, 'hex').reverse(), u.tx_output_n, RBF_SEQUENCE);
        }
        linkTx.addOutput(p2shScript, BigInt(p2shAmount));
        if (changeAmt >= DUST_SATS) {
          linkTx.addOutput(Buffer.from(p2pkhPrevScript), BigInt(changeAmt));
        }

        const insEnd = linkTx.ins.length - 1;
        if (insEnd >= 1) {
          await signP2pkhInputs(linkTx, 1, insEnd, privKeyBytes, Buffer.from(p2pkhPrevScript));
        }
        await signP2shRevealInput(linkTx, 0, carry.lockScript, carry.partial, privKeyBytes);

        const vsize = linkTx.virtualSize();
        const needFee = feeFor(vsize, feeRate);
        if (needFee <= linkFee) break;
        linkFee = needFee;
      }

      if (!linkTx) throw new Error('Failed to build link transaction.');
      const linkHex = linkTx.toHex();
      const linkTxid = bitcoin.Transaction.fromHex(linkHex).getId();

      stages.push({ index: stages.length, kind: 'link', txHex: linkHex, txid: linkTxid, feeSatoshis: linkFee });
      totalFees += linkFee;
      pool = addOurP2pkhChange(removeSpentInTx(pool, linkTx), linkTx, Buffer.from(p2pkhPrevScript));
      carry = { txid: linkTxid, vout: 0, value: p2shAmount, lockScript, partial, p2shScript };
    }
  }

  if (!carry) throw new Error('Internal: no carry before final reveal');

  const sorted = [...pool].sort((a, b) => b.value - a.value);
  let selected: NormalisedUtxo[] = [];
  let finalTx: bitcoin.Transaction | null = null;
  let finalFee = 0;

  for (let tries = 0; tries < 40; tries++) {
    let sumW = 0;
    selected = [];
    finalFee = feeFor(
      estimateFinalRevealTxBytes(
        0,
        carry.partial,
        carry.lockScript,
        inscriptionScriptPubKey,
        changeScriptPubKey,
        true,
      ),
      feeRate,
    );
    for (const u of sorted) {
      if (!Number.isFinite(u.value) || u.value <= 0) continue;
      selected.push(u);
      sumW += u.value;
      finalFee = feeFor(
        estimateFinalRevealTxBytes(
          selected.length,
          carry.partial,
          carry.lockScript,
          inscriptionScriptPubKey,
          changeScriptPubKey,
          true,
        ),
        feeRate,
      );
      if (carry.value + sumW >= INSCRIPTION_DEST_AMOUNT + finalFee + DUST_SATS) break;
    }
    if (carry.value + sumW < INSCRIPTION_DEST_AMOUNT + finalFee) {
      throw new Error('Insufficient funds for final inscription reveal.');
    }
    const changeAmt = carry.value + sumW - INSCRIPTION_DEST_AMOUNT - finalFee;

    finalTx = new bitcoin.Transaction();
    finalTx.version = 1;
    finalTx.addInput(Buffer.from(carry.txid, 'hex').reverse(), carry.vout, RBF_SEQUENCE);
    for (const u of selected) {
      finalTx.addInput(Buffer.from(u.tx_hash, 'hex').reverse(), u.tx_output_n, RBF_SEQUENCE);
    }
    finalTx.addOutput(Buffer.from(inscriptionScriptPubKey), BigInt(INSCRIPTION_DEST_AMOUNT));
    if (changeAmt >= DUST_SATS) {
      finalTx.addOutput(Buffer.from(changeScriptPubKey), BigInt(changeAmt));
    }

    const insEnd = finalTx.ins.length - 1;
    if (insEnd >= 1) {
      await signP2pkhInputs(finalTx, 1, insEnd, privKeyBytes, Buffer.from(p2pkhPrevScript));
    }
    await signP2shRevealInput(finalTx, 0, carry.lockScript, carry.partial, privKeyBytes);

    const vsize = finalTx.virtualSize();
    const needFee = feeFor(vsize, feeRate);
    if (needFee <= finalFee) break;
    finalFee = needFee;
  }

  if (!finalTx) throw new Error('Failed to build reveal transaction.');
  const revealHex = finalTx.toHex();
  const revealTxid = bitcoin.Transaction.fromHex(revealHex).getId();
  const inscriptionId = `${revealTxid}i0`;

  stages.push({ index: stages.length, kind: 'reveal', txHex: revealHex, txid: revealTxid, feeSatoshis: finalFee });
  totalFees += finalFee;

  return {
    stages,
    inscriptionId,
    revealTxid,
    partialCount: partials.length,
    contentBytes: content.length,
    contentType: ct,
    totalFeeSatoshis: totalFees,
    inscriptionReceiveAddress: inscriptionReceiveDisplay,
  };
}

/** True if every input uses a sequence that allows BIP-125 replacement (not final 0xffffffff). */
export function rawDoginalTxSupportsRbf(rawHex: string): boolean {
  const tx = bitcoin.Transaction.fromHex(rawHex);
  return tx.ins.every((inp) => inp.sequence < 0xfffffffe);
}

type DoginalCarry = {
  txid: string;
  vout: number;
  value: number;
  lockScript: Buffer;
  partial: ScriptChunk[];
  p2shScript: Buffer;
};

function lockScriptAndPartialForStageSigning(
  stageIndex: number,
  stageKind: DoginalChainStage['kind'],
  partials: ScriptChunk[][],
  pubKeyBytes: Buffer,
): { lockScript: Buffer; partial: ScriptChunk[] } {
  const P = partials.length;
  if (stageKind === 'commit') {
    throw new Error(
      'In-browser fee bump for the commit tx is not implemented. Use Dogecoin Core bumpfee if that tx is in your wallet.',
    );
  }
  if (stageKind === 'reveal') {
    const partial = partials[P - 1]!;
    return { lockScript: buildLockScript(pubKeyBytes, partial), partial };
  }
  const prevPartialIdx = stageIndex - 1;
  if (prevPartialIdx < 0 || prevPartialIdx >= P) {
    throw new Error('Invalid link stage index for fee bump signing');
  }
  const partial = partials[prevPartialIdx]!;
  return { lockScript: buildLockScript(pubKeyBytes, partial), partial };
}

function findP2pkhChangeOutputIndexForBump(
  tx: bitcoin.Transaction,
  fromAddress: string,
  stageKind: DoginalChainStage['kind'],
): number {
  const p2pkhPay = bitcoin.payments.p2pkh({ address: fromAddress, network: DOGE_NETWORK });
  const expected = p2pkhPay.output!;
  const candidates: number[] = [];
  for (let o = 0; o < tx.outs.length; o++) {
    if (Buffer.from(tx.outs[o].script).equals(expected) && tx.outs[o].value >= BigInt(DUST_SATS)) {
      candidates.push(o);
    }
  }
  if (candidates.length === 0) {
    throw new Error('No P2PKH change output found to subtract fee from. Try re-signing the chain with a higher fee rate.');
  }
  if (stageKind === 'link') {
    return candidates.reduce((best, o) => (tx.outs[o].value > tx.outs[best].value ? o : best), candidates[0]!);
  }
  const inscriptionBig = BigInt(INSCRIPTION_DEST_AMOUNT);
  const changeCands = candidates.filter((o) => tx.outs[o].value > inscriptionBig);
  if (changeCands.length === 0) {
    throw new Error('Reveal transaction has no separate change output to bump the fee.');
  }
  return changeCands.reduce((best, o) => (tx.outs[o].value > tx.outs[best].value ? o : best), changeCands[0]!);
}

/**
 * Increase fee by reducing a P2PKH change output; re-signs P2SH input 0 and wallet P2PKH inputs.
 */
export async function bumpSignedDoginalStageFee(params: {
  stage: DoginalChainStage;
  stageIndex: number;
  content: Buffer;
  contentType: string;
  fromAddress: string;
  privateKeyWIF: string;
  targetFeeRateKoinuPerKb: number;
}): Promise<{ txHex: string; txid: string; feeSatoshis: number }> {
  const { stage, stageIndex, content, contentType, fromAddress, privateKeyWIF, targetFeeRateKoinuPerKb } = params;
  const ct = contentType.trim();
  const partials = splitIntoPartials(content, ct);
  if (!rawDoginalTxSupportsRbf(stage.txHex)) {
    throw new Error(
      'This transaction was signed with final sequences (no RBF). Re-sign the whole chain in Dojakweb to enable fee bumps, or use a wallet/Core path that supports replacement.',
    );
  }

  const privKeyBytes = decodePrivateKeyFromWIF(privateKeyWIF);
  const pubKeyBytes = Buffer.from(secp.getPublicKey(privKeyBytes, true));
  const p2pkhPay = bitcoin.payments.p2pkh({ address: fromAddress, network: DOGE_NETWORK });
  const p2pkhPrevScript = p2pkhPay.output!;

  const tx = bitcoin.Transaction.fromHex(stage.txHex);
  if (tx.getId() !== stage.txid) {
    throw new Error('Stage txid does not match hex (corrupt session?)');
  }

  const vsize = tx.virtualSize();
  const targetTotalFee = feeFor(vsize, targetFeeRateKoinuPerKb);
  const currentFee = stage.feeSatoshis;
  const delta = Math.max(
    Math.ceil(targetTotalFee - currentFee),
    Math.ceil(currentFee * 0.25),
    500_000,
  );

  const changeIdx = findP2pkhChangeOutputIndexForBump(tx, fromAddress, stage.kind);
  const prevVal = Number(tx.outs[changeIdx].value);
  if (!Number.isFinite(prevVal) || prevVal - delta < DUST_SATS) {
    throw new Error('Change output too small for this fee increase. Raise the fee rate target or add funds.');
  }
  tx.outs[changeIdx].value = BigInt(prevVal - delta);

  for (const inp of tx.ins) {
    inp.script = Buffer.alloc(0);
  }

  const { lockScript, partial } = lockScriptAndPartialForStageSigning(
    stageIndex,
    stage.kind,
    partials,
    pubKeyBytes,
  );
  const insEnd = tx.ins.length - 1;
  if (insEnd >= 1) {
    await signP2pkhInputs(tx, 1, insEnd, privKeyBytes, Buffer.from(p2pkhPrevScript));
  }
  await signP2shRevealInput(tx, 0, lockScript, partial, privKeyBytes);

  const txHex = tx.toHex();
  const txid = bitcoin.Transaction.fromHex(txHex).getId();
  const newFee = Math.max(targetTotalFee, currentFee + delta);
  return { txHex, txid, feeSatoshis: newFee };
}

function aggregatePlanMeta(
  stages: DoginalChainStage[],
  content: Buffer,
  contentType: string,
  partialCount: number,
  inscriptionReceiveAddress: string,
): Pick<
  DoginalChainResult,
  | 'inscriptionId'
  | 'revealTxid'
  | 'partialCount'
  | 'contentBytes'
  | 'contentType'
  | 'totalFeeSatoshis'
  | 'inscriptionReceiveAddress'
> {
  const last = stages[stages.length - 1]!;
  const revealTxid = last.txid;
  return {
    inscriptionId: `${revealTxid}i0`,
    revealTxid,
    partialCount,
    contentBytes: content.length,
    contentType,
    totalFeeSatoshis: stages.reduce((a, s) => a + s.feeSatoshis, 0),
    inscriptionReceiveAddress,
  };
}

/**
 * After stage `bumpedStageIndex` was fee-bumped (new txid/hex), rebuilds all following signed txs so they spend the new parent.
 */
export async function resignDoginalChainTailAfterBumpedStage(params: {
  stagesPrefix: DoginalChainStage[];
  bumpedStageIndex: number;
  content: Buffer;
  contentType: string;
  fromAddress: string;
  privateKeyWIF: string;
  feeRate: number;
  excludedOutpoints?: string[];
  inscriptionReceiveAddress?: string;
}): Promise<DoginalChainResult> {
  const {
    stagesPrefix,
    bumpedStageIndex,
    content,
    contentType,
    fromAddress,
    privateKeyWIF,
    feeRate,
    excludedOutpoints,
    inscriptionReceiveAddress: inscriptionReceiveRaw,
  } = params;

  const ct = contentType.trim();
  const partials = splitIntoPartials(content, ct);
  const P = partials.length;
  const inscriptionReceiveDisplay = (inscriptionReceiveRaw?.trim() || fromAddress).trim();
  const { scriptPubKey: inscriptionScriptPubKey } = parseDogecoinReceiveAddress(inscriptionReceiveDisplay);
  if (stagesPrefix.length !== P + 1) {
    throw new Error('Saved plan does not match this file’s partial count.');
  }
  if (bumpedStageIndex < 0 || bumpedStageIndex > P) {
    throw new Error('Invalid bumped stage index.');
  }
  if (bumpedStageIndex >= P) {
    const meta = aggregatePlanMeta(stagesPrefix, content, ct, partials.length, inscriptionReceiveDisplay);
    return { stages: stagesPrefix.map((s, idx) => ({ ...s, index: idx })), ...meta };
  }

  const privKeyBytes = decodePrivateKeyFromWIF(privateKeyWIF);
  const pubKeyBytes = Buffer.from(secp.getPublicKey(privKeyBytes, true));
  const p2pkhPay = bitcoin.payments.p2pkh({ address: fromAddress, network: DOGE_NETWORK });
  const p2pkhPrevScript = p2pkhPay.output!;
  const changeScriptPubKey = Buffer.from(p2pkhPrevScript);

  const bumpedHex = stagesPrefix[bumpedStageIndex]!.txHex;
  const bumpedTx = bitcoin.Transaction.fromHex(bumpedHex);
  if (bumpedTx.getId() !== stagesPrefix[bumpedStageIndex]!.txid) {
    throw new Error('Bumped stage txid/hex mismatch.');
  }

  const partialForOut = partials[bumpedStageIndex]!;
  const lockScript0 = buildLockScript(pubKeyBytes, partialForOut);
  const p2shScript0 = buildP2shOutputScript(lockScript0);
  const out0 = bumpedTx.outs[0];
  if (!out0 || !Buffer.from(out0.script).equals(p2shScript0)) {
    throw new Error('Bumped tx output 0 is not the expected inscription P2SH carry.');
  }

  let pool = filterExcluded(await fetchUtxosWithRetry(fromAddress), excludedOutpoints);
  for (let j = 0; j <= bumpedStageIndex; j++) {
    const tx = bitcoin.Transaction.fromHex(stagesPrefix[j]!.txHex);
    pool = removeSpentInTx(pool, tx);
    pool = addOurP2pkhChange(pool, tx, Buffer.from(p2pkhPrevScript));
  }

  let carry: DoginalCarry = {
    txid: bumpedTx.getId(),
    vout: 0,
    value: Number(out0.value),
    lockScript: lockScript0,
    partial: partialForOut,
    p2shScript: p2shScript0,
  };

  const stages: DoginalChainStage[] = stagesPrefix.slice(0, bumpedStageIndex + 1);
  let totalFees = stages.reduce((a, s) => a + s.feeSatoshis, 0);

  for (let i = bumpedStageIndex + 1; i < P; i++) {
    const partial = partials[i]!;
    const lockScript = buildLockScript(pubKeyBytes, partial);
    const p2shScript = buildP2shOutputScript(lockScript);
    const nextP2sh =
      i < P - 1 ? buildP2shOutputScript(buildLockScript(pubKeyBytes, partials[i + 1]!)) : null;
    const p2shAmount = computeP2shAmountForPartial(
      partial,
      lockScript,
      feeRate,
      nextP2sh,
      inscriptionScriptPubKey,
      changeScriptPubKey,
    );

    const sorted = [...pool].sort((a, b) => b.value - a.value);
    let selected: NormalisedUtxo[] = [];
    let linkTx: bitcoin.Transaction | null = null;
    let linkFee = 0;

    for (let tries = 0; tries < 40; tries++) {
      let sumW = 0;
      selected = [];
      linkFee = feeFor(estimateLinkBytes(0, carry.partial, carry.lockScript), feeRate);
      for (const u of sorted) {
        if (!Number.isFinite(u.value) || u.value <= 0) continue;
        selected.push(u);
        sumW += u.value;
        linkFee = feeFor(estimateLinkBytes(selected.length, carry.partial, carry.lockScript), feeRate);
        if (carry.value + sumW >= p2shAmount + linkFee + DUST_SATS) break;
      }
      if (carry.value + sumW < p2shAmount + linkFee) {
        throw new Error('Insufficient funds to re-sign inscription link after fee bump.');
      }

      const changeAmt = carry.value + sumW - p2shAmount - linkFee;
      linkTx = new bitcoin.Transaction();
      linkTx.version = 1;
      linkTx.addInput(Buffer.from(carry.txid, 'hex').reverse(), carry.vout, RBF_SEQUENCE);
      for (const u of selected) {
        linkTx.addInput(Buffer.from(u.tx_hash, 'hex').reverse(), u.tx_output_n, RBF_SEQUENCE);
      }
      linkTx.addOutput(p2shScript, BigInt(p2shAmount));
      if (changeAmt >= DUST_SATS) {
        linkTx.addOutput(Buffer.from(p2pkhPrevScript), BigInt(changeAmt));
      }

      const insEnd = linkTx.ins.length - 1;
      if (insEnd >= 1) {
        await signP2pkhInputs(linkTx, 1, insEnd, privKeyBytes, Buffer.from(p2pkhPrevScript));
      }
      await signP2shRevealInput(linkTx, 0, carry.lockScript, carry.partial, privKeyBytes);

      const vsize = linkTx.virtualSize();
      const needFee = feeFor(vsize, feeRate);
      if (needFee <= linkFee) break;
      linkFee = needFee;
    }

    if (!linkTx) throw new Error('Failed to rebuild link after bump.');
    const linkHex = linkTx.toHex();
    const linkTxid = bitcoin.Transaction.fromHex(linkHex).getId();

    stages.push({
      index: stages.length,
      kind: 'link',
      txHex: linkHex,
      txid: linkTxid,
      feeSatoshis: linkFee,
    });
    totalFees += linkFee;
    pool = addOurP2pkhChange(removeSpentInTx(pool, linkTx), linkTx, Buffer.from(p2pkhPrevScript));
    carry = { txid: linkTxid, vout: 0, value: p2shAmount, lockScript, partial, p2shScript };
  }

  const sorted = [...pool].sort((a, b) => b.value - a.value);
  let selected: NormalisedUtxo[] = [];
  let finalTx: bitcoin.Transaction | null = null;
  let finalFee = 0;

  for (let tries = 0; tries < 40; tries++) {
    let sumW = 0;
    selected = [];
    finalFee = feeFor(
      estimateFinalRevealTxBytes(
        0,
        carry.partial,
        carry.lockScript,
        inscriptionScriptPubKey,
        changeScriptPubKey,
        true,
      ),
      feeRate,
    );
    for (const u of sorted) {
      if (!Number.isFinite(u.value) || u.value <= 0) continue;
      selected.push(u);
      sumW += u.value;
      finalFee = feeFor(
        estimateFinalRevealTxBytes(
          selected.length,
          carry.partial,
          carry.lockScript,
          inscriptionScriptPubKey,
          changeScriptPubKey,
          true,
        ),
        feeRate,
      );
      if (carry.value + sumW >= INSCRIPTION_DEST_AMOUNT + finalFee + DUST_SATS) break;
    }
    if (carry.value + sumW < INSCRIPTION_DEST_AMOUNT + finalFee) {
      throw new Error('Insufficient funds to re-sign final reveal after fee bump.');
    }
    const changeAmt = carry.value + sumW - INSCRIPTION_DEST_AMOUNT - finalFee;

    finalTx = new bitcoin.Transaction();
    finalTx.version = 1;
    finalTx.addInput(Buffer.from(carry.txid, 'hex').reverse(), carry.vout, RBF_SEQUENCE);
    for (const u of selected) {
      finalTx.addInput(Buffer.from(u.tx_hash, 'hex').reverse(), u.tx_output_n, RBF_SEQUENCE);
    }
    finalTx.addOutput(Buffer.from(inscriptionScriptPubKey), BigInt(INSCRIPTION_DEST_AMOUNT));
    if (changeAmt >= DUST_SATS) {
      finalTx.addOutput(Buffer.from(changeScriptPubKey), BigInt(changeAmt));
    }

    const insEnd = finalTx.ins.length - 1;
    if (insEnd >= 1) {
      await signP2pkhInputs(finalTx, 1, insEnd, privKeyBytes, Buffer.from(p2pkhPrevScript));
    }
    await signP2shRevealInput(finalTx, 0, carry.lockScript, carry.partial, privKeyBytes);

    const vsize = finalTx.virtualSize();
    const needFee = feeFor(vsize, feeRate);
    if (needFee <= finalFee) break;
    finalFee = needFee;
  }

  if (!finalTx) throw new Error('Failed to rebuild reveal after bump.');
  const revealHex = finalTx.toHex();
  const revealTxid = bitcoin.Transaction.fromHex(revealHex).getId();

  stages.push({
    index: stages.length,
    kind: 'reveal',
    txHex: revealHex,
    txid: revealTxid,
    feeSatoshis: finalFee,
  });
  totalFees += finalFee;

  const meta = aggregatePlanMeta(stages, content, ct, partials.length, inscriptionReceiveDisplay);
  return { stages, ...meta };
}
