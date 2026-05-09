import * as bitcoin from 'bitcoinjs-lib';
import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterSafeSpendableUtxos,
  broadcastSignedTransaction,
  MIN_FEE_RATE_KOINU_PER_BYTE,
  type NormalisedUtxo,
} from '../broadcast/dogecoinTxBroadcast';
import {
  generateQuantumCommitment,
  buildQuantumCommitmentScript,
  buildQuantumRevealReferenceScript,
  exportProofAsJson,
  type PQCAlgorithm,
  type QuantumCommitment,
  type QuantumProofExport,
  QUANTUM_OPRETURN_OUTPUT_BYTES,
  QUANTUM_CARRIER_OUTPUT_BYTES,
  QUANTUM_CARRIER_VALUE_KOINU,
} from '../quantum';
import { DOGE_NETWORK } from '../doginal-psdt';

const MIN_FEE = 100_000;
const DUST_LIMIT = 100_000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) {
    throw new Error('Hex string must have an even length.');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(Array.from(bytes).reverse());
}

function estimateFeeBytes(inputCount: number, includeCarrier: boolean): number {
  const baseSize = 10 + 34 + 34 + QUANTUM_OPRETURN_OUTPUT_BYTES + (includeCarrier ? QUANTUM_CARRIER_OUTPUT_BYTES : 0);
  return baseSize + (148 * inputCount);
}

function computePreCommitmentSighash(
  selected: NormalisedUtxo[],
  toAddress: string,
  paymentSatoshis: number,
  sourceAddress: string,
  changeSatoshis: number,
): Uint8Array {
  const tx = new bitcoin.Transaction();

  if (!selected.length) {
    throw new Error('At least one input is required to compute a quantum sighash.');
  }

  for (const utxo of selected) {
    tx.addInput(reverseBytes(hexToBytes(utxo.tx_hash)), utxo.tx_output_n, 0xffffffff);
  }

  const paymentScript = bitcoin.payments.p2pkh({ address: toAddress, network: DOGE_NETWORK }).output;
  if (!paymentScript) {
    throw new Error('Failed to build recipient payment script.');
  }
  tx.addOutput(paymentScript, BigInt(paymentSatoshis));

  if (changeSatoshis > 0) {
    const changeScript = bitcoin.payments.p2pkh({ address: sourceAddress, network: DOGE_NETWORK }).output;
    if (!changeScript) {
      throw new Error('Failed to build change script.');
    }
    tx.addOutput(changeScript, BigInt(changeSatoshis));
  }

  const subscript = bitcoin.payments.p2pkh({ address: sourceAddress, network: DOGE_NETWORK }).output;
  if (!subscript) {
    throw new Error('Failed to build sighash subscript.');
  }

  return tx.hashForSignature(0, subscript, bitcoin.Transaction.SIGHASH_ALL);
}

function selectQuantumUtxos(
  spendable: NormalisedUtxo[],
  amountSatoshis: number,
  feeRate: number,
  includeCarrier: boolean,
): {
  selected: NormalisedUtxo[];
  totalInputSatoshis: number;
  feeSatoshis: number;
  changeSatoshis: number;
} {
  const carrierSatoshis = includeCarrier ? QUANTUM_CARRIER_VALUE_KOINU : 0;
  const sorted = [...spendable].sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [];
  let totalInputSatoshis = 0;
  let feeSatoshis = MIN_FEE;

  for (const utxo of sorted) {
    if (!Number.isFinite(utxo.value) || utxo.value <= 0) {
      continue;
    }
    selected.push(utxo);
    totalInputSatoshis += utxo.value;
    feeSatoshis = Math.max(
      MIN_FEE,
      Math.ceil((estimateFeeBytes(selected.length, includeCarrier) * feeRate) / 1000),
    );

    const needsChangeOutput = totalInputSatoshis > amountSatoshis + carrierSatoshis + feeSatoshis;
    const dustGuard = needsChangeOutput ? DUST_LIMIT : 0;
    const target = amountSatoshis + carrierSatoshis + feeSatoshis + dustGuard;
    if (totalInputSatoshis >= target) {
      break;
    }
  }

  const required = amountSatoshis + carrierSatoshis + feeSatoshis;
  if (totalInputSatoshis < required) {
    throw new Error(
      `Insufficient funds: need ${(required / 1e8).toFixed(4)} DOGE, have ${(totalInputSatoshis / 1e8).toFixed(4)} DOGE.`,
    );
  }

  let changeSatoshis = totalInputSatoshis - amountSatoshis - carrierSatoshis - feeSatoshis;
  if (changeSatoshis > 0 && changeSatoshis < DUST_LIMIT) {
    feeSatoshis += changeSatoshis;
    changeSatoshis = 0;
  }
  return { selected, totalInputSatoshis, feeSatoshis, changeSatoshis };
}

