/**
 * cltv-tools.ts
 *
 * OP_CHECKLOCKTIMEVERIFY (BIP65) helpers for Dogecoin time-locked outputs.
 *
 * Locking flow:
 *   1. buildCltvP2shAddress(locktimeUnix, ownerAddress) → { address, redeemScript }
 *   2. createTimeLockedTransaction() → { psbtBase64, ... }  (DOGE)
 *      createTimeLockedInscriptionTransaction() → { psbtBase64, ... }  (Doginal)
 *   3. wallet.signPSBT(psbtBase64) → rawTxHex
 *   4. coerceSignedPsdtToRawTxHex(rawTxHex) → rawTxHex (normalizes PSBT/tx)
 *   5. broadcastUtxoTx(rawTxHex) → txid
 *   6. saveCltvLock(address, record) → persists to localStorage
 *
 * Unlocking flow (after locktime expires):
 *   1. createUnlockTransaction(lockRecord, ownerAddress) → { psbtBase64, fee }
 *   2. wallet.signPSBT(psbtBase64) → signed
 *   3. coerceSignedPsdtToRawTxHex(signed) → rawTxHex
 *   4. broadcastUtxoTx(rawTxHex) → txid
 *
 * Redeem script: <locktime> OP_CLTV OP_DROP OP_DUP OP_HASH160 <pubkeyHash> OP_EQUALVERIFY OP_CHECKSIG
 */

import * as bitcoin from 'bitcoinjs-lib';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
} from './broadcast/dogecoinTxBroadcast';
import { HARD_DUST_KOINU, SOFT_DUST_KOINU, softDustFeePenaltyKoinu } from './dogecoin/softDust';
import { DOGE_NETWORK, getTxHex } from './doginal-psdt';
import { mergePaymentUtxos } from './mempoolSpendOverlay';
import { DUST_LIMIT, FEE_RATE_KOINU_PER_BYTE } from './utxo-tools';

// ── Lock record (persisted in localStorage) ────────────────────────────────────

export interface CltvLockRecord {
  id: string;
  type: 'doge' | 'inscription' | 'dune';
  txid: string;
  vout: number;
  lockAddress: string;
  redeemScriptHex: string;
  locktimeUnix: number;
  amountKoinu: number;
  createdAt: number;
  inscriptionId?: string;
  inscriptionOutput?: string;
  duneId?: string;
  duneAmount?: string;
  duneName?: string;
}

const CLTV_LOCKS_KEY_PREFIX = 'dojakweb-cltv-locks-';

