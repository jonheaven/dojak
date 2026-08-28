/**
 * Native 0xD0 launch-curve transaction helpers for ÐLaunch / Ðunes.
 *
 * Launch is a normal wallet-funded Dunestone etch: OP_RETURN at output 0,
 * creator dust at output 1, treasury / curve-inventory dust at output 2.
 *
 * Bonding trades are real Ðune movements. In production they require a curve
 * treasury co-signer because the buy transaction must spend the inventory UTXO
 * and the sell transaction must fund the DOGE payout.
 */

import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
  txidFromRawHex,
  type NormalisedUtxo,
} from '../lib/broadcast/dogecoinTxBroadcast';
import {
  broadcastTx,
  coerceSignedPsdtToRawTxHex,
  getTxHex,
} from '../lib/doginal-psdt';
import type { DuneTxSigner } from '../lib/dune-tx-signer';
import { assertDuneTxSigner } from '../lib/dune-tx-signer';
import {
  buildLaunchCurveBuyScript,
  buildLaunchCurveEtchScript,
  buildLaunchCurveGraduateScript,
  buildLaunchCurveSellScript,
  parseSpacedDune,
} from '../lib/dunestone';
import { enforceBroadcastFeeRateKoinuPerByte } from '../lib/fees/dogecoinFeePolicy';

const MIN_FEE_KOINU = 100_000;
const POSTAGE_KOINU = 100_000;
const TX_OVERHEAD_BYTES = 10;
const P2PKH_INPUT_BYTES = 148;
const P2PKH_OUTPUT_BYTES = 34;

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

export type DuneLaunchCurveSigner = DuneTxSigner;

export type DuneLaunchCurveOutputIndexes = {
  opReturn: number;
  creator: number;
  treasury: number;
  inventory: number;
  buyer: number;
  seller: number;
  pool: number;
};

export type DuneLaunchCurveTxResult = {
  rawHex: string;
  txid?: string;
  feeSatoshis: number;
  changeSatoshis: number;
  inputCount: number;
  opReturnScriptHex: string;
  outputIndexes: Partial<DuneLaunchCurveOutputIndexes>;
};

export type DuneLaunchCurvePsbtPlan = {
  psbtBase64: string;
  feeSatoshis: number;
  changeSatoshis: number;
  inputCount: number;
  signerInputIndexes: number[];
  opReturnScriptHex: string;
  outputIndexes: Partial<DuneLaunchCurveOutputIndexes>;
  requiresTreasuryCosign: boolean;
  note: string;
};

export interface DuneLaunchCurveLaunchParams {
  /** Native Ðune display name. For launchpad tickers, pass the ticker-like name. */
  name: string;
  maxSupply: bigint | string | number;
  basePriceKoinu: bigint | string | number;
  slopeKoinu?: bigint | string | number;
  graduationSupply?: bigint | string | number;
  creatorFeeBps?: bigint | string | number;
  creatorAddress?: string;
  treasuryAddress: string;
  divisibility?: number;
  symbol?: string;
  metadata?: bigint | string | number;
  feeRate?: number;
  signer: DuneLaunchCurveSigner;
  broadcast?: boolean;
}

export interface DuneLaunchCurveBuyPlanParams {
  duneId: string;
  dogeInKoinu: bigint | string | number;
  tokensOut: bigint | string | number;
  buyerAddress: string;
  creatorAddress: string;
  treasuryAddress: string;
  creatorFeeBps?: number;
}

export interface DuneLaunchCurveSellPlanParams {
  duneId: string;
  tokenAmount: bigint | string | number;
  sellerAddress: string;
  minDogeOutKoinu?: bigint | string | number;
}

export interface DuneLaunchCurveGraduatePlanParams {
  duneId: string;
  poolTokenAmount?: bigint | string | number;
}

export interface DuneLaunchCurveGraduateParams {
  duneId: string;
  feeRate?: number;
  signer: DuneLaunchCurveSigner;
  broadcast?: boolean;
}

type PlannedTx = {
  selected: NormalisedUtxo[];
  outputs: Array<{ value: number; script?: Uint8Array; address?: string }>;
  feeSatoshis: number;
  changeSatoshis: number;
};

function toBigint(value: bigint | string | number | undefined, fallback = 0n): bigint {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid numeric value');
    return BigInt(Math.floor(value));
  }
  const clean = value.trim().replace(/,/g, '');
  if (!clean) return fallback;
  return BigInt(clean);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeAddress(label: string, address: string | undefined): string {
  const out = address?.trim() ?? '';
  if (out.length < 26) throw new Error(`${label} address is required`);
  return out;
}

