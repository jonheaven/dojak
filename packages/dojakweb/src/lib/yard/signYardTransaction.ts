/**
 * Build + sign YARD tip (transfer) / burn L1 txs via doge-sdk.
 * Output layout: [0]=OP_RETURN commitment, [1]=new seal (tip), then change.
 */

import * as bitcoin from 'bitcoinjs-lib';
import { createP2PKHTransaction, decodePrivateKeyFromWIF, DogeMemoryWallet } from 'doge-sdk';
import {
  broadcastSignedTransaction,
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
  MIN_FEE_RATE_KOINU_PER_BYTE,
  type NormalisedUtxo,
} from '../broadcast/dogecoinTxBroadcast';
import { buildOpReturnLockingScript } from '../tx/opReturn';
import { SOFT_DUST_KOINU } from '../dogecoin/softDust';
import {
  commitmentPayloadForOp,
  decodeConsignmentAny,
  encodeConsignmentJson,
  openNotesFromConsignment,
  type YardConsignment,
} from './consignment';
import {
  OpType,
  compressedPubkeyFromSecret,
  opHash,
  parsePubkeyHex,
  signOperation,
  thisTxOutpoint,
  type YardOperation,
} from './operation';
import { bytesToHex, hexToBytes, sha256d } from './hash';
import { protectOpenNotes, releaseYardSeal, yardSealOutpointKeys } from './seals';

function secretFromWif(wif: string): Uint8Array {
  return decodePrivateKeyFromWIF(wif);
}

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

/** Default seal carrier (0.05 Ð) — matches yard-cli default spirit / soft-dust-safe. */
export const DEFAULT_SEAL_KOINU = 5_000_000;

export type YardSignResult = {
  rawHex: string;
  txid: string;
  consignmentJson: string;
  contractLabel: string;
  feeSatoshis: number;
};

function p2pkhAddressFromPubkey(pubkey: Buffer): string {
  const payment = bitcoin.payments.p2pkh({ pubkey, network: DOGE_NETWORK as bitcoin.Network });
  if (!payment.address) throw new Error('could not derive P2PKH address');
  return payment.address;
}

function findPrevOpHash(cons: YardConsignment, sealKey: string): Buffer {
  const notes = openNotesFromConsignment(cons);
  const note = notes.find((n) => n.sealKey.toLowerCase() === sealKey.toLowerCase());
  if (!note) throw new Error('seal not open in consignment');
  // Walk accepted ops for the one that created this seal
  for (let i = cons.ops.length - 1; i >= 0; i--) {
    const op = cons.ops[i];
    const l1 = sha256d(cons.txs[i]);
    for (const o of op.outputs) {
      const resolved = {
        txid: o.seal.txid.equals(Buffer.alloc(32)) ? l1 : o.seal.txid,
        vout: o.seal.vout,
      };
      const key = `${Buffer.from(resolved.txid).reverse().toString('hex')}:${resolved.vout}`;
      if (key.toLowerCase() === sealKey.toLowerCase()) {
        return opHash(op);
      }
    }
  }
  throw new Error('no accepted op created this seal');
}

async function selectInputs(opts: {
  address: string;
  seal: { txid: string; vout: number; value: number };
  needKoinu: number;
}): Promise<NormalisedUtxo[]> {
  const all = await fetchSpendableUtxosConservativeForAddress(opts.address);
  const excluded = yardSealOutpointKeys(opts.address).filter(
    (k) => k !== `${opts.seal.txid.toLowerCase()}:${opts.seal.vout}`,
  );
  const { safe } = await filterPaymentSpendableUtxos(opts.address, all);
  const sealUtxo = all.find(
    (u) =>
      u.tx_hash.toLowerCase() === opts.seal.txid.toLowerCase() && u.tx_output_n === opts.seal.vout,
  );
  if (!sealUtxo) {
    throw new Error(
      `seal UTXO ${opts.seal.txid}:${opts.seal.vout} not found in wallet — wrong account or already spent`,
    );
  }
  const funding = safe.filter(
    (u) =>
      !(
        u.tx_hash.toLowerCase() === opts.seal.txid.toLowerCase() &&
        u.tx_output_n === opts.seal.vout
      ) && !excluded.includes(`${u.tx_hash.toLowerCase()}:${u.tx_output_n}`),
  );
  const selected: NormalisedUtxo[] = [
    { ...sealUtxo, value: opts.seal.value || sealUtxo.value },
  ];
  let sum = selected[0].value;
  const feePad = 2_000_000; // 0.02 Ð pad for fees
  const target = opts.needKoinu + feePad;
  for (const u of funding.sort((a, b) => b.value - a.value)) {
    if (sum >= target) break;
    selected.push(u);
    sum += u.value;
  }
  if (sum < opts.needKoinu + 100_000) {
    throw new Error(`insufficient funds: have ${sum}, need ~${opts.needKoinu} + fees`);
  }
  return selected;
}

