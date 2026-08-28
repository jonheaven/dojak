/**
 * Pre-sign fee / coin-select quote for plain DOGE payments.
 */
import { coinSelectP2PKH } from 'doge-sdk';
import { assertValidDogecoinAddress } from './dogecoinAddressValidate';
import { fixCoinSelectP2PKHFee } from './fixCoinSelectP2PKHFee';
import { getPaymentUtxosForSend } from './paymentUtxos';
import { resolveRequestedOrPreferredFeeRateKoinuPerByte } from './fees/txFeePreference';

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
    throw new Error(
      'No spendable DOGE found. Wait for recent txs to confirm (casino bets / prior sends lock coins until indexers catch up), then retry.',
    );
  }

  const spendableKoinu = utxos.reduce((s, u) => s + u.value, 0);
  if (spendableKoinu < amountKoinu) {
    throw new Error(
      `Not enough spendable DOGE: you asked to send ${toDoge(amountKoinu)} Ð, but only ${toDoge(spendableKoinu)} Ð is spendable right now. The rest is usually inscription carriers (0.001 Ð), locked coins, or inputs still held by a recent / stuck mempool send — open ··· → Coins & UTXOs.`,
    );
  }

  const FEE_RATE = await resolveRequestedOrPreferredFeeRateKoinuPerByte(
    null,
    'estimatePaymentSend',
  );

  let selected: ReturnType<typeof coinSelectP2PKH>;
  try {
    selected = coinSelectP2PKH(
      params.fromAddress,
      FEE_RATE,
      utxos.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value })),
      [{ address: recipient, value: amountKoinu }],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/insufficient/i.test(msg)) {
      throw new Error(
        `Not enough spendable DOGE for ${toDoge(amountKoinu)} Ð plus network fee. Spendable right now: ${toDoge(spendableKoinu)} Ð. Try a smaller amount or tap Max.`,
      );
    }
    throw e;
  }

  // doge-sdk underpays on-chain; recompute change from full size×rate fee.
  let fixed: ReturnType<typeof fixCoinSelectP2PKHFee>;
  try {
    fixed = fixCoinSelectP2PKHFee({
      changeAddress: params.fromAddress,
      feeRateKoinuPerByte: FEE_RATE,
      inputs: selected.inputs,
      payments: [{ address: recipient, value: amountKoinu }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/insufficient/i.test(msg)) {
      throw new Error(
        `Not enough spendable DOGE for ${toDoge(amountKoinu)} Ð plus network fee. Spendable right now: ${toDoge(spendableKoinu)} Ð. Try a smaller amount or tap Max.`,
      );
    }
    throw e;
  }

  const feeKoinu = fixed.fee;
  const changeKoinu = fixed.change;

  return {
    recipient,
    amountDoge: toDoge(amountKoinu),
    amountKoinu,
    feeKoinu,
    feeDoge: toDoge(feeKoinu),
    totalDebitDoge: toDoge(amountKoinu + feeKoinu),
    changeKoinu,
    changeDoge: toDoge(changeKoinu),
    inputCount: fixed.inputs.length,
    outputCount: fixed.outputs.length,
    spendableKoinu,
    spendableDoge: toDoge(spendableKoinu),
  };
}

/** Largest sendable amount given current UTXOs (binary-search style refine). */
export async function estimateMaxSendableDoge(fromAddress: string): Promise<number> {
  const utxos = await getPaymentUtxosForSend(fromAddress);
  const spendable = utxos.reduce((s, u) => s + u.value, 0);
  const feeRate = await resolveRequestedOrPreferredFeeRateKoinuPerByte(null, 'estimateMaxSendable');
  if (spendable <= DUST_KOINU + feeRate * 250) return 0;

  // Rough first pass: leave headroom for ~2-in / 2-out tx
  let hi = spendable - feeRate * 400;
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
