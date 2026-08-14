import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import {
  broadcastSignedTransaction,
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
  MIN_FEE_RATE_KOINU_PER_BYTE,
  txidFromRawHex,
  type NormalisedUtxo,
} from '../broadcast/dogecoinTxBroadcast';
import { coerceSignedPsdtToRawTxHex, getTxHex } from '../doginal-psdt';
import { mergePaymentUtxos, recordPaymentBroadcast } from '../mempoolSpendOverlay';
import { estimateOpReturnOutputsTxWeight } from '../tx/opReturn';
import {
  TREATS_AIRDROP_MAX_PER_TX,
  TREATS_AIRDROP_MAX_TX_VBYTES,
  TREATS_DUST_KOINU,
} from './constants';
import { buildTreatsTransferJson } from './buildJson';
import { planTreatsAirdropOutputs, TREATS_PAIRED_DUST_OUTPUT_WEIGHT } from './outputPlan';

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

export type TreatsAirdropRecipient = {
  address: string;
  /** Smallest units (integer string). */
  amount: string;
};

export type TreatsAirdropSigner = {
  fromAddress: string;
  privateKeyWIF?: string;
  signPsbt?: (psbtBase64: string) => Promise<string>;
};

export type TreatsAirdropJobFee = {
  address: string;
  value: number;
};

export function packTreatsAirdropBatches(
  tick: string,
  assetId: string,
  recipients: TreatsAirdropRecipient[],
): TreatsAirdropRecipient[][] {
  if (!recipients.length) return [];
  const sample = buildTreatsTransferJson(tick, recipients[0]!.amount, assetId);
  if (!sample) {
    throw new Error('Invalid Treats airdrop parameters — ticker, ÐA (block:tx), and amounts must fit ≤83-byte scripts');
  }
  const payload = Buffer.from(sample, 'utf8');
  const pairVbytes = estimateOpReturnOutputsTxWeight([payload]) + TREATS_PAIRED_DUST_OUTPUT_WEIGHT;
  const overhead = 10 + 148 + 34; // 1 input + change
  const bySize = Math.max(1, Math.floor((TREATS_AIRDROP_MAX_TX_VBYTES - overhead) / Math.max(1, pairVbytes)));
  const cap = Math.min(TREATS_AIRDROP_MAX_PER_TX, bySize);
  const batches: TreatsAirdropRecipient[][] = [];
  for (let i = 0; i < recipients.length; i += cap) {
    batches.push(recipients.slice(i, i + cap));
  }
  return batches;
}

function payloadsForBatch(
  tick: string,
  assetId: string,
  batch: TreatsAirdropRecipient[],
): Array<{ payload: Buffer; payloadJson: string; recipientAddress: string }> {
  return batch.map((r) => {
    const json = buildTreatsTransferJson(tick, r.amount, assetId);
    if (!json) {
      throw new Error(`Invalid Treats transfer for ${r.address} amount ${r.amount}`);
    }
    return {
      payload: Buffer.from(json, 'utf8'),
      payloadJson: json,
      recipientAddress: r.address.trim(),
    };
  });
}