async function signYardL1(opts: {
  privateKeyWIF: string;
  fromAddress: string;
  inputs: NormalisedUtxo[];
  commitment: Buffer;
  sealAddress?: string;
  sealKoinu?: number;
  feeRate?: number;
}): Promise<{ rawHex: string; feeSatoshis: number; txid: string }> {
  const feeRate = opts.feeRate ?? MIN_FEE_RATE_KOINU_PER_BYTE;
  const sealKoinu = opts.sealAddress ? opts.sealKoinu ?? DEFAULT_SEAL_KOINU : 0;
  if (sealKoinu > 0 && sealKoinu < SOFT_DUST_KOINU) {
    throw new Error('seal below 0.01 DOGE soft dust');
  }
  const totalIn = opts.inputs.reduce((s, u) => s + u.value, 0);
  // Rough size: 10 + 148*nIn + 34*nOut + ~50 opreturn
  const nOut = 1 + (opts.sealAddress ? 1 : 0) + 1; // op_return + seal? + change
  const estSize = 10 + 148 * opts.inputs.length + 34 * nOut + 50;
  let fee = Math.max(Math.ceil(estSize * feeRate), 100_000);
  let change = totalIn - sealKoinu - fee;
  if (change > 0 && change < SOFT_DUST_KOINU) {
    fee += change;
    change = 0;
  }
  if (totalIn < sealKoinu + fee) throw new Error('insufficient for seals + fee');

  const outputs: Array<{ value: number; script?: Uint8Array; address?: string }> = [
    { value: 0, script: new Uint8Array(buildOpReturnLockingScript(opts.commitment, 80)) },
  ];
  if (opts.sealAddress && sealKoinu > 0) {
    outputs.push({ value: sealKoinu, address: opts.sealAddress });
  }
  if (change >= SOFT_DUST_KOINU) {
    outputs.push({ value: change, address: opts.fromAddress });
  }

  const signer = DogeMemoryWallet.fromWIF(opts.privateKeyWIF, 'doge');
  const txBuilder = createP2PKHTransaction(signer, {
    address: opts.fromAddress,
    inputs: opts.inputs.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      value: u.value,
    })),
    outputs: outputs as Parameters<typeof createP2PKHTransaction>[1]['outputs'],
  });
  const signed = await txBuilder.finalizeAndSign();
  const rawHex = signed.toHex();
  const txid = Buffer.from(sha256d(hexToBytes(rawHex))).reverse().toString('hex');
  return { rawHex, feeSatoshis: fee, txid };
}

export async function signAndBroadcastYardTip(params: {
  consignment: YardConsignment | string | Uint8Array;
  sealKey: string;
  /** Receiver compressed pubkey hex (33 bytes). */
  toPubkeyHex: string;
  fromAddress: string;
  privateKeyWIF: string;
  /** Note amount to transfer (default: full open note). */
  amount?: bigint;
  sealKoinu?: number;
  broadcast?: boolean;
}): Promise<YardSignResult> {
  const cons =
    typeof params.consignment === 'object' && 'ops' in params.consignment
      ? params.consignment
      : decodeConsignmentAny(params.consignment as string | Uint8Array);
  const notes = openNotesFromConsignment(cons);
  const note = notes.find((n) => n.sealKey.toLowerCase() === params.sealKey.toLowerCase());
  if (!note) throw new Error('seal not found in consignment');

  const sk = secretFromWif(params.privateKeyWIF);
  const ourPk = compressedPubkeyFromSecret(sk);
  if (bytesToHex(ourPk).toLowerCase() !== note.pubkeyHex.toLowerCase()) {
    throw new Error('WIF does not control this seal pubkey');
  }

  const toPk = parsePubkeyHex(params.toPubkeyHex);
  const toAddr = p2pkhAddressFromPubkey(toPk);
  const amount = params.amount ?? note.amount;
  if (amount <= 0n || amount > note.amount) throw new Error('invalid transfer amount');
  if (amount < note.amount) {
    throw new Error('partial tip not supported in lab yet — tip the full note amount');
  }

  const sealKoinu = params.sealKoinu ?? DEFAULT_SEAL_KOINU;
  const [txid, voutStr] = note.sealKey.split(':');
  const inputs = await selectInputs({
    address: params.fromAddress,
    seal: { txid, vout: Number(voutStr), value: 0 },
    needKoinu: sealKoinu,
  });

  const prevOpHash = findPrevOpHash(cons, note.sealKey);
  let op: YardOperation = {
    opVersion: 1,
    contractId: Buffer.from(note.contractId),
    opType: OpType.Transfer,
    inputs: [
      {
        prevOpHash,
        prevSeal: note.seal,
        amount: note.amount,
      },
    ],
    outputs: [
      {
        seal: thisTxOutpoint(1),
        amount,
        pubkey: toPk,
      },
    ],
    meta: Buffer.alloc(0),
    sigs: [Buffer.alloc(64)],
  };
  op = await signOperation(op, 0, sk);
  const commitment = commitmentPayloadForOp(op);

  const signed = await signYardL1({
    privateKeyWIF: params.privateKeyWIF,
    fromAddress: params.fromAddress,
    inputs,
    commitment,
    sealAddress: toAddr,
    sealKoinu,
  });

  const rawTx = hexToBytes(signed.rawHex);
  const outCons: YardConsignment = {
    version: 1,
    ops: [...cons.ops, op],
    txs: [...cons.txs, rawTx],
  };
  const consignmentJson = encodeConsignmentJson(outCons);

  if (params.broadcast !== false) {
    await broadcastSignedTransaction(signed.rawHex);
  }

  releaseYardSeal(params.fromAddress, note.sealKey);
  // Receiver must import the new consignment; sender keeps a backup copy keyed by old seal for audit
  protectOpenNotes({
    address: params.fromAddress,
    ourPubkeyHex: bytesToHex(ourPk),
    notes: openNotesFromConsignment(outCons).filter(
      (n) => n.pubkeyHex.toLowerCase() === bytesToHex(ourPk).toLowerCase(),
    ),
    consignment: outCons,
  });

  return {
    rawHex: signed.rawHex,
    txid: signed.txid,
    consignmentJson,
    contractLabel: note.contractLabel,
    feeSatoshis: signed.feeSatoshis,
  };
}

