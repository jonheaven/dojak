/**
 * Dogecoin Charms launch tx helpers — funding UTXO pick, commit→reveal link, legacy tx → PSBT.
 */

import * as bitcoin from 'bitcoinjs-lib';

import type { NormalisedUtxo } from '../broadcast/dogecoinTxBroadcast';
import { DOGE_NETWORK } from '../dogetag/dogecoinAddress';

/**
 * One funding input for a Charms prove. Prefer the smallest coin that clears
 * 10 DOGE so a launch does not lock a 50 DOGE UTXO when a smaller one can pay.
 * If nothing clears the floor, use the largest coin we have.
 */
const CHARMS_FUNDING_FLOOR_KOINU = 1_000_000_000;

export function pickFundingUtxo(utxos: NormalisedUtxo[]): NormalisedUtxo | null {
  const sorted = utxos
    .filter((u) => Number.isFinite(u.value) && u.value > 0)
    .sort((a, b) => a.value - b.value);
  if (!sorted.length) return null;
  return sorted.find((u) => u.value >= CHARMS_FUNDING_FLOOR_KOINU) ?? sorted[sorted.length - 1]!;
}

/** Wire reveal input[0] to the commit txid (bitcoinjs stores tx hash reversed). */
export function linkRevealToCommit(revealTxHex: string, commitTxid: string, vout = 0): string {
  const tx = bitcoin.Transaction.fromHex(revealTxHex);
  if (tx.ins.length === 0) {
    throw new Error('Reveal transaction has no inputs to link');
  }
  tx.ins[0].hash = Buffer.from(commitTxid, 'hex').reverse();
  tx.ins[0].index = vout;
  return tx.toHex();
}

/** True when any input has an empty scriptSig (wallet must sign). */
export function txNeedsWalletSign(txHex: string): boolean {
  const tx = bitcoin.Transaction.fromHex(txHex);
  return tx.ins.some((input) => !input.script || input.script.length === 0);
}

/**
 * Convert an unsigned legacy tx hex into a PSBT hex wallet extensions can sign.
 * Uses nonWitnessUtxo for inputs whose prev tx hex is known.
 */
export function unsignedLegacyTxToPsbtHex(
  unsignedTxHex: string,
  prevTxHexByTxid: Record<string, string>,
): string {
  const tx = bitcoin.Transaction.fromHex(unsignedTxHex);
  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
  psbt.setVersion(tx.version);
  psbt.setLocktime(tx.locktime);

  for (const input of tx.ins) {
    const txid = Buffer.from(input.hash).reverse().toString('hex');
    const prevHex = prevTxHexByTxid[txid];
    const addInput: Parameters<bitcoin.Psbt['addInput']>[0] = {
      hash: txid,
      index: input.index,
      sequence: input.sequence,
    };
    if (prevHex) {
      addInput.nonWitnessUtxo = Buffer.from(prevHex, 'hex');
    }
    psbt.addInput(addInput);
  }

  for (const output of tx.outs) {
    psbt.addOutput({
      script: output.script,
      value: BigInt(output.value),
    } as any);
  }

  return Buffer.from(psbt.toBuffer()).toString('hex');
}