async function planTreatsAirdropTx(params: {
  fromAddress: string;
  pairs: Array<{ payload: Buffer; recipientAddress: string }>;
  feeRate: number;
  jobFee?: TreatsAirdropJobFee;
}): Promise<{
  selected: NormalisedUtxo[];
  outputs: Array<{ value: number; script?: Uint8Array; address?: string }>;
  feeSatoshis: number;
  changeAmount: number;
  totalSats: number;
}> {
  const feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, params.feeRate);
  const utxos = await fetchSpendableUtxosConservativeForAddress(params.fromAddress);
  if (!utxos.length) {
    throw new Error('No confirmed UTXOs found. Your wallet needs DOGE to cover fee and paired dust.');
  }
  const { safe } = await filterPaymentSpendableUtxos(params.fromAddress, utxos);
  const merged = mergePaymentUtxos(
    params.fromAddress,
    safe.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
  );
  const spendable: NormalisedUtxo[] = merged.map((u) => ({
    tx_hash: u.txid,
    tx_output_n: u.vout,
    value: u.value,
  }));
  if (!spendable.length) {
    throw new Error('No spendable plain DOGE UTXOs remain after excluding inscription-likely and Ðune-bearing outputs.');
  }

  const payloads = params.pairs.map((p) => p.payload);
  const opReturnWeight = estimateOpReturnOutputsTxWeight(payloads);
  const pairedWeight = TREATS_PAIRED_DUST_OUTPUT_WEIGHT * params.pairs.length;
  const jobFeeValue = params.jobFee && params.jobFee.value > 0 ? params.jobFee.value : 0;
  const jobFeeWeight = jobFeeValue > 0 ? 34 : 0;
  const baseSize = 10 + 34 + opReturnWeight + pairedWeight + jobFeeWeight;
  const perInputSize = 148;
  const MIN_FEE = 100_000;
  const pairedDust = TREATS_DUST_KOINU * params.pairs.length;

  let feeSatoshis = Math.max(MIN_FEE, Math.ceil((baseSize + perInputSize) * feeRate));
  const sorted = [...spendable].sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [];
  let totalSats = 0;
  const needed = () => feeSatoshis + pairedDust + jobFeeValue + 100_000;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalSats += utxo.value;
    feeSatoshis = Math.max(MIN_FEE, Math.ceil((baseSize + perInputSize * selected.length) * feeRate));
    if (totalSats >= needed()) break;
  }

  const totalNeeded = feeSatoshis + pairedDust + jobFeeValue;
  if (totalSats < totalNeeded) {
    throw new Error(
      `Insufficient funds: need ${(totalNeeded / 1e8).toFixed(4)} DOGE (fee + ${params.pairs.length} × 0.01 dust` +
        `${jobFeeValue ? ' + job fee' : ''}), have ${(totalSats / 1e8).toFixed(4)} DOGE.`,
    );
  }

  const changeAmount = totalSats - feeSatoshis - pairedDust - jobFeeValue;
  const planned = planTreatsAirdropOutputs({
    pairs: params.pairs,
    changeAddress: params.fromAddress,
    changeSats: changeAmount,
    jobFee: jobFeeValue > 0 ? params.jobFee : undefined,
  });

  const outputs = planned.map((o) => {
    if (o.script !== undefined) return { value: o.value, script: o.script };
    if (o.address !== undefined) return { value: o.value, address: o.address };
    return { value: o.value };
  });

  return { selected, outputs, feeSatoshis, changeAmount, totalSats };
}

async function signPlannedTreatsAirdrop(
  signer: TreatsAirdropSigner,
  planned: Awaited<ReturnType<typeof planTreatsAirdropTx>>,
): Promise<string> {
  if (!signer.privateKeyWIF && !signer.signPsbt) {
    throw new Error('ÐogeTreats airdrop requires privateKeyWIF or signPsbt');
  }
  if (signer.privateKeyWIF) {
    const wallet = DogeMemoryWallet.fromWIF(signer.privateKeyWIF, 'doge');
    const signedTx = await createP2PKHTransaction(wallet, {
      address: signer.fromAddress,
      inputs: planned.selected.map((u) => ({
        txid: u.tx_hash,
        vout: u.tx_output_n,
        value: u.value,
      })),
      outputs: planned.outputs as Parameters<typeof createP2PKHTransaction>[1]['outputs'],
    }).finalizeAndSign();
    return signedTx.toHex();
  }

  const bitcoin = await import('bitcoinjs-lib');
  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK as any });
  psbt.setVersion(1);
  const rawTxHexes = await Promise.all(planned.selected.map((u) => getTxHex(u.tx_hash)));
  for (let i = 0; i < planned.selected.length; i++) {
    const u = planned.selected[i]!;
    psbt.addInput({
      hash: u.tx_hash,
      index: u.tx_output_n,
      nonWitnessUtxo: Buffer.from(rawTxHexes[i]!, 'hex'),
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
    });
  }
  for (const o of planned.outputs) {
    if (o.script) {
      psbt.addOutput({ script: Buffer.from(o.script), value: BigInt(o.value) } as any);
    } else if (o.address) {
      psbt.addOutput({ address: o.address, value: BigInt(o.value) } as any);
    }
  }
  const signedPayload = await signer.signPsbt!(psbt.toBase64());
  return coerceSignedPsdtToRawTxHex(signedPayload);
}

