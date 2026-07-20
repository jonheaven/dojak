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
import { DOGE_NETWORK, getTxHex } from './doginal-psdt';
import { DUST_LIMIT, FEE_RATE_KOINU_PER_BYTE } from './utxo-tools';

// ── Lock record (persisted in localStorage) ────────────────────────────────────

export interface CltvLockRecord {
  id: string;
  type: 'doge' | 'inscription';
  txid: string;
  vout: number;
  lockAddress: string;
  redeemScriptHex: string;
  locktimeUnix: number;
  amountKoinu: number;
  createdAt: number;
  inscriptionId?: string;
  inscriptionOutput?: string;
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
  return Math.max(100_000, txSize * FEE_RATE_KOINU_PER_BYTE);
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

  // Greedy UTXO selection (largest first, skip dust)
  const spendable = [...utxos].filter((u) => u.value > DUST_LIMIT).sort((a, b) => b.value - a.value);
  const selected: UtxoInput[] = [];
  let total = 0;
  for (const u of spendable) {
    selected.push(u);
    total += u.value;
    const fee = estimateLockFee(selected.length, 2);
    if (total >= amountKoinu + fee) break;
  }

  if (selected.length === 0) {
    throw new Error('No spendable UTXOs available');
  }

  const actualFee = estimateLockFee(selected.length, 2);
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

  // Select fee UTXOs (skip dust and the inscription UTXO itself)
  const spendableFee = [...feeUtxos]
    .filter((u) => u.value > DUST_LIMIT && !(u.txid === inscriptionUtxo.txid && u.vout === inscriptionUtxo.vout))
    .sort((a, b) => b.value - a.value);

  const selectedFee: UtxoInput[] = [];
  let feeTotal = 0;
  for (const u of spendableFee) {
    selectedFee.push(u);
    feeTotal += u.value;
    const fee = estimateLockFee(1 + selectedFee.length, 2);
    if (feeTotal >= fee) break;
  }

  const actualFee = estimateLockFee(1 + selectedFee.length, 2);
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

  // Output 1: change
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

  const redeemScript = Buffer.from(record.redeemScriptHex, 'hex');
  const lockTxHex = await getTxHex(record.txid);

  // P2SH spend is ~295 bytes input; single P2PKH output ~34 bytes; overhead 10.
  const txSize = 10 + 295 + 34;
  const fee = Math.max(100_000, txSize * FEE_RATE_KOINU_PER_BYTE);
  const outputAmount = record.amountKoinu - fee;

  if (outputAmount < DUST_LIMIT) {
    throw new Error(
      `Locked amount (${(record.amountKoinu / 1e8).toFixed(4)} DOGE) is too small to cover the unlock fee.`,
    );
  }

  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
  // nLockTime must be >= the CLTV script locktime.
  psbt.setLocktime(record.locktimeUnix);

  psbt.addInput({
    hash: record.txid,
    index: record.vout,
    nonWitnessUtxo: Buffer.from(lockTxHex, 'hex'),
    redeemScript,
    // nSequence must be < 0xffffffff to enable CLTV validation.
    sequence: 0xfffffffe,
  } as any);

  psbt.addOutput({ address: ownerAddress, value: BigInt(outputAmount) });

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
  });
  return `${baseUrl}/lock/proof?${params.toString()}`;
}
