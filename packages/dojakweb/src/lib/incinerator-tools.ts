/**
 * ÐIncinerator — spend Doginal carriers into a valued OP_RETURN (ord circulating burn).
 *
 * Layout (required for satpoint assignment):
 *   vin 0..n-1  inscription UTXOs (postage stays in the burn output)
 *   vin n..     plain DOGE for the miner fee
 *   vout 0      OP_RETURN ÐI with value = sum(inscription values)
 *   vout 1      optional change ≥ 0.01 Ð
 *
 * A zero-value OP_RETURN does **not** absorb sats — the inscription would land on change.
 */
import * as bitcoin from 'bitcoinjs-lib';
import { SOFT_DUST_KOINU, mineableFeeKoinu } from './dogecoin/softDust';
import { DOGE_NETWORK, getTxHex } from './doginal-psdt';

/** UTF-8 `ÐI` — product tag (not required for the indexer burn). */
export const INCINERATOR_TAG = '\u00d0I';

export const MAX_INCINERATOR_BATCH = 20;

export interface IncineratorUtxo {
  txid: string;
  vout: number;
  value: number;
}

export interface IncineratorTxResult {
  psbtBase64: string;
  fee: number;
  burnedPostageKoinu: number;
  changeAmount: number;
  inputCount: number;
  opReturnScriptHex: string;
}

export function buildIncineratorOpReturnScript(tag: string = INCINERATOR_TAG): Buffer {
  const data = Buffer.from(tag, 'utf8');
  if (data.length < 1 || data.length > 75) {
    throw new Error('Incinerator OP_RETURN tag must be 1–75 bytes');
  }
  return bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, data]);
}

function sameOutpoint(a: IncineratorUtxo, b: IncineratorUtxo): boolean {
  return a.txid.toLowerCase() === b.txid.toLowerCase() && a.vout === b.vout;
}

function estimateBurnVsize(inputCount: number, hasChange: boolean, opReturnScriptLen: number): number {
  const opr = 8 + 1 + opReturnScriptLen;
  return 10 + inputCount * 148 + opr + (hasChange ? 34 : 0);
}

function planBurnFee(params: {
  inputCount: number;
  availableFeeKoinu: number;
  opReturnScriptLen: number;
}): { fee: number; change: number; hasChange: boolean } {
  const { inputCount, availableFeeKoinu, opReturnScriptLen } = params;
  const feeWithChange = mineableFeeKoinu({
    vsize: estimateBurnVsize(inputCount, true, opReturnScriptLen),
    outputValuesKoinu: [SOFT_DUST_KOINU],
  });
  const change = availableFeeKoinu - feeWithChange;
  if (change >= SOFT_DUST_KOINU) {
    return { fee: feeWithChange, change, hasChange: true };
  }
  const feeNoChange = mineableFeeKoinu({
    vsize: estimateBurnVsize(inputCount, false, opReturnScriptLen),
    outputValuesKoinu: [],
  });
  return { fee: feeNoChange, change: 0, hasChange: false };
}

/**
 * Build a PSBT that moves inscription carriers into unspendable OP_RETURN.
 * Fees MUST come from extra plain UTXOs — never from postage.
 */
export async function createInscriptionIncineratorTransaction(params: {
  ownerAddress: string;
  inscriptionUtxos: IncineratorUtxo[];
  feeUtxos: IncineratorUtxo[];
}): Promise<IncineratorTxResult> {
  const ownerAddress = params.ownerAddress.trim();
  if (ownerAddress.length < 26) throw new Error('Owner address is required');

  const seen = new Set<string>();
  const inscriptionUtxos: IncineratorUtxo[] = [];
  for (const u of params.inscriptionUtxos) {
    const key = `${u.txid.toLowerCase()}:${u.vout}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const value = Math.floor(Number(u.value) || 0);
    if (value < 1) throw new Error('Inscription UTXO has no value');
    inscriptionUtxos.push({ txid: u.txid, vout: u.vout, value });
  }
  if (inscriptionUtxos.length < 1) {
    throw new Error('Pick at least one inscription to burn');
  }
  if (inscriptionUtxos.length > MAX_INCINERATOR_BATCH) {
    throw new Error(`Burn at most ${MAX_INCINERATOR_BATCH} inscriptions per transaction`);
  }

  const burnedPostageKoinu = inscriptionUtxos.reduce((s, u) => s + u.value, 0);
  const opReturnScript = buildIncineratorOpReturnScript();
  const opReturnScriptLen = opReturnScript.length;

  const spendableFee = [...params.feeUtxos]
    .filter((u) => u.value > 0 && !inscriptionUtxos.some((ins) => sameOutpoint(ins, u)))
    .sort((a, b) => b.value - a.value);

  const selectedFee: IncineratorUtxo[] = [];
  let feeTotal = 0;
  let plan = planBurnFee({
    inputCount: inscriptionUtxos.length,
    availableFeeKoinu: 0,
    opReturnScriptLen,
  });
  for (const u of spendableFee) {
    selectedFee.push(u);
    feeTotal += u.value;
    plan = planBurnFee({
      inputCount: inscriptionUtxos.length + selectedFee.length,
      availableFeeKoinu: feeTotal,
      opReturnScriptLen,
    });
    if (feeTotal >= plan.fee) break;
  }
  if (feeTotal < plan.fee) {
    throw new Error(
      `Not enough plain DOGE to pay the burn fee. Need ~${(plan.fee / 1e8).toFixed(4)} DOGE besides the inscription postage (postage is destroyed in OP_RETURN).`,
    );
  }

  const actualFee = plan.hasChange ? plan.fee : feeTotal;
  const change = plan.hasChange ? plan.change : 0;

  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
  for (const u of [...inscriptionUtxos, ...selectedFee]) {
    const txHex = await getTxHex(u.txid);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
      sequence: 0xffffffff,
    } as any);
  }

  psbt.addOutput({ script: opReturnScript, value: BigInt(burnedPostageKoinu) });
  if (plan.hasChange && change >= SOFT_DUST_KOINU) {
    psbt.addOutput({ address: ownerAddress, value: BigInt(change) });
  }

  return {
    psbtBase64: psbt.toBase64(),
    fee: actualFee,
    burnedPostageKoinu,
    changeAmount: change,
    inputCount: inscriptionUtxos.length + selectedFee.length,
    opReturnScriptHex: opReturnScript.toString('hex'),
  };
}
