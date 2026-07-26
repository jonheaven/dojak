/**
 * Pre-sign fee / coin-select quote for plain DOGE payments.
 */
import { coinSelectP2PKH } from 'doge-sdk';
import { assertValidDogecoinAddress } from './dogecoinAddressValidate';
import { getPaymentUtxosForSend } from './paymentUtxos';

const FEE_RATE = 1_000; // koinu/byte — Dogecoin-reliable default
const DUST_KOINU = 100_000; // 0.001 DOGE

export type PaymentSendQuote = {
  recipient: string;
  amountDoge: number;
  amountKoinu: number;
  feeKoinu: number;
  feeDoge: number;
  /** Amount + network fee (value leaving selected UTXOs before change returns). */
  totalDebitDoge: number;
  changeKoinu: number;
  changeDoge: number;
  inputCount: number;
  outputCount: number;
  spendableKoinu: number;
  spendableDoge: number;
};

function toKoinu(doge: number): number {
  return Math.round(doge * 1e8);
}

function toDoge(koinu: number): number {
  return Math.round(koinu) / 1e8;
}

export async function estimatePaymentSend(params: {
  fromAddress: string;
  recipientAddress: string;
  amountDoge: number;
}): Promise<PaymentSendQuote> {
  const recipient = assertValidDogecoinAddress(params.recipientAddress);
  const amountDoge = Number(params.amountDoge);
  if (!Number.isFinite(amountDoge) || amountDoge <= 0) {
    throw new Error('Enter a valid DOGE amount.');
  }
  const amountKoinu = toKoinu(amountDoge);
  if (amountKoinu < DUST_KOINU) {
    throw new Error('Amount is below the network dust limit (0.001 DOGE).');
  }

  const utxos = await getPaymentUtxosForSend(params.fromAddress);
  if (!utxos.length) {
    throw new Error('No spendable DOGE found. Wait for recent txs to confirm, then retry.');
  }

  const spendableKoinu = utxos.reduce((s, u) => s + u.value, 0);
  const selected = coinSelectP2PKH(
    params.fromAddress,
    FEE_RATE,
    utxos.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value })),
    [{ address: recipient, value: amountKoinu }],
  );

  const feeKoinu = selected.fee;
  const changeKoinu = Math.max(
    0,
    selected.inputs.reduce((s, u) => s + u.value, 0) - amountKoinu - feeKoinu,
  );

  return {
    recipient,
    amountDoge: toDoge(amountKoinu),
    amountKoinu,
    feeKoinu,
    feeDoge: toDoge(feeKoinu),
    totalDebitDoge: toDoge(amountKoinu + feeKoinu),
    changeKoinu,
    changeDoge: toDoge(changeKoinu),
    inputCount: selected.inputs.length,
    outputCount: selected.outputs.length,
    spendableKoinu,
    spendableDoge: toDoge(spendableKoinu),
  };
}

/** Largest sendable amount given current UTXOs (binary-search style refine). */
export async function estimateMaxSendableDoge(fromAddress: string): Promise<number> {
  const utxos = await getPaymentUtxosForSend(fromAddress);
  const spendable = utxos.reduce((s, u) => s + u.value, 0);
  if (spendable <= DUST_KOINU + FEE_RATE * 250) return 0;

  // Rough first pass: leave headroom for ~2-in / 2-out tx
  let hi = spendable - FEE_RATE * 400;
  if (hi < DUST_KOINU) return 0;

  try {
    const q = await estimatePaymentSend({
      fromAddress,
      recipientAddress: fromAddress, // self — valid for sizing only
      amountDoge: toDoge(hi),
    });
    // Adjust down by actual fee delta if needed
    const maxKoinu = Math.max(0, spendable - q.feeKoinu);
    return toDoge(Math.min(hi, maxKoinu));
  } catch {
    // Shrink until coin select works
    for (let attempt = 0; attempt < 8; attempt++) {
      hi = Math.floor(hi * 0.92);
      if (hi < DUST_KOINU) return 0;
      try {
        await estimatePaymentSend({
          fromAddress,
          recipientAddress: fromAddress,
          amountDoge: toDoge(hi),
        });
        return toDoge(hi);
      } catch {
        /* continue */
      }
    }
    return 0;
  }
}
