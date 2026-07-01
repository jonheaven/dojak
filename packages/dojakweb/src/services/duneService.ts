/**
 * Dune transaction builder — etch, mint, and send dunes on Dogecoin.
 *
 * Each function builds, signs, and optionally broadcasts a raw transaction.
 * Uses the same infrastructure as the existing OP_RETURN (Dogetag) path:
 * - UTXO fetching via MyDoge/Blockchair/BlockCypher intersection
 * - DogeMemoryWallet + createP2PKHTransaction from doge-sdk for signing
 * - lib/broadcast/dogecoinTxBroadcast (relay + verification)
 */

import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterSafeSpendableUtxos,
  type NormalisedUtxo,
} from '../lib/broadcast/dogecoinTxBroadcast';
import { broadcastTx, coerceSignedPsdtToRawTxHex, getTxHex } from '../lib/doginal-psdt';
import type { DuneTxSigner } from '../lib/dune-tx-signer';
import { assertDuneTxSigner } from '../lib/dune-tx-signer';
import {
  buildEtchScript,
  buildMintScript,
  buildSendScript,
  parseSpacedDune,
  type DuneTerms,
} from '../lib/dunestone';

// ── Constants ────────────────────────────────────────────────────────────────

/** Minimum relay fee floor (koinu). All transactions must pay at least this. */
const MIN_FEE_KOINU = 100_000;

/** Minimum postage for a dune-bearing output (koinu = 0.001 DOGE). */
const POSTAGE_KOINU = 100_000;

/** Byte size estimates for fee calculation. */
const TX_OVERHEAD      = 10;
const PER_INPUT_BYTES  = 148;
const PER_OUTPUT_BYTES = 34;

// ── Fee calculation ───────────────────────────────────────────────────────────

function estimateTxSize(inputCount: number, outputCount: number, opReturnBytes: number): number {
  // OP_RETURN output: value (8) + script_len varint (1) + script bytes
  const opReturnOutputSize = 9 + opReturnBytes;
  return TX_OVERHEAD
    + inputCount * PER_INPUT_BYTES
    + (outputCount - 1) * PER_OUTPUT_BYTES  // non-OP_RETURN outputs
    + opReturnOutputSize;
}

function calcFee(inputCount: number, outputCount: number, opReturnBytes: number, feeRate: number): number {
  const size = estimateTxSize(inputCount, outputCount, opReturnBytes);
  return Math.max(MIN_FEE_KOINU, Math.ceil((size * feeRate) / 1000));
}

// ── UTXO coin selection ───────────────────────────────────────────────────────

interface CoinSelection {
  selected: NormalisedUtxo[];
  totalSats: number;
  feeSatoshis: number;
  changeSatoshis: number;
}

function selectCoins(
  utxos: NormalisedUtxo[],
  requiredOutputSats: number,  // non-OP_RETURN outputs total
  outputCount: number,         // total outputs including OP_RETURN
  opReturnBytes: number,
  feeRate: number,
): CoinSelection {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [];
  let totalSats = 0;
  let fee = calcFee(1, outputCount, opReturnBytes, feeRate);

  for (const utxo of sorted) {
    selected.push(utxo);
    totalSats += utxo.value;
    fee = calcFee(selected.length, outputCount, opReturnBytes, feeRate);
    const needed = fee + requiredOutputSats + MIN_FEE_KOINU; // MIN_FEE_KOINU as change dust guard
    if (totalSats >= needed) break;
  }

  const needed = fee + requiredOutputSats;
  if (totalSats < needed) {
    const shortfall = ((needed - totalSats) / 1e8).toFixed(4);
    throw new Error(
      `Insufficient funds: need ${(needed / 1e8).toFixed(4)} DOGE, have ${(totalSats / 1e8).toFixed(4)} DOGE (short ${shortfall} DOGE).`,
    );
  }

  const changeSatoshis = totalSats - needed;
  return { selected, totalSats, feeSatoshis: fee, changeSatoshis };
}

// ── Transaction builder ───────────────────────────────────────────────────────

interface SignTxParams {
  fromAddress: string;
  privateKeyWIF: string;
  opReturnScript: Uint8Array;
  extraOutputs: Array<{ address: string; value: number }>;
  utxos: NormalisedUtxo[];
  feeRate: number;
}