function estimateSize(inputCount: number, outputCount: number, opReturnScriptBytes: number): number {
  const opReturnOutputBytes = 8 + 1 + opReturnScriptBytes;
  const paymentOutputs = Math.max(0, outputCount - 1);
  return (
    TX_OVERHEAD_BYTES +
    inputCount * P2PKH_INPUT_BYTES +
    paymentOutputs * P2PKH_OUTPUT_BYTES +
    opReturnOutputBytes
  );
}

function selectCoins(
  utxos: NormalisedUtxo[],
  requiredOutputKoinu: number,
  outputCountWithChange: number,
  opReturnScriptBytes: number,
  feeRate: number,
): NormalisedUtxo[] {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [];
  let total = 0;
  let fee = MIN_FEE_KOINU;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.value;
    fee = Math.max(
      MIN_FEE_KOINU,
      Math.ceil(estimateSize(selected.length, outputCountWithChange, opReturnScriptBytes) * feeRate),
    );
    if (total >= requiredOutputKoinu + fee + POSTAGE_KOINU) break;
  }

  if (total < requiredOutputKoinu + fee) {
    throw new Error(
      `Insufficient DOGE: need ${((requiredOutputKoinu + fee) / 1e8).toFixed(4)} DOGE, ` +
        `have ${(total / 1e8).toFixed(4)} DOGE.`,
    );
  }

  return selected;
}

async function spendableUtxos(address: string): Promise<NormalisedUtxo[]> {
  const all = await fetchSpendableUtxosConservativeForAddress(address);
  if (!all.length) throw new Error('No confirmed UTXOs found. Add plain DOGE to pay fees.');
  const { safe } = await filterPaymentSpendableUtxos(address, all);
  if (!safe.length) {
    throw new Error('No safe plain DOGE UTXOs found. Add a non-inscription / non-Ðune DOGE UTXO to pay fees.');
  }
  return safe;
}

function planWalletFundedTx(params: {
  fromAddress: string;
  opReturnScript: Uint8Array;
  extraOutputs: Array<{ address: string; value: number }>;
  utxos: NormalisedUtxo[];
  feeRate: number;
}): PlannedTx {
  const required = params.extraOutputs.reduce((sum, output) => sum + output.value, 0);
  const outputCountWithChange = 1 + params.extraOutputs.length + 1;
  const selected = selectCoins(
    params.utxos,
    required,
    outputCountWithChange,
    params.opReturnScript.length,
    params.feeRate,
  );
  const total = selected.reduce((sum, utxo) => sum + utxo.value, 0);
  const feeSatoshis = Math.max(
    MIN_FEE_KOINU,
    Math.ceil(estimateSize(selected.length, outputCountWithChange, params.opReturnScript.length) * params.feeRate),
  );
  const changeSatoshis = total - required - feeSatoshis;
  if (changeSatoshis < 0) throw new Error('Fee calculation produced negative change');

  const outputs: PlannedTx['outputs'] = [
    { value: 0, script: params.opReturnScript },
    ...params.extraOutputs,
  ];
  if (changeSatoshis >= POSTAGE_KOINU) {
    outputs.push({ address: params.fromAddress, value: changeSatoshis });
  }

  return { selected, outputs, feeSatoshis, changeSatoshis };
}