export async function signAndBroadcastYardBurn(params: {
  consignment: YardConsignment | string | Uint8Array;
  sealKey: string;
  fromAddress: string;
  privateKeyWIF: string;
  /** Amount to burn (default: full note). */
  amount?: bigint;
  broadcast?: boolean;
}): Promise<YardSignResult> {
  const cons =
    typeof params.consignment === 'object' && 'ops' in params.consignment
      ? params.consignment
      : decodeConsignmentAny(params.consignment as string | Uint8Array);
  const notes = openNotesFromConsignment(cons);
  const note = notes.find((n) => n.sealKey.toLowerCase() === params.sealKey.toLowerCase());
  if (!note) throw new Error('seal not found in consignment');

  const sk = secretFromWif(params.privateKeyWIF);
  const ourPk = compressedPubkeyFromSecret(sk);
  if (bytesToHex(ourPk).toLowerCase() !== note.pubkeyHex.toLowerCase()) {
    throw new Error('WIF does not control this seal pubkey');
  }

  const amount = params.amount ?? note.amount;
  if (amount <= 0n || amount > note.amount) throw new Error('invalid burn amount');
  if (amount < note.amount) {
    throw new Error('partial burn not supported in lab yet — burn the full note');
  }

  const [txid, voutStr] = note.sealKey.split(':');
  const inputs = await selectInputs({
    address: params.fromAddress,
    seal: { txid, vout: Number(voutStr), value: 0 },
    needKoinu: 0,
  });

  const prevOpHash = findPrevOpHash(cons, note.sealKey);
  let op: YardOperation = {
    opVersion: 1,
    contractId: Buffer.from(note.contractId),
    opType: OpType.Burn,
    inputs: [
      {
        prevOpHash,
        prevSeal: note.seal,
        amount: note.amount,
      },
    ],
    outputs: [],
    meta: Buffer.alloc(0),
    sigs: [Buffer.alloc(64)],
  };
  op = await signOperation(op, 0, sk);
  const commitment = commitmentPayloadForOp(op);

  const signed = await signYardL1({
    privateKeyWIF: params.privateKeyWIF,
    fromAddress: params.fromAddress,
    inputs,
    commitment,
  });

  const rawTx = hexToBytes(signed.rawHex);
  const outCons: YardConsignment = {
    version: 1,
    ops: [...cons.ops, op],
    txs: [...cons.txs, rawTx],
  };
  const consignmentJson = encodeConsignmentJson(outCons);

  if (params.broadcast !== false) {
    await broadcastSignedTransaction(signed.rawHex);
  }

  releaseYardSeal(params.fromAddress, note.sealKey);

  return {
    rawHex: signed.rawHex,
    txid: signed.txid,
    consignmentJson,
    contractLabel: note.contractLabel,
    feeSatoshis: signed.feeSatoshis,
  };
}