interface BuiltTx {
  rawHex: string;
  feeSatoshis: number;
  changeSatoshis: number;
  inputCount: number;
}

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

interface BuildDuneTxParams {
  fromAddress: string;
  opReturnScript: Uint8Array;
  extraOutputs: Array<{ address: string; value: number }>;
  utxos: NormalisedUtxo[];
  feeRate: number;
}

function planDuneTx(params: BuildDuneTxParams) {
  const { fromAddress, opReturnScript, extraOutputs, utxos, feeRate } = params;
  const requiredOutputSats = extraOutputs.reduce((s, o) => s + o.value, 0);
  const estOutputCount = 1 + extraOutputs.length + 1;

  const { selected, feeSatoshis, changeSatoshis } = selectCoins(
    utxos,
    requiredOutputSats,
    estOutputCount,
    opReturnScript.length,
    feeRate,
  );

  const outputs: Array<{ value: number; script?: Uint8Array; address?: string }> = [
    { value: 0, script: opReturnScript },
    ...extraOutputs,
  ];

  if (changeSatoshis >= MIN_FEE_KOINU) {
    outputs.push({ address: fromAddress, value: changeSatoshis });
  }

  return { selected, feeSatoshis, changeSatoshis, outputs };
}

async function buildDunePsbt(params: BuildDuneTxParams): Promise<{ psbtBase64: string; feeSatoshis: number; changeSatoshis: number; inputCount: number }> {
  const { selected, feeSatoshis, changeSatoshis, outputs } = planDuneTx(params);
  const rawTxHexes = await Promise.all(selected.map((u) => getTxHex(u.tx_hash)));

  const bitcoin = await import('bitcoinjs-lib');
  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
  psbt.setVersion(1);

  for (let i = 0; i < selected.length; i++) {
    const u = selected[i];
    psbt.addInput({
      hash: u.tx_hash,
      index: u.tx_output_n,
      nonWitnessUtxo: Buffer.from(rawTxHexes[i], 'hex'),
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
    });
  }

  for (const o of outputs) {
    if (o.script) {
      psbt.addOutput({ script: Buffer.from(o.script), value: BigInt(o.value) } as any);
    } else if (o.address) {
      psbt.addOutput({ address: o.address, value: BigInt(o.value) } as any);
    }
  }

  return {
    psbtBase64: psbt.toBase64(),
    feeSatoshis,
    changeSatoshis,
    inputCount: selected.length,
  };
}