async function signWalletFundedTx(params: {
  signer: DuneLaunchCurveSigner;
  opReturnScript: Uint8Array;
  extraOutputs: Array<{ address: string; value: number }>;
  feeRate: number;
}): Promise<Omit<DuneLaunchCurveTxResult, 'opReturnScriptHex' | 'outputIndexes'>> {
  assertDuneTxSigner(params.signer);
  const feeRate = await enforceBroadcastFeeRateKoinuPerByte({
    requestedKoinuPerByte: params.feeRate,
    context: 'duneLaunchService.signWalletFundedTx',
  });
  const utxos = await spendableUtxos(params.signer.fromAddress);
  const planned = planWalletFundedTx({
    fromAddress: params.signer.fromAddress,
    opReturnScript: params.opReturnScript,
    extraOutputs: params.extraOutputs,
    utxos,
    feeRate,
  });

  if (params.signer.privateKeyWIF) {
    const signer = DogeMemoryWallet.fromWIF(params.signer.privateKeyWIF, 'doge');
    const signedTx = await createP2PKHTransaction(signer, {
      address: params.signer.fromAddress,
      inputs: planned.selected.map((u) => ({
        txid: u.tx_hash,
        vout: u.tx_output_n,
        value: u.value,
      })),
      outputs: planned.outputs as Parameters<typeof createP2PKHTransaction>[1]['outputs'],
    }).finalizeAndSign();

    return {
      rawHex: signedTx.toHex(),
      feeSatoshis: planned.feeSatoshis,
      changeSatoshis: planned.changeSatoshis,
      inputCount: planned.selected.length,
    };
  }

  if (params.signer.signPsbt) {
    const psbt = await buildWalletFundedPsbt({
      fromAddress: params.signer.fromAddress,
      selected: planned.selected,
      outputs: planned.outputs,
    });
    const signedPayload = await params.signer.signPsbt(psbt);
    return {
      rawHex: coerceSignedPsdtToRawTxHex(signedPayload),
      feeSatoshis: planned.feeSatoshis,
      changeSatoshis: planned.changeSatoshis,
      inputCount: planned.selected.length,
    };
  }

  throw new Error('No signing method available for this wallet');
}

async function buildWalletFundedPsbt(params: {
  fromAddress: string;
  selected: NormalisedUtxo[];
  outputs: PlannedTx['outputs'];
}): Promise<string> {
  const rawTxHexes = await Promise.all(params.selected.map((u) => getTxHex(u.tx_hash)));
  const bitcoin = await import('bitcoinjs-lib');
  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK as any });
  psbt.setVersion(1);

  for (let i = 0; i < params.selected.length; i++) {
    const u = params.selected[i]!;
    psbt.addInput({
      hash: u.tx_hash,
      index: u.tx_output_n,
      nonWitnessUtxo: Buffer.from(rawTxHexes[i]!, 'hex'),
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
    });
  }

  for (const output of params.outputs) {
    if (output.script) {
      psbt.addOutput({ script: Buffer.from(output.script), value: BigInt(output.value) } as any);
    } else if (output.address) {
      psbt.addOutput({ address: output.address, value: BigInt(output.value) } as any);
    }
  }

  return psbt.toBase64();
}

async function maybeBroadcast(rawHex: string, broadcast: boolean): Promise<string | undefined> {
  if (!broadcast) return undefined;
  const computed = await txidFromRawHex(rawHex);
  const relay = await broadcastTx(rawHex);
  const normalizedRelay = relay.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalizedRelay) && normalizedRelay === computed
    ? normalizedRelay
    : computed;
}

export async function launchDuneCurve(
  params: DuneLaunchCurveLaunchParams,
): Promise<DuneLaunchCurveTxResult> {
  const creatorAddress = normalizeAddress(
    'Creator',
    params.creatorAddress?.trim() || params.signer.fromAddress,
  );
  const treasuryAddress = normalizeAddress('Treasury', params.treasuryAddress);
  if (creatorAddress.toLowerCase() === treasuryAddress.toLowerCase()) {
    throw new Error('Creator and treasury addresses must differ for native Ðunes launch curves');
  }

  parseSpacedDune(params.name);
  const maxSupply = toBigint(params.maxSupply);
  const basePrice = toBigint(params.basePriceKoinu);
  const opReturnScript = buildLaunchCurveEtchScript({
    name: params.name,
    maxSupply,
    basePrice,
    slope: toBigint(params.slopeKoinu, 0n),
    graduationSupply: toBigint(params.graduationSupply, maxSupply),
    creatorFeeBps: toBigint(params.creatorFeeBps, 100n),
    divisibility: params.divisibility ?? 0,
    symbol: params.symbol,
    metadata: params.metadata === undefined ? undefined : toBigint(params.metadata),
    creatorOutput: 1,
    treasuryOutput: 2,
    inventoryOutput: 2,
  });

  const signed = await signWalletFundedTx({
    signer: params.signer,
    opReturnScript,
    extraOutputs: [
      { address: creatorAddress, value: POSTAGE_KOINU },
      { address: treasuryAddress, value: POSTAGE_KOINU },
    ],
    feeRate: Math.max(1, Math.floor(params.feeRate ?? 0)),
  });
  const txid = await maybeBroadcast(signed.rawHex, params.broadcast ?? true);

  return {
    ...signed,
    txid,
    opReturnScriptHex: bytesToHex(opReturnScript),
    outputIndexes: { opReturn: 0, creator: 1, treasury: 2, inventory: 2 },
  };
}