export interface BroadcastQuantumParams {
  toAddress: string;
  amountSatoshis: number;
  fromAddress: string;
  privateKeyWIF: string;
  algorithm?: PQCAlgorithm;
  includeCarrier?: boolean;
  feeRate?: number;
  excludedOutpoints?: string[];
}

export interface QuantumTxResult {
  txid: string;
  rawHex: string;
  feeSatoshis: number;
  changeSatoshis: number;
  totalInputSatoshis: number;
  inputCount: number;
  carrierVout?: number;
  commitment: QuantumCommitment;
  proof: QuantumProofExport;
  selectedUtxos: Array<{ txid: string; vout: number; value: number }>;
}

export interface BroadcastQuantumRevealParams {
  txcTxid: string;
  carrierVout: number;
  commitment: QuantumCommitment;
  fromAddress: string;
  privateKeyWIF: string;
  feeRate?: number;
}

export interface QuantumRevealResult {
  txid: string;
  rawHex: string;
  feeSatoshis: number;
  returnedSatoshis: number;
  proof: QuantumProofExport;
}

export interface QuantumFeeEstimate {
  feeSatoshis: number;
  feeDoge: string;
  changeSatoshis: number;
  totalInputSatoshis: number;
  inputCount: number;
  carrierSatoshis: number;
}

export async function estimateQuantumTxFee(
  fromAddress: string,
  amountSatoshis: number,
  includeCarrier = false,
  rawFeeRate = 1000,
  excludedOutpoints?: string[],
): Promise<QuantumFeeEstimate> {
  const feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, rawFeeRate);
  const rawUtxos = await fetchSpendableUtxosConservativeForAddress(fromAddress);
  if (!rawUtxos.length) {
    throw new Error('No confirmed UTXOs found.');
  }

  const excluded = new Set((excludedOutpoints ?? []).map((item) => item.toLowerCase()));
  const filtered = rawUtxos.filter((utxo) => !excluded.has(`${utxo.tx_hash.toLowerCase()}:${utxo.tx_output_n}`));
  const { safe: spendable } = filterSafeSpendableUtxos(fromAddress, filtered);
  if (!spendable.length) {
    throw new Error('No spendable UTXOs after filtering inscription-likely outputs.');
  }

  const selection = selectQuantumUtxos(spendable, amountSatoshis, feeRate, includeCarrier);
  return {
    feeSatoshis: selection.feeSatoshis,
    feeDoge: (selection.feeSatoshis / 1e8).toFixed(4),
    changeSatoshis: selection.changeSatoshis,
    totalInputSatoshis: selection.totalInputSatoshis,
    inputCount: selection.selected.length,
    carrierSatoshis: includeCarrier ? QUANTUM_CARRIER_VALUE_KOINU : 0,
  };
}