export function loadCltvLocks(address: string): CltvLockRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${CLTV_LOCKS_KEY_PREFIX}${address}`);
    return raw ? (JSON.parse(raw) as CltvLockRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveCltvLock(address: string, record: CltvLockRecord): void {
  if (typeof window === 'undefined') return;
  const existing = loadCltvLocks(address);
  existing.unshift(record); // newest first
  localStorage.setItem(`${CLTV_LOCKS_KEY_PREFIX}${address}`, JSON.stringify(existing));
}

export function removeCltvLock(address: string, id: string): void {
  if (typeof window === 'undefined') return;
  const filtered = loadCltvLocks(address).filter((r) => r.id !== id);
  localStorage.setItem(`${CLTV_LOCKS_KEY_PREFIX}${address}`, JSON.stringify(filtered));
}

// ── Duration helpers ───────────────────────────────────────────────────────────

export const LOCK_PRESETS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '180 days', days: 180 },
  { label: '1 year', days: 365 },
] as const;

export function locktimeFromDays(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 86_400;
}

export function formatTimeRemaining(locktimeUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = locktimeUnix - now;
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / 86_400);
  const h = Math.floor((diff % 86_400) / 3_600);
  const m = Math.floor((diff % 3_600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Script building ────────────────────────────────────────────────────────────

/** Build a CLTV-P2PKH redeem script from a locktime and 20-byte pubkeyHash. */
export function buildCltvRedeemScript(locktimeUnix: number, pubkeyHash: Buffer): Buffer {
  return bitcoin.script.compile([
    bitcoin.script.number.encode(locktimeUnix),
    bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_HASH160,
    pubkeyHash,
    bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);
}

/**
 * Same-tx OP_RETURN announce so dogex (and any indexer) can discover the lock
 * without client registration. Payload: ASCII `CLTV` || u32 LE locktime || 20-byte pkh.
 */
export function buildCltvAnnouncePayload(locktimeUnix: number, pubkeyHash: Buffer): Buffer {
  const buf = Buffer.alloc(28);
  buf.write('CLTV', 0, 4, 'ascii');
  buf.writeUInt32LE(locktimeUnix >>> 0, 4);
  buf.set(pubkeyHash.subarray(0, 20), 8);
  return buf;
}

export function buildCltvAnnounceScript(locktimeUnix: number, pubkeyHash: Buffer): Buffer {
  return bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, buildCltvAnnouncePayload(locktimeUnix, pubkeyHash)]);
}

/**
 * Derive the P2SH address and redeem script for a CLTV lock.
 * The lock can only be spent after `locktimeUnix` (Unix seconds) by `ownerAddress`.
 */
export function buildCltvP2shAddress(
  locktimeUnix: number,
  ownerAddress: string,
): { address: string; redeemScript: Buffer } {
  const decoded = bitcoin.address.fromBase58Check(ownerAddress);
  const pubkeyHash = Buffer.from(decoded.hash);
  const redeemScript = buildCltvRedeemScript(locktimeUnix, pubkeyHash);
  const p2sh = bitcoin.payments.p2sh({
    redeem: { output: redeemScript, network: DOGE_NETWORK },
    network: DOGE_NETWORK,
  });
  if (!p2sh.address) throw new Error('Failed to derive P2SH CLTV address');
  return { address: p2sh.address, redeemScript };
}

// ── Fee estimation ─────────────────────────────────────────────────────────────

function estimateLockFee(inputCount: number, outputCount: number): number {
  const txSize = 10 + inputCount * 148 + outputCount * 34;
  return Math.max(HARD_DUST_KOINU, txSize * FEE_RATE_KOINU_PER_BYTE);
}

/** P2SH CLTV vin ~295 bytes; P2PKH vin ~148; P2PKH vout ~34. */
function estimateUnlockSize(p2pkhInputCount: number, outputCount: number): number {
  return 10 + 295 + p2pkhInputCount * 148 + outputCount * 34;
}

function estimateUnlockByteFee(p2pkhInputCount: number, outputCount: number): number {
  return Math.max(HARD_DUST_KOINU, estimateUnlockSize(p2pkhInputCount, outputCount) * FEE_RATE_KOINU_PER_BYTE);
}

function resolveUnlockRedeemScript(
  record: CltvLockRecord,
  ownerAddress: string,
  lockScript: Buffer,
): Buffer {
  const candidates: Buffer[] = [];
  if (record.redeemScriptHex && /^[0-9a-fA-F]+$/.test(record.redeemScriptHex) && record.redeemScriptHex.length >= 20) {
    candidates.push(Buffer.from(record.redeemScriptHex, 'hex'));
  }
  try {
    candidates.push(buildCltvP2shAddress(record.locktimeUnix, ownerAddress).redeemScript);
  } catch {
    /* owner address may not be P2PKH */
  }

  for (const redeem of candidates) {
    try {
      const p2sh = bitcoin.payments.p2sh({
        redeem: { output: redeem, network: DOGE_NETWORK },
        network: DOGE_NETWORK,
      }).output;
      if (p2sh && Buffer.from(p2sh).equals(lockScript)) return redeem;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Could not match the ÐLocker redeem script to this lock output. Reconnect the same address that created the lock.',
  );
}

async function selectUnlockFeeUtxos(ownerAddress: string): Promise<UtxoInput[]> {
  const all = await fetchSpendableUtxosConservativeForAddress(ownerAddress);
  const { safe } = await filterPaymentSpendableUtxos(ownerAddress, all);
  const merged = mergePaymentUtxos(
    ownerAddress,
    safe.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
  );
  return merged.filter((u) => u.value > DUST_LIMIT).sort((a, b) => b.value - a.value);
}

function combinedUnlockFit(
  lockValue: number,
  extra: number,
  p2pkhInputs: number,
): { ok: true; fee: number; output: number } | { ok: false } {
  const byteFee = estimateUnlockByteFee(p2pkhInputs, 1);
  const outputNoPenalty = lockValue + extra - byteFee;
  if (outputNoPenalty >= SOFT_DUST_KOINU) {
    return { ok: true, fee: byteFee, output: outputNoPenalty };
  }
  const fee = byteFee + softDustFeePenaltyKoinu([Math.max(outputNoPenalty, HARD_DUST_KOINU)]);
  const output = lockValue + extra - fee;
  if (output >= HARD_DUST_KOINU) return { ok: true, fee, output };
  return { ok: false };
}

function inscriptionUnlockFit(
  lockValue: number,
  extra: number,
  p2pkhInputs: number,
): { ok: true; fee: number; change: number } | { ok: false } {
  const postagePenalty = lockValue > 0 && lockValue < SOFT_DUST_KOINU ? SOFT_DUST_KOINU : 0;
  const feeWithChange = estimateUnlockByteFee(p2pkhInputs, 2) + postagePenalty;
  const change = extra - feeWithChange;
  if (change >= SOFT_DUST_KOINU) {
    return { ok: true, fee: feeWithChange, change };
  }
  const feeNoChange = estimateUnlockByteFee(p2pkhInputs, 1) + postagePenalty;
  if (extra >= feeNoChange) return { ok: true, fee: feeNoChange, change: 0 };
  return { ok: false };
}

// ── Transaction building ───────────────────────────────────────────────────────

export interface UtxoInput {
  txid: string;
  vout: number;
  value: number;
}

export interface UnlockTxResult {
  psbtBase64: string;
  fee: number;
  outputAmount: number;
}

export interface TimeLockedTxResult {
  psbtBase64: string;
  lockAddress: string;
  redeemScriptHex: string;
  fee: number;
  lockedAmount: number;
  locktimeUnix: number;
  lockExpiry: Date;
  changeAmount: number;
}

/**
 * Build a PSBT that sends DOGE to a CLTV P2SH lock address.
 * Inputs are standard P2PKH — compatible with all wallet signing methods.
 */
export async function createTimeLockedTransaction(params: {
  ownerAddress: string;
  amountKoinu: number;
  locktimeUnix: number;
  utxos: UtxoInput[];
}): Promise<TimeLockedTxResult> {
  const { ownerAddress, amountKoinu, locktimeUnix, utxos } = params;

  if (amountKoinu < DUST_LIMIT) {
    throw new Error(`Minimum lock amount is ${DUST_LIMIT / 1e8} DOGE (dust limit)`);
  }
  if (locktimeUnix <= Math.floor(Date.now() / 1000)) {
    throw new Error('Lock time must be in the future');
  }

  const { address: lockAddress, redeemScript } = buildCltvP2shAddress(locktimeUnix, ownerAddress);
  const decoded = bitcoin.address.fromBase58Check(ownerAddress);
  const pubkeyHash = Buffer.from(decoded.hash);
  const announceScript = buildCltvAnnounceScript(locktimeUnix, pubkeyHash);

  // Greedy UTXO selection (largest first, skip dust)
  // Outputs: lock + OP_RETURN announce (+ optional change) → fee uses 3 outs max.
  const spendable = [...utxos].filter((u) => u.value > DUST_LIMIT).sort((a, b) => b.value - a.value);
  const selected: UtxoInput[] = [];
  let total = 0;
  for (const u of spendable) {
    selected.push(u);
    total += u.value;
    const fee = estimateLockFee(selected.length, 3);
    if (total >= amountKoinu + fee) break;
  }

  if (selected.length === 0) {
    throw new Error('No spendable UTXOs available');
  }

  const actualFee = estimateLockFee(selected.length, 3);
  if (total < amountKoinu + actualFee) {
    throw new Error(
      `Insufficient balance. Need ${((amountKoinu + actualFee) / 1e8).toFixed(4)} DOGE, have ${(total / 1e8).toFixed(4)} DOGE`,
    );
  }

  const change = total - amountKoinu - actualFee;
  const hasChange = change >= DUST_LIMIT;

  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });

  for (const u of selected) {
    const txHex = await getTxHex(u.txid);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
      sequence: 0xffffffff,
    } as any);
  }

  psbt.addOutput({ address: lockAddress, value: BigInt(amountKoinu) });
  psbt.addOutput({ script: announceScript, value: BigInt(0) });
  if (hasChange) {
    psbt.addOutput({ address: ownerAddress, value: BigInt(change) });
  }

  return {
    psbtBase64: psbt.toBase64(),
    lockAddress,
    redeemScriptHex: Buffer.from(redeemScript).toString('hex'),
    fee: actualFee,
    lockedAmount: amountKoinu,
    locktimeUnix,
    lockExpiry: new Date(locktimeUnix * 1000),
    changeAmount: hasChange ? change : 0,
  };
}

/**
 * Build a PSBT that moves a Doginal inscription to a CLTV P2SH lock address.
 * Output 0 receives the inscription at the same value (preserves ordinal tracking).
 * Additional UTXOs cover the fee.
 */
export async function createTimeLockedInscriptionTransaction(params: {
  ownerAddress: string;
  inscriptionUtxo: UtxoInput;
  locktimeUnix: number;
  feeUtxos: UtxoInput[];
}): Promise<TimeLockedTxResult> {
  const { ownerAddress, inscriptionUtxo, locktimeUnix, feeUtxos } = params;

  if (locktimeUnix <= Math.floor(Date.now() / 1000)) {
    throw new Error('Lock time must be in the future');
  }

  const { address: lockAddress, redeemScript } = buildCltvP2shAddress(locktimeUnix, ownerAddress);
  const decoded = bitcoin.address.fromBase58Check(ownerAddress);
  const pubkeyHash = Buffer.from(decoded.hash);
  const announceScript = buildCltvAnnounceScript(locktimeUnix, pubkeyHash);

  // Select fee UTXOs (skip dust and the inscription UTXO itself)
  const spendableFee = [...feeUtxos]
    .filter((u) => u.value > DUST_LIMIT && !(u.txid === inscriptionUtxo.txid && u.vout === inscriptionUtxo.vout))
    .sort((a, b) => b.value - a.value);

  const selectedFee: UtxoInput[] = [];
  let feeTotal = 0;
  for (const u of spendableFee) {
    selectedFee.push(u);
    feeTotal += u.value;
    const fee = estimateLockFee(1 + selectedFee.length, 3);
    if (feeTotal >= fee) break;
  }

  const actualFee = estimateLockFee(1 + selectedFee.length, 3);
  if (feeTotal < actualFee) {
    throw new Error(
      `Insufficient DOGE for fees. Need ~${(actualFee / 1e8).toFixed(4)} DOGE in plain UTXOs.`,
    );
  }

  const change = feeTotal - actualFee;
  const hasChange = change >= DUST_LIMIT;

  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });

  // Input 0: the inscription UTXO
  const insTxHex = await getTxHex(inscriptionUtxo.txid);
  psbt.addInput({
    hash: inscriptionUtxo.txid,
    index: inscriptionUtxo.vout,
    nonWitnessUtxo: Buffer.from(insTxHex, 'hex'),
    sequence: 0xffffffff,
  } as any);

  // Additional fee inputs
  for (const u of selectedFee) {
    const txHex = await getTxHex(u.txid);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
      sequence: 0xffffffff,
    } as any);
  }

  // Output 0: locked inscription at same value (preserves ordinal offset)
  psbt.addOutput({ address: lockAddress, value: BigInt(inscriptionUtxo.value) });
  // Output 1: dogex-discoverable CLTV announce
  psbt.addOutput({ script: announceScript, value: BigInt(0) });

  // Output 2: change
  if (hasChange) {
    psbt.addOutput({ address: ownerAddress, value: BigInt(change) });
  }

  return {
    psbtBase64: psbt.toBase64(),
    lockAddress,
    redeemScriptHex: Buffer.from(redeemScript).toString('hex'),
    fee: actualFee,
    lockedAmount: inscriptionUtxo.value,
    locktimeUnix,
    lockExpiry: new Date(locktimeUnix * 1000),
    changeAmount: hasChange ? change : 0,
  };
}

/**
 * Build a PSBT that spends a CLTV P2SH output back to the owner.
 * Can only be broadcast after nLockTime >= locktimeUnix on-chain.
 *
 * Ðune / postage locks are 0.001 Ð carriers — they cannot pay the unlock fee
 * alone. Extra P2PKH coins from `ownerAddress` cover fee + soft-dust.
 */
export async function createUnlockTransaction(params: {
  ownerAddress: string;
  record: CltvLockRecord;
}): Promise<UnlockTxResult> {
  const { ownerAddress, record } = params;

  const nowUnix = Math.floor(Date.now() / 1000);
  if (nowUnix < record.locktimeUnix) {
    const remaining = formatTimeRemaining(record.locktimeUnix);
    throw new Error(`Lock has not expired yet. ${remaining} remaining.`);
  }

  const lockTxHex = await getTxHex(record.txid);
  const lockTx = bitcoin.Transaction.fromHex(lockTxHex);
  const prev = lockTx.outs[record.vout];
  if (!prev) {
    throw new Error(`Lock output ${record.txid}:${record.vout} is missing from the lock transaction.`);
  }
  const lockValue = Number(prev.value);
  const lockScript = Buffer.from(prev.script);
  const redeemScript = resolveUnlockRedeemScript(record, ownerAddress, lockScript);

  const preserveInscription = record.type === 'inscription';
  const selected: UtxoInput[] = [];
  let extra = 0;
  let fee = 0;
  let outputAmount = 0;
  let changeAmount = 0;

  const selfFunded = !preserveInscription ? combinedUnlockFit(lockValue, 0, 0) : { ok: false as const };
  if (selfFunded.ok) {
    fee = selfFunded.fee;
    outputAmount = selfFunded.output;
  } else {
    const pool = await selectUnlockFeeUtxos(ownerAddress);
    const takeNext = (): boolean => {
      const next = pool.find(
        (u) =>
          !(u.txid === record.txid && u.vout === record.vout) &&
          !selected.some((s) => s.txid === u.txid && s.vout === u.vout),
      );
      if (!next) return false;
      selected.push(next);
      extra += next.value;
      return true;
    };

    if (preserveInscription) {
      let ins = inscriptionUnlockFit(lockValue, extra, selected.length);
      while (!ins.ok && takeNext()) {
        ins = inscriptionUnlockFit(lockValue, extra, selected.length);
      }
      if (!ins.ok) {
        throw new Error(
          'Unlock needs extra DOGE in this wallet to cover fees (the inscription postage cannot pay the spend). Send ~0.02 Ð here and try again.',
        );
      }
      fee = ins.fee;
      outputAmount = lockValue;
      changeAmount = ins.change;
    } else {
      let comb = combinedUnlockFit(lockValue, extra, selected.length);
      while (!comb.ok && takeNext()) {
        comb = combinedUnlockFit(lockValue, extra, selected.length);
      }
      if (!comb.ok) {
        throw new Error(
          'Unlock needs extra DOGE in this wallet to cover fees (Ðune lock coins are 0.001 Ð postage). Send ~0.02 Ð here and try again.',
        );
      }
      fee = comb.fee;
      outputAmount = comb.output;
    }
  }

  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
  psbt.setVersion(1);
  psbt.setLocktime(record.locktimeUnix);

  psbt.addInput({
    hash: record.txid,
    index: record.vout,
    nonWitnessUtxo: Buffer.from(lockTxHex, 'hex'),
    redeemScript,
    sequence: 0xfffffffe,
  } as any);

  for (const u of selected) {
    const txHex = await getTxHex(u.txid);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
      sequence: 0xffffffff,
    } as any);
  }

  psbt.addOutput({ address: ownerAddress, value: BigInt(outputAmount) });
  if (preserveInscription && changeAmount >= SOFT_DUST_KOINU) {
    psbt.addOutput({ address: ownerAddress, value: BigInt(changeAmount) });
  }

  return { psbtBase64: psbt.toBase64(), fee, outputAmount };
}

/** Build a shareable proof URL for a lock record. */
export function buildProofUrl(record: CltvLockRecord, baseUrl = ''): string {
  const params = new URLSearchParams({
    txid: record.txid,
    vout: String(record.vout),
    type: record.type,
    amount: String(record.amountKoinu),
    locktime: String(record.locktimeUnix),
    address: record.lockAddress,
    ...(record.inscriptionId ? { ins: record.inscriptionId } : {}),
    ...(record.duneId ? { dune: record.duneId } : {}),
    ...(record.duneAmount ? { duneAmt: record.duneAmount } : {}),
    ...(record.duneName ? { duneName: record.duneName } : {}),
    ...(record.createdAt ? { lockedAt: String(record.createdAt) } : {}),
  });
  return `${baseUrl}/lock/proof?${params.toString()}`;
}