function changeVoutFromOutputs(
  outputs: Array<{ value: number; address?: string }>,
  changeAddress: string,
  changeAmount: number,
): number | null {
  if (changeAmount <= 0) return null;
  for (let i = outputs.length - 1; i >= 0; i--) {
    const o = outputs[i]!;
    if (o.address === changeAddress && o.value === changeAmount) return i;
  }
  return outputs.length - 1;
}

export async function signAndBroadcastTreatsAirdropBatch(params: {
  tick: string;
  assetId: string;
  recipients: TreatsAirdropRecipient[];
  signer: TreatsAirdropSigner;
  feeRate?: number;
  jobFee?: TreatsAirdropJobFee;
}): Promise<{ txid: string; feeSatoshis: number; recipientCount: number }> {
  const pairs = payloadsForBatch(params.tick, params.assetId, params.recipients);
  const planned = await planTreatsAirdropTx({
    fromAddress: params.signer.fromAddress,
    pairs,
    feeRate: params.feeRate ?? MIN_FEE_RATE_KOINU_PER_BYTE,
    jobFee: params.jobFee,
  });
  const rawHex = await signPlannedTreatsAirdrop(params.signer, planned);
  const txid = await broadcastSignedTransaction(rawHex);
  const computed = await txidFromRawHex(rawHex).catch(() => txid);
  const changeVout = changeVoutFromOutputs(planned.outputs, params.signer.fromAddress, planned.changeAmount);
  recordPaymentBroadcast({
    address: params.signer.fromAddress,
    txid: computed || txid,
    spent: planned.selected.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n })),
    change:
      changeVout != null && planned.changeAmount > 0
        ? { vout: changeVout, value: planned.changeAmount }
        : null,
  });
  return {
    txid: computed || txid,
    feeSatoshis: planned.feeSatoshis,
    recipientCount: params.recipients.length,
  };
}

export async function signAndBroadcastTreatsAirdrop(params: {
  tick: string;
  assetId: string;
  recipients: TreatsAirdropRecipient[];
  signer: TreatsAirdropSigner;
  feeRate?: number;
  jobFee?: TreatsAirdropJobFee;
  onBatch?: (info: {
    batchIndex: number;
    batchCount: number;
    txid: string;
    recipientCount: number;
  }) => void | Promise<void>;
}): Promise<{ txids: string[]; feeSatoshis: number }> {
  const batches = packTreatsAirdropBatches(params.tick, params.assetId, params.recipients);
  const txids: string[] = [];
  let feeSatoshis = 0;
  for (let i = 0; i < batches.length; i++) {
    const result = await signAndBroadcastTreatsAirdropBatch({
      tick: params.tick,
      assetId: params.assetId,
      recipients: batches[i]!,
      signer: params.signer,
      feeRate: params.feeRate,
      jobFee: i === 0 ? params.jobFee : undefined,
    });
    txids.push(result.txid);
    feeSatoshis += result.feeSatoshis;
    await params.onBatch?.({
      batchIndex: i,
      batchCount: batches.length,
      txid: result.txid,
      recipientCount: result.recipientCount,
    });
  }
  return { txids, feeSatoshis };
}
