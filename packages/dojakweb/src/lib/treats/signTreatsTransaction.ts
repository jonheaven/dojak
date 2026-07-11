import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import {
  broadcastSignedTransaction,
  fetchSpendableUtxosConservativeForAddress,
  filterSafeSpendableUtxos,
  MIN_FEE_RATE_KOINU_PER_BYTE,
  type NormalisedUtxo,
} from '../broadcast/dogecoinTxBroadcast';
import { estimateOpReturnOutputsTxWeight } from '../tx/opReturn';
import { TREATS_DUST_KOINU, type TreatsOpKind } from './constants';
import { treatsPayloadBytes } from './buildJson';
import { planTreatsOperationOutputs, TREATS_PAIRED_DUST_OUTPUT_WEIGHT } from './outputPlan';

function normalizeOutpointKey(txid: string, vout: number): string {
  return `${txid.toLowerCase()}:${vout}`;
}

function filterExcludedUtxos(
  utxos: NormalisedUtxo[],
  excludedOutpoints?: string[],
): { spendable: NormalisedUtxo[]; excludedCount: number } {
  if (!excludedOutpoints?.length) return { spendable: utxos, excludedCount: 0 };
  const excludedSet = new Set(excludedOutpoints.map((o) => o.trim().toLowerCase()).filter(Boolean));
  const spendable = utxos.filter((u) => !excludedSet.has(normalizeOutpointKey(u.tx_hash, u.tx_output_n)));
  return { spendable, excludedCount: utxos.length - spendable.length };
}

export interface SignTreatsParams {
  op: TreatsOpKind;
  tick: string;
  fromAddress: string;
  privateKeyWIF: string;
  /** Paired dust recipient for deploy/mint/transfer; ignored for burn. */
  recipientAddress?: string;
  max?: string;
  lim?: string;
  amt?: string;
  feeRate?: number;
  excludedOutpoints?: string[];
  /** Mint PoW solution (required when indexer enforces PoW for this tick). */
  powChallengeId?: string;
  powNonce?: string;
  powDifficulty?: number;
}

export interface SignedTreatsTx {
  rawHex: string;
  payloadJson: string;
  feeSatoshis: number;
  changeSatoshis: number;
  totalInputSatoshis: number;
  inputCount: number;
}

export async function signTreatsTransaction(params: SignTreatsParams): Promise<SignedTreatsTx> {
  const {
    op,
    tick,
    fromAddress,
    privateKeyWIF,
    recipientAddress,
    max,
    lim,
    amt,
    feeRate: rawFeeRate = 1000,
    excludedOutpoints,
  } = params;

  const feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, rawFeeRate);
  const needsPair = op !== 'burn';
  const recipient = needsPair ? (recipientAddress?.trim() || fromAddress) : undefined;

  if (needsPair && !recipient) {
    throw new Error('Recipient address required for ÐogeTreats deploy, mint, and transfer');
  }

  const payload = treatsPayloadBytes(op, {
    tick,
    max: max ?? '',
    lim: lim ?? '',
    amt: amt ?? '',
    powChallengeId: params.powChallengeId,
    powNonce: params.powNonce,
    powDifficulty:
      params.powDifficulty !== undefined ? String(params.powDifficulty) : undefined,
  } as Record<string, string>);
  if (!payload?.length) {
    throw new Error('Invalid ÐogeTreats parameters — check ticker, amounts, and reserved names');
  }

  const payloadJson = new TextDecoder().decode(payload);
  const pairedDust = needsPair ? TREATS_DUST_KOINU : 0;

  const utxos = await fetchSpendableUtxosConservativeForAddress(fromAddress);
  if (!utxos.length) {
    throw new Error('No confirmed UTXOs found. Your wallet needs DOGE to cover fee and paired dust.');
  }

  const { spendable: afterExcludes } = filterExcludedUtxos(utxos, excludedOutpoints);
  const { safe: spendableUtxos } = filterSafeSpendableUtxos(fromAddress, afterExcludes);
  if (!spendableUtxos.length) {
    throw new Error('No spendable plain DOGE UTXOs remain after excluding inscription-likely outputs.');
  }

  const opReturnWeight = estimateOpReturnOutputsTxWeight([payload]);
  const pairedWeight = needsPair ? TREATS_PAIRED_DUST_OUTPUT_WEIGHT : 0;
  const baseSize = 10 + 34 + opReturnWeight + pairedWeight;
  const perInputSize = 148;
  const MIN_FEE = 100_000;

  let feeSatoshis = Math.max(MIN_FEE, Math.ceil(((baseSize + perInputSize) * feeRate) / 1000));
  const sorted = [...spendableUtxos].sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [];
  let totalSats = 0;
  const needed = () => feeSatoshis + pairedDust + 100_000;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalSats += utxo.value;
    feeSatoshis = Math.max(
      MIN_FEE,
      Math.ceil(((baseSize + perInputSize * selected.length) * feeRate) / 1000),
    );
    if (totalSats >= needed()) break;
  }

  const totalNeeded = feeSatoshis + pairedDust;
  if (totalSats < totalNeeded) {
    throw new Error(
      `Insufficient funds: need ${(totalNeeded / 1e8).toFixed(4)} DOGE (fee + paired dust), ` +
        `have ${(totalSats / 1e8).toFixed(4)} DOGE.`,
    );
  }

  const changeAmount = totalSats - feeSatoshis - pairedDust;
  if (!Number.isFinite(changeAmount) || changeAmount < 0) {
    throw new Error('Fee calculation produced invalid change');
  }

  const planned = planTreatsOperationOutputs({
    payload,
    recipientAddress: recipient,
    changeAddress: fromAddress,
    changeSats: changeAmount,
  });

  const outputs = planned.map((o) => {
    if (o.script !== undefined) return { value: o.value, script: o.script };
    if (o.address !== undefined) return { value: o.value, address: o.address };
    return { value: o.value };
  });

  const signer = DogeMemoryWallet.fromWIF(privateKeyWIF, 'doge');
  const signedTx = await createP2PKHTransaction(signer, {
    address: fromAddress,
    inputs: selected.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      value: u.value,
    })),
    outputs: outputs as Parameters<typeof createP2PKHTransaction>[1]['outputs'],
  }).finalizeAndSign();

  return {
    rawHex: signedTx.toHex(),
    payloadJson,
    feeSatoshis,
    changeSatoshis: changeAmount,
    totalInputSatoshis: totalSats,
    inputCount: selected.length,
  };
}

export async function signAndBroadcastTreats(params: SignTreatsParams): Promise<string> {
  const { rawHex } = await signTreatsTransaction(params);
  return broadcastSignedTransaction(rawHex);
}