async function buildAndSign(params: SignTxParams): Promise<BuiltTx> {
  const { fromAddress, privateKeyWIF, opReturnScript, extraOutputs, utxos, feeRate } = params;
  const { selected, feeSatoshis, changeSatoshis, outputs } = planDuneTx({
    fromAddress,
    opReturnScript,
    extraOutputs,
    utxos,
    feeRate,
  });

  const signer = DogeMemoryWallet.fromWIF(privateKeyWIF, 'doge');
  const txBuilder = createP2PKHTransaction(signer, {
    address: fromAddress,
    inputs: selected.map(u => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
    outputs: outputs as any,
  });

  const signedTx = await txBuilder.finalizeAndSign();
  return {
    rawHex: signedTx.toHex(),
    feeSatoshis,
    changeSatoshis,
    inputCount: selected.length,
  };
}

async function signDuneTransaction(
  signer: DuneTxSigner,
  opReturnScript: Uint8Array,
  extraOutputs: Array<{ address: string; value: number }>,
  feeRate: number,
): Promise<BuiltTx> {
  assertDuneTxSigner(signer);
  const utxos = await getSpendableUtxos(signer.fromAddress);
  const buildParams: BuildDuneTxParams = {
    fromAddress: signer.fromAddress,
    opReturnScript,
    extraOutputs,
    utxos,
    feeRate,
  };

  if (signer.privateKeyWIF) {
    return buildAndSign({
      fromAddress: signer.fromAddress,
      privateKeyWIF: signer.privateKeyWIF,
      opReturnScript,
      extraOutputs,
      utxos,
      feeRate,
    });
  }

  if (signer.signPsbt) {
    const built = await buildDunePsbt(buildParams);
    const signedPayload = await signer.signPsbt(built.psbtBase64);
    const rawHex = coerceSignedPsdtToRawTxHex(signedPayload);
    return {
      rawHex,
      feeSatoshis: built.feeSatoshis,
      changeSatoshis: built.changeSatoshis,
      inputCount: built.inputCount,
    };
  }

  throw new Error('No signing method available for this wallet');
}

// ── Fetch + filter UTXOs ──────────────────────────────────────────────────────

async function getSpendableUtxos(address: string): Promise<NormalisedUtxo[]> {
  const all = await fetchSpendableUtxosConservativeForAddress(address);
  if (!all.length) throw new Error('No confirmed UTXOs found. Your wallet needs DOGE to pay the transaction fee.');
  const { safe } = filterSafeSpendableUtxos(address, all);
  if (!safe.length) {
    throw new Error('No safe spendable UTXOs. All UTXOs appear to be inscription-bearing (0.001 DOGE). Add plain DOGE to your wallet to cover fees.');
  }
  return safe;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EtchDuneParams {
  /** Dune name with optional spacers, e.g. "DOGE•COIN". */
  name: string;
  /** Total supply in human-readable form, e.g. "1000000". */
  supply: string;
  /** Decimal places (0-38). */
  divisibility: number;
  /** Optional single-char symbol. */
  symbol?: string;
  /** Open-mint terms (omit to deploy without minting). */
  terms?: DuneTerms;
  /** Enable turbo flag. */
  turbo?: boolean;
  /** Fee rate in koinu/kB (default: 1000 = 1 sat/byte). */
  feeRate?: number;
  /** Browser WIF and/or extension PSBT signer (see resolveDuneTxSigner). */
  signer: DuneTxSigner;
  /** Set to false to build + return hex without broadcasting. */
  broadcast?: boolean;
}

export interface EtchResult {
  txHex: string;
  txid?: string;
  feeSatoshis: number;
  changeSatoshis: number;
}

/**
 * Build, sign, and optionally broadcast an etch (deploy) transaction.
 *
 * The entire token supply is premined to the sender's address unless
 * open-mint `terms` are provided.
 */
export async function etchDune(params: EtchDuneParams): Promise<EtchResult> {
  const {
    name, supply, divisibility, symbol, terms, turbo = false,
    feeRate = 1000, signer, broadcast = true,
  } = params;

  // Validate name
  parseSpacedDune(name); // throws on invalid chars

  // Convert human-readable supply to smallest units
  const supplyBig = humanToSmallestUnits(supply, divisibility);
  if (supplyBig < 0n) throw new Error('Supply must be non-negative');

  const opReturnScript = buildEtchScript(name, supplyBig, divisibility, symbol, terms, turbo);
  if (opReturnScript.length > 83) {
    throw new Error(`Dunestone is ${opReturnScript.length} bytes — exceeds the 83-byte OP_RETURN limit. Shorten the name or reduce parameters.`);
  }

  const extraOutputs = supplyBig > 0n && !terms
    ? [{ address: signer.fromAddress, value: POSTAGE_KOINU }]
    : [];

  const built = await signDuneTransaction(signer, opReturnScript, extraOutputs, feeRate);

  let txid: string | undefined;
  if (broadcast) {
    txid = await broadcastTx(built.rawHex);
  }

  return { txHex: built.rawHex, txid, feeSatoshis: built.feeSatoshis, changeSatoshis: built.changeSatoshis };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MintDuneParams {
  /** Dune ID in "block:tx" format, e.g. "5000000:12". */
  duneId: string;
  /**
   * Address that will receive the minted tokens.
   * Defaults to fromAddress.
   */
  destination?: string;
  /** Postage (koinu) to attach to the dune-bearing output. Default: 100 000. */
  postage?: number;
  /** Fee rate in koinu/kB (default: 1000). */
  feeRate?: number;
  signer: DuneTxSigner;
  broadcast?: boolean;
}

export interface MintResult {
  txHex: string;
  txid?: string;
  feeSatoshis: number;
}

/**
 * Build, sign, and optionally broadcast a mint transaction.
 *
 * The minted tokens go to `destination` (defaults to `fromAddress`).
 * The dune indexer credits the tokens to whichever address controls output 1.
 */
export async function mintDune(params: MintDuneParams): Promise<MintResult> {
  const {
    duneId, postage = POSTAGE_KOINU, feeRate = 1000,
    signer, broadcast = true,
  } = params;
  const destination = params.destination?.trim() || signer.fromAddress;

  if (postage < POSTAGE_KOINU) {
    throw new Error(`Postage must be at least ${POSTAGE_KOINU} koinu (0.001 DOGE) to avoid dust rejection.`);
  }

  const opReturnScript = buildMintScript(duneId);

  const built = await signDuneTransaction(
    signer,
    opReturnScript,
    [{ address: destination, value: postage }],
    feeRate,
  );

  let txid: string | undefined;
  if (broadcast) {
    txid = await broadcastTx(built.rawHex);
  }

  return { txHex: built.rawHex, txid, feeSatoshis: built.feeSatoshis };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SendDuneParams {
  /** Dune ID in "block:tx" format. */
  duneId: string;
  /** Human-readable amount, e.g. "100.5". */
  amount: string;
  /** Divisibility of the dune (needed to convert amount to smallest units). */
  divisibility: number;
  /** Recipient Dogecoin address. */
  recipientAddress: string;
  /** Postage to attach to the recipient output (koinu). Default: 100 000. */
  postage?: number;
  /** Fee rate in koinu/kB (default: 1000). */
  feeRate?: number;
  signer: DuneTxSigner;
  broadcast?: boolean;
}

export interface SendResult {
  txHex: string;
  txid?: string;
  feeSatoshis: number;
}

/**
 * Build, sign, and optionally broadcast a send (transfer) transaction.
 *
 * Creates an edict that moves `amount` dune tokens to `recipientAddress`.
 * The recipient output is at index 1 (after the OP_RETURN at index 0).
 */
export async function sendDune(params: SendDuneParams): Promise<SendResult> {
  const {
    duneId, amount, divisibility,
    recipientAddress, postage = POSTAGE_KOINU,
    feeRate = 1000, signer, broadcast = true,
  } = params;

  const amountBig = humanToSmallestUnits(amount, divisibility);
  if (amountBig <= 0n) throw new Error('Send amount must be greater than zero');

  const opReturnScript = buildSendScript(duneId, amountBig, 1);

  const built = await signDuneTransaction(
    signer,
    opReturnScript,
    [{ address: recipientAddress, value: postage }],
    feeRate,
  );

  let txid: string | undefined;
  if (broadcast) {
    txid = await broadcastTx(built.rawHex);
  }

  return { txHex: built.rawHex, txid, feeSatoshis: built.feeSatoshis };
}

// ── Unit helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a human-readable decimal string to smallest token units.
 * e.g. "100.5" with divisibility 8 → 10_050_000_000n
 */
export function humanToSmallestUnits(amount: string, divisibility: number): bigint {
  const trimmed = amount.trim();
  if (!trimmed || trimmed === '.') throw new Error('Amount is required');

  const dotIndex = trimmed.indexOf('.');
  if (dotIndex === -1) {
    // No decimal point
    return BigInt(trimmed) * (10n ** BigInt(divisibility));
  }

  const intPart = trimmed.slice(0, dotIndex) || '0';
  const fracPart = trimmed.slice(dotIndex + 1).padEnd(divisibility, '0').slice(0, divisibility);

  const intBig  = BigInt(intPart)  * (10n ** BigInt(divisibility));
  const fracBig = fracPart ? BigInt(fracPart) : 0n;
  return intBig + fracBig;
}

/**
 * Convert smallest token units back to human-readable decimal string.
 */
export function smallestUnitsToHuman(amount: bigint, divisibility: number): string {
  if (divisibility === 0) return amount.toString();
  const factor = 10n ** BigInt(divisibility);
  const intPart  = amount / factor;
  const fracPart = amount % factor;
  const fracStr  = fracPart.toString().padStart(divisibility, '0').replace(/0+$/, '');
  return fracStr ? `${intPart}.${fracStr}` : intPart.toString();
}