export async function signQuantumCommitmentTx(
  params: BroadcastQuantumParams,
): Promise<{ rawHex: string; result: Omit<QuantumTxResult, 'txid'> }> {
  const {
    toAddress,
    amountSatoshis,
    fromAddress,
    privateKeyWIF,
    algorithm = 'falcon512',
    includeCarrier = false,
    feeRate: rawFeeRate = 1000,
    excludedOutpoints,
  } = params;

  const feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, rawFeeRate);
  if (!toAddress) throw new Error('Recipient address is required.');
  if (!fromAddress) throw new Error('Sender address is required.');
  if (!privateKeyWIF) throw new Error('Private key (WIF) is required.');
  if (!Number.isFinite(amountSatoshis) || amountSatoshis < DUST_LIMIT) {
    throw new Error(`Amount must be at least ${DUST_LIMIT} koinu (0.001 DOGE).`);
  }

  const rawUtxos = await fetchSpendableUtxosConservativeForAddress(fromAddress);
  if (!rawUtxos.length) {
    throw new Error('No confirmed UTXOs found. Fund your wallet first.');
  }

  const excluded = new Set((excludedOutpoints ?? []).map((item) => item.toLowerCase()));
  const filtered = rawUtxos.filter((utxo) => !excluded.has(`${utxo.tx_hash.toLowerCase()}:${utxo.tx_output_n}`));
  const { safe: spendable } = filterSafeSpendableUtxos(fromAddress, filtered);
  if (!spendable.length) {
    throw new Error('No spendable UTXOs after filtering inscription-likely outputs.');
  }

  const selection = selectQuantumUtxos(spendable, amountSatoshis, feeRate, includeCarrier);
  const sighash32 = computePreCommitmentSighash(
    selection.selected,
    toAddress,
    amountSatoshis,
    fromAddress,
    selection.changeSatoshis,
  );

  const commitment = await generateQuantumCommitment(sighash32, algorithm);
  console.log('[quantum] commitment ready', {
    algorithm: commitment.algorithm,
    commitHex: `${bytesToHex(commitment.commitment).slice(0, 16)}...`,
  });

  const outputs: Array<{ value: number; script?: Uint8Array; address?: string }> = [
    { address: toAddress, value: amountSatoshis },
  ];

  if (selection.changeSatoshis > 0) {
    outputs.push({ address: fromAddress, value: selection.changeSatoshis });
  }

  outputs.push({ value: 0, script: buildQuantumCommitmentScript(commitment) });

  let carrierVout: number | undefined;
  if (includeCarrier) {
    carrierVout = outputs.length;
    outputs.push({ address: fromAddress, value: QUANTUM_CARRIER_VALUE_KOINU });
  }

  const signer = DogeMemoryWallet.fromWIF(privateKeyWIF);
  const txBuilder = createP2PKHTransaction(signer, {
    address: fromAddress,
    inputs: selection.selected.map((utxo) => ({ txid: utxo.tx_hash, vout: utxo.tx_output_n, value: utxo.value })),
    outputs: outputs as never,
  });
  const signedTx = await txBuilder.finalizeAndSign();
  const rawHex = signedTx.toHex();
  const proof = exportProofAsJson(commitment);

  return {
    rawHex,
    result: {
      rawHex,
      feeSatoshis: selection.feeSatoshis,
      changeSatoshis: selection.changeSatoshis,
      totalInputSatoshis: selection.totalInputSatoshis,
      inputCount: selection.selected.length,
      carrierVout,
      commitment,
      proof,
      selectedUtxos: selection.selected.map((utxo) => ({
        txid: utxo.tx_hash,
        vout: utxo.tx_output_n,
        value: utxo.value,
      })),
    },
  };
}

export async function broadcastQuantumCommitmentTx(
  params: BroadcastQuantumParams,
): Promise<QuantumTxResult> {
  const { rawHex, result } = await signQuantumCommitmentTx(params);
  const txid = await broadcastSignedTransaction(rawHex);
  const proof = exportProofAsJson(result.commitment, { txidCommit: txid });
  return { ...result, txid, rawHex, proof };
}

export async function signQuantumRevealTx(
  params: BroadcastQuantumRevealParams,
): Promise<{ rawHex: string; feeSatoshis: number; returnedSatoshis: number }> {
  const {
    txcTxid,
    carrierVout,
    commitment,
    fromAddress,
    privateKeyWIF,
    feeRate: rawFeeRate = 1000,
  } = params;

  const feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, rawFeeRate);
  const txrSize = 10 + 148 + 34 + QUANTUM_OPRETURN_OUTPUT_BYTES;
  const feeSatoshis = Math.max(MIN_FEE, Math.ceil((txrSize * feeRate) / 1000));
  const returnedSatoshis = QUANTUM_CARRIER_VALUE_KOINU - feeSatoshis;

  if (returnedSatoshis < DUST_LIMIT) {
    throw new Error('Carrier return would fall below dust. Lower the fee rate or skip TX_R.');
  }

  const signer = DogeMemoryWallet.fromWIF(privateKeyWIF);
  const txBuilder = createP2PKHTransaction(signer, {
    address: fromAddress,
    inputs: [{ txid: txcTxid, vout: carrierVout, value: QUANTUM_CARRIER_VALUE_KOINU }],
    outputs: [
      { address: fromAddress, value: returnedSatoshis },
      { value: 0, script: buildQuantumRevealReferenceScript(commitment.tag, txcTxid) },
    ] as never,
  });
  const signedTx = await txBuilder.finalizeAndSign();
  return {
    rawHex: signedTx.toHex(),
    feeSatoshis,
    returnedSatoshis,
  };
}

export async function broadcastQuantumRevealTx(
  params: BroadcastQuantumRevealParams & { existingProof?: QuantumProofExport },
): Promise<QuantumRevealResult> {
  const { rawHex, feeSatoshis, returnedSatoshis } = await signQuantumRevealTx(params);
  const txid = await broadcastSignedTransaction(rawHex);
  return {
    txid,
    rawHex,
    feeSatoshis,
    returnedSatoshis,
    proof: {
      ...(params.existingProof ?? exportProofAsJson(params.commitment, { txidCommit: params.txcTxid })),
      txidReveal: txid,
    },
  };
}
