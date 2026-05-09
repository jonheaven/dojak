/**
 * Human-readable decode of OpenOrdex-style buy PSBTs for review before broadcast.
 */

import * as bitcoin from 'bitcoinjs-lib';
import { DOGE_NETWORK } from './doginal-psdt';

export type BuyReviewInputRow = {
  index: number;
  role: string;
  outpoint: string;
  valueShibes: number | null;
};

export type BuyReviewOutputRow = {
  index: number;
  role: string;
  address: string;
  valueShibes: number;
};

export type BuyPsbtReview = {
  inputs: BuyReviewInputRow[];
  outputs: BuyReviewOutputRow[];
  /** Sum(inputs) − sum(outputs) when every input value is known from the PSBT. */
  impliedFeeShibes: number | null;
  totalInShibes: number | null;
  totalOutShibes: number;
};

function outValueShibes(out: { value: number | bigint }): number {
  const v = out.value;
  return typeof v === 'bigint' ? Number(v) : Math.floor(Number(v));
}

function valueFromPsbtInput(psbt: bitcoin.Psbt, vin: number): number | null {
  const inp = psbt.data.inputs[vin];
  if (inp.witnessUtxo) return Number(inp.witnessUtxo.value);
  if (inp.nonWitnessUtxo) {
    try {
      const tx = bitcoin.Transaction.fromBuffer(inp.nonWitnessUtxo as Buffer);
      const idx = psbt.txInputs[vin].index;
      const o = tx.outs[idx];
      return o ? outValueShibes(o) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function buyOutputRole(i: number, nOut: number): string {
  if (i === 0) return 'Seller payment (listing price)';
  if (i === 1) return 'Inscription + merged dummy → you';
  if (i === 2) return 'New dummy UTXO (you)';
  if (i === 3 && nOut >= 4) return 'Change (you)';
  return `Output ${i}`;
}

function scriptToAddress(script: Buffer): string {
  try {
    return bitcoin.address.fromOutputScript(script, DOGE_NETWORK);
  } catch {
    return '(non-standard script)';
  }
}

/** Decode unsigned buy PSBT: inputs with roles + values, outputs with Dogecoin addresses. */
export function decodeBuyPsbtForReview(psbtBase64: string): BuyPsbtReview {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64.trim(), { network: DOGE_NETWORK });
  const nIn = psbt.inputCount;
  const inputs: BuyReviewInputRow[] = [];
  for (let i = 0; i < nIn; i++) {
    const tin = psbt.txInputs[i];
    const txid = Buffer.from(tin.hash).reverse().toString('hex');
    const role =
      i === 0 ? 'Inscription (seller-signed)' : i === 1 ? 'Your dummy UTXO' : 'Your payment UTXO';
    inputs.push({
      index: i,
      role,
      outpoint: `${txid}:${tin.index}`,
      valueShibes: valueFromPsbtInput(psbt, i),
    });
  }

  const nOut = psbt.txOutputs.length;
  const outputs: BuyReviewOutputRow[] = [];
  let totalOut = 0;
  for (let i = 0; i < nOut; i++) {
    const out = psbt.txOutputs[i];
    const v = outValueShibes(out);
    totalOut += v;
    const script = Buffer.from(out.script);
    outputs.push({
      index: i,
      role: buyOutputRole(i, nOut),
      address: scriptToAddress(script),
      valueShibes: v,
    });
  }

  const knownIn = inputs.map((x) => x.valueShibes).filter((v): v is number => v != null);
  const totalIn = knownIn.length === inputs.length ? knownIn.reduce((a, b) => a + b, 0) : null;
  const impliedFeeShibes = totalIn != null ? totalIn - totalOut : null;

  return {
    inputs,
    outputs,
    impliedFeeShibes,
    totalInShibes: totalIn,
    totalOutShibes: totalOut,
  };
}

export type SignedBuyTxSummary = {
  txid: string;
  inputOutpoints: string[];
  outputs: BuyReviewOutputRow[];
};

/** After signing: full txid + output side; inputs are outpoints only (amounts live in prior PSBT review). */
export function decodeSignedBuyTxHex(txHex: string): SignedBuyTxSummary {
  const tx = bitcoin.Transaction.fromHex(txHex.trim());
  const txid = tx.getId();
  const inputOutpoints = tx.ins.map(
    (inp) => `${Buffer.from(inp.hash).reverse().toString('hex')}:${inp.index}`,
  );
  const nOut = tx.outs.length;
  const outputs: BuyReviewOutputRow[] = [];
  for (let i = 0; i < nOut; i++) {
    const out = tx.outs[i];
    const v = outValueShibes(out);
    outputs.push({
      index: i,
      role: buyOutputRole(i, nOut),
      address: scriptToAddress(out.script),
      valueShibes: v,
    });
  }
  return { txid, inputOutpoints, outputs };
}

const SESSION_VERSION = 1 as const;
export const BUY_INSCRIPTION_SESSION_KEY = 'dojakweb-buy-inscription-session-v1';

export type BuyInscriptionSessionV1 = {
  version: typeof SESSION_VERSION;
  buyerAddress: string;
  pasteFingerprint: string;
  paste: string;
  sellerPsbt: string;
  validationSafeToSign: boolean;
  validationPriceKoinu: number;
  validationInscriptionUtxo: string | null;
  /** Claimed doginal id from listing URL; restores Doggy preview after refresh */
  validationInscriptionId: string | null;
  buyPsbt: string | null;
  /** Raw wallet response (PSBT or hex) after sign — for debugging / re-coerce. */
  signedWalletPayload: string | null;
  signedTxHex: string | null;
  lastTxid: string | null;
  /** Last raw hex successfully or attempted broadcast — for “Re-broadcast same tx” after refresh. */
  lastBroadcastRawHex?: string | null;
  /** Buyer-side outpoints to skip after mempool / double-spend conflicts (`txid:vout`, lowercase txid). */
  locallyBlockedOutpoints?: string[];
  updatedAt: number;
};

export function fingerprintPaste(paste: string): string {
  const s = paste.trim().slice(0, 400);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `${s.length}:${h.toString(16)}`;
}

export function loadBuyInscriptionSession(): BuyInscriptionSessionV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BUY_INSCRIPTION_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as BuyInscriptionSessionV1;
    if (p.version !== SESSION_VERSION || typeof p.buyerAddress !== 'string') return null;
    return p;
  } catch {
    return null;
  }
}

export function saveBuyInscriptionSession(session: BuyInscriptionSessionV1): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BUY_INSCRIPTION_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota */
  }
}

export function clearBuyInscriptionSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(BUY_INSCRIPTION_SESSION_KEY);
  } catch {
    /* */
  }
}