export async function graduateDuneCurve(
  params: DuneLaunchCurveGraduateParams,
): Promise<DuneLaunchCurveTxResult> {
  const opReturnScript = buildLaunchCurveGraduateScript({
    duneId: params.duneId,
  });

  const signed = await signWalletFundedTx({
    signer: params.signer,
    opReturnScript,
    extraOutputs: [],
    feeRate: Math.max(1, Math.floor(params.feeRate ?? 0)),
  });
  const txid = await maybeBroadcast(signed.rawHex, params.broadcast ?? true);

  return {
    ...signed,
    txid,
    opReturnScriptHex: bytesToHex(opReturnScript),
    outputIndexes: { opReturn: 0 },
  };
}

export function buildDuneCurveBuyCosignPlan(
  params: DuneLaunchCurveBuyPlanParams,
): Omit<DuneLaunchCurvePsbtPlan, 'psbtBase64' | 'feeSatoshis' | 'changeSatoshis' | 'inputCount' | 'signerInputIndexes'> {
  const dogeIn = toBigint(params.dogeInKoinu);
  const tokensOut = toBigint(params.tokensOut);
  const opReturnScript = buildLaunchCurveBuyScript({
    duneId: params.duneId,
    dogeIn,
    tokensOut,
    minTokensOut: tokensOut,
    buyerOutput: 1,
    treasuryOutput: 3,
  });

  const creatorFeeBps = Math.min(500, Math.max(1, Math.floor(params.creatorFeeBps ?? 100)));
  const dogeInNumber = Number(dogeIn);
  const creatorFeeKoinu = Math.floor((dogeInNumber * creatorFeeBps) / 10_000);
  const treasuryKoinu = dogeInNumber - creatorFeeKoinu;

  return {
    opReturnScriptHex: bytesToHex(opReturnScript),
    outputIndexes: { opReturn: 0, buyer: 1, creator: 2, treasury: 3 },
    requiresTreasuryCosign: true,
    note:
      `Buy PSBT must include the curve inventory Ðune UTXO as an input signed by treasury, ` +
      `plus outputs: buyer dust ${params.buyerAddress}, creator ${creatorFeeKoinu} koinu to ` +
      `${params.creatorAddress}, treasury ${treasuryKoinu} koinu to ${params.treasuryAddress}.`,
  };
}

export function buildDuneCurveSellCosignPlan(
  params: DuneLaunchCurveSellPlanParams,
): Omit<DuneLaunchCurvePsbtPlan, 'psbtBase64' | 'feeSatoshis' | 'changeSatoshis' | 'inputCount' | 'signerInputIndexes'> {
  const tokenAmount = toBigint(params.tokenAmount);
  const opReturnScript = buildLaunchCurveSellScript({
    duneId: params.duneId,
    tokenAmount,
    minDogeOut: params.minDogeOutKoinu === undefined ? undefined : toBigint(params.minDogeOutKoinu),
    sellerOutput: 1,
    treasuryOutput: 2,
  });

  return {
    opReturnScriptHex: bytesToHex(opReturnScript),
    outputIndexes: { opReturn: 0, seller: 1, treasury: 2 },
    requiresTreasuryCosign: true,
    note:
      `Sell PSBT must spend the seller's Ðune UTXO and a treasury DOGE UTXO. ` +
      `Output 1 pays ${params.sellerAddress}; output 2 is the treasury inventory Ðune return output.`,
  };
}

export function buildDuneCurveGraduateCosignPlan(
  params: DuneLaunchCurveGraduatePlanParams,
): Omit<DuneLaunchCurvePsbtPlan, 'psbtBase64' | 'feeSatoshis' | 'changeSatoshis' | 'inputCount' | 'signerInputIndexes'> {
  const opReturnScript = buildLaunchCurveGraduateScript({
    duneId: params.duneId,
    poolOutput: params.poolTokenAmount === undefined ? undefined : 1,
    poolTokenAmount:
      params.poolTokenAmount === undefined ? undefined : toBigint(params.poolTokenAmount),
  });

  return {
    opReturnScriptHex: bytesToHex(opReturnScript),
    outputIndexes: { opReturn: 0, pool: 1 },
    requiresTreasuryCosign: params.poolTokenAmount !== undefined,
    note:
      params.poolTokenAmount === undefined
        ? 'Graduate can be a wallet-funded marker transaction.'
        : 'Graduate with LP seed must spend treasury inventory and DOGE inputs, then lock the pool output.',
  };
}
