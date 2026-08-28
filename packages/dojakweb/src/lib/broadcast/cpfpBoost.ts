/**
 * Child-pays-for-parent (CPFP) boost for stuck underpaying parent txs.
 *
 * Spends an unconfirmed change output with a fee high enough that
 * (parentFee + childFee) / (parentSize + childSize) meets the live inclusion rate.
 * Does not require RBF (Dogecoin parents are often sequence=final).
 */

import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import * as bitcoin from 'bitcoinjs-lib';
import { broadcastSignedTransaction, txidFromRawHex } from './dogecoinTxBroadcast';
import { getTxHex } from '../doginal-psdt';
import { enforceBroadcastFeeRateKoinuPerByte } from '../fees/dogecoinFeePolicy';
import { HARD_DUST_KOINU } from '../dogecoin/softDust';
import { fetchCommandDogTxStatus } from '../../utils/api';

const TX_OVERHEAD = 10;
const P2PKH_IN = 148;
const P2PKH_OUT = 34;
/** 1-in / 1-out self-send size. */
const CHILD_VBYTES_1IN_1OUT = TX_OVERHEAD + P2PKH_IN + P2PKH_OUT;

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

export type CpfpBoostParams = {
  parentTxid: string;
  fromAddress: string;
  privateKeyWIF: string;
  /** Prefer this change vout; else largest P2PKH output paying fromAddress. */
  changeVout?: number;
  /** Optional requested child rate (koinu/byte); still raised to package need. */
  feeRateKoinuPerByte?: number;
  /**
   * Extra multiplier on the live inclusion rate for the *package*
   * (default 1.25 — CPFP usually needs to outbid competing packages).
   */
  packageMultiplier?: number;
};

export type CpfpBoostResult = {
  childTxid: string;
  parentTxid: string;
  changeVout: number;
  childFeeKoinu: number;
  parentFeeKoinu: number;
  packageRateKoinuPerByte: number;
  childRawHex: string;
};

type DecodedOut = {
  n: number;
  valueKoinu: number;
  address?: string;
};

function decodeParent(rawHex: string): {
  size: number;
  outs: DecodedOut[];
  tx: bitcoin.Transaction;
} {
  const tx = bitcoin.Transaction.fromHex(rawHex);
  const outs: DecodedOut[] = tx.outs.map((o, n) => {
    let address: string | undefined;
    try {
      address = bitcoin.address.fromOutputScript(o.script, DOGE_NETWORK as bitcoin.Network);
    } catch {
      address = undefined;
    }
    return { n, valueKoinu: Number(o.value), address };
  });
  return { size: tx.virtualSize(), outs, tx };
}

async function parentFeeKoinu(parentHex: string, outs: DecodedOut[]): Promise<number> {
  const outSum = outs.reduce((s, o) => s + o.valueKoinu, 0);
  const tx = bitcoin.Transaction.fromHex(parentHex);
  let inSum = 0;
  for (const input of tx.ins) {
    const prevTxid = Buffer.from(input.hash).reverse().toString('hex');
    const prevHex = await getTxHex(prevTxid);
    const prev = bitcoin.Transaction.fromHex(prevHex);
    const prevOut = prev.outs[input.index];
    if (!prevOut) throw new Error(`Missing prevout ${prevTxid}:${input.index}`);
    inSum += Number(prevOut.value);
  }
  if (inSum <= outSum) {
    throw new Error(`Invalid parent fee math (in=${inSum} out=${outSum})`);
  }
  return inSum - outSum;
}

function pickChangeOut(
  outs: DecodedOut[],
  fromAddress: string,
  preferredVout?: number,
): DecodedOut {
  const addr = fromAddress.trim();
  if (preferredVout != null) {
    const hit = outs.find((o) => o.n === preferredVout);
    if (!hit) throw new Error(`Parent has no vout ${preferredVout}`);
    if (hit.address && hit.address.toLowerCase() !== addr.toLowerCase()) {
      throw new Error(`Vout ${preferredVout} pays ${hit.address}, not ${addr}`);
    }
    if (hit.valueKoinu < HARD_DUST_KOINU * 2) {
      throw new Error(`Vout ${preferredVout} is too small to CPFP`);
    }
    return hit;
  }
  const candidates = outs
    .filter(
      (o) =>
        o.address &&
        o.address.toLowerCase() === addr.toLowerCase() &&
        o.valueKoinu >= HARD_DUST_KOINU * 2,
    )
    .sort((a, b) => b.valueKoinu - a.valueKoinu);
  if (!candidates.length) {
    throw new Error(
      `No spendable change output back to ${addr} on the parent tx. CPFP needs the large change out.`,
    );
  }
  return candidates[0]!;
}

/**
 * Build, sign, and broadcast a CPFP child that spends parent change.
 */
export async function boostParentWithCpfp(params: CpfpBoostParams): Promise<CpfpBoostResult> {
  const parentTxid = params.parentTxid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(parentTxid)) throw new Error('Invalid parent txid');

  const st = await fetchCommandDogTxStatus(parentTxid);
  if (st?.in_block || (st?.confirmations ?? 0) > 0) {
    throw new Error('Parent is already confirmed — CPFP not needed.');
  }

  const parentHex = await getTxHex(parentTxid);
  const decoded = decodeParent(parentHex);
  const change = pickChangeOut(decoded.outs, params.fromAddress, params.changeVout);
  const parentFee = await parentFeeKoinu(parentHex, decoded.outs);
  const parentSize = decoded.size > 0 ? decoded.size : Math.ceil(parentHex.length / 2);

  const baseRate = await enforceBroadcastFeeRateKoinuPerByte({
    requestedKoinuPerByte: params.feeRateKoinuPerByte,
    context: 'cpfpBoost',
  });
  const mult = Math.max(1, params.packageMultiplier ?? 1.25);
  const packageRate = Math.ceil(baseRate * mult);

  const childSize = CHILD_VBYTES_1IN_1OUT;
  const packageSize = parentSize + childSize;
  const neededPackageFee = packageSize * packageRate;
  let childFee = Math.max(HARD_DUST_KOINU, neededPackageFee - parentFee);
  let sendValue = change.valueKoinu - childFee;
  if (sendValue < HARD_DUST_KOINU) {
    sendValue = HARD_DUST_KOINU;
    childFee = change.valueKoinu - sendValue;
  }

  const signer = DogeMemoryWallet.fromWIF(params.privateKeyWIF, 'doge');
  const signedTx = await createP2PKHTransaction(signer, {
    address: params.fromAddress,
    inputs: [{ txid: parentTxid, vout: change.n, value: change.valueKoinu }],
    outputs: [{ address: params.fromAddress, value: sendValue }],
  }).finalizeAndSign();

  const rawHex = signedTx.toHex();
  const childTxid = await broadcastSignedTransaction(rawHex);
  const computed = await txidFromRawHex(rawHex).catch(() => childTxid);

  return {
    childTxid: computed || childTxid,
    parentTxid,
    changeVout: change.n,
    childFeeKoinu: childFee,
    parentFeeKoinu: parentFee,
    packageRateKoinuPerByte: packageRate,
    childRawHex: rawHex,
  };
}
