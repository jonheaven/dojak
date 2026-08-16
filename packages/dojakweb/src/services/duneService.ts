/**
 * Dune transaction builder — etch, mint, and send dunes on Dogecoin.
 *
 * Layout matches wonky-ord `wallet send` dunes (edict + postage outs), with our
 * v2 magic (`0xD0` / ver `0x02`) and an explicit pointer so partial sends park
 * remainder on a dedicated 0.001 Ð carrier (same sentinel as inscriptions) so
 * inscription-aware wallets will not spend leftover Ðunes as fee:
 *   OP_RETURN (0) → recipient postage (1) → remainder postage (2, pointer) → DOGE change (3)
 *
 * Chain truth: wallet-provider UTXOs filtered by command.dog Core `gettxout`
 * (`POST /v1/utxos/live`). Broadcast / confirm via command.dog — not BlockCypher.
 */

import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
  txidFromRawHex,
  type NormalisedUtxo,
} from '../lib/broadcast/dogecoinTxBroadcast';
import { broadcastTx, coerceSignedPsdtToRawTxHex, getTxHex } from '../lib/doginal-psdt';
import type { DuneTxSigner } from '../lib/dune-tx-signer';
import { assertDuneTxSigner } from '../lib/dune-tx-signer';
import {
  buildAirdropSendScript,
  buildEtchScript,
  buildMintScript,
  buildSendScript,
  packDuneAirdropBatches,
  parseSpacedDune,
  uniqueEtchBurnKoinu,
  type DuneTerms,
} from '../lib/dunestone';
import {
  HARD_DUST_KOINU,
  SOFT_DUST_KOINU,
  discardSoftDustChangeKoinu,
  mineableFeeKoinu,
  assertHardDustKoinu,
} from '../lib/dogecoin/softDust';
import {
  mergePaymentUtxos,
  recordPaymentBroadcast,
  markOutpointsSpent,
  isInputsSpentBroadcastError,
  friendlyPaymentSendError,
  listLocallySpentOutpointKeys,
} from '../lib/mempoolSpendOverlay';
import { upsertWalletTxJournalEntry, type DojakwebWalletTxProtocol } from '../lib/wallet-tx-journal';
import { filterUtxosByRpcGetTxOutIfConfigured } from '../lib/utxo-tools';
import { DOGEX_PUBLIC_INDEXER_URL, getIndexerApiBase } from '../utils/api';

// ── Constants ────────────────────────────────────────────────────────────────

/** Minimum relay fee floor (koinu). */
const MIN_FEE_KOINU = HARD_DUST_KOINU;

/** Postage for a dune-bearing output — 0.001 Ð (inscription carrier). Soft-dust fee add-on is paid in `mineableFeeKoinu`. */
const POSTAGE_KOINU = HARD_DUST_KOINU;

/** Byte size estimates for fee calculation. */
const TX_OVERHEAD      = 10;
const PER_INPUT_BYTES  = 148;
const PER_OUTPUT_BYTES = 34;

function canonicalizeBroadcastTxid(relayTxid: string | undefined, computedTxid: string): string {
  const computed = computedTxid.trim().toLowerCase();
  const relay = relayTxid?.trim().toLowerCase() ?? '';

  if (/^[a-f0-9]{64}$/.test(relay)) {
    if (relay !== computed) {
      console.warn('[dojakweb:dunes] relay txid did not match signed raw tx; using computed txid', {
        relayTxid: relay,
        computedTxid: computed,
      });
      return computed;
    }
    return relay;
  }

  if (relay) {
    console.warn('[dojakweb:dunes] relay returned a non-txid success payload; using computed txid', {
      relayTxid: relay,
      computedTxid: computed,
    });
  }
  return computed;
}

async function broadcastDuneTransaction(
  rawHex: string,
  overlay?: {
    address: string;
    spent: Array<{ txid: string; vout: number }>;
    change: { vout: number; value: number } | null;
  },
): Promise<string> {
  const computedTxid = await txidFromRawHex(rawHex);
  const relayTxid = await broadcastTx(rawHex);
  const txid = canonicalizeBroadcastTxid(relayTxid, computedTxid);
  if (overlay) {
    recordPaymentBroadcast({
      address: overlay.address,
      txid,
      spent: overlay.spent,
      change: overlay.change,
    });
  }
  return txid;
}

// ── Fee calculation ───────────────────────────────────────────────────────────

function estimateTxSize(inputCount: number, outputCount: number, opReturnBytes: number): number {
  // OP_RETURN output: value (8) + script_len varint (1) + script bytes
  const opReturnOutputSize = 9 + opReturnBytes;
  return TX_OVERHEAD
    + inputCount * PER_INPUT_BYTES
    + (outputCount - 1) * PER_OUTPUT_BYTES  // non-OP_RETURN outputs
    + opReturnOutputSize;
}

function calcFee(
  inputCount: number,
  outputCount: number,
  opReturnBytes: number,
  feeRate: number,
  /** Non-OP_RETURN output values (koinu) — soft-dust outputs add SOFT_DUST_KOINU each. */
  outputValues: number[] = [],
): number {
  const size = estimateTxSize(inputCount, outputCount, opReturnBytes);
  return mineableFeeKoinu({
    vsize: size,
    feeRateKoinuPerKb: feeRate,
    outputValuesKoinu: outputValues,
    minFeeFloorKoinu: MIN_FEE_KOINU,
  });
}

// ── UTXO coin selection ───────────────────────────────────────────────────────

interface CoinSelection {
  selected: NormalisedUtxo[];
  totalSats: number;
  feeSatoshis: number;
  changeSatoshis: number;
}

function outpointKey(u: Pick<NormalisedUtxo, 'tx_hash' | 'tx_output_n'>): string {
  return `${u.tx_hash.trim().toLowerCase()}:${u.tx_output_n}`;
}

function selectCoins(
  utxos: NormalisedUtxo[],
  requiredOutputSats: number,  // non-OP_RETURN outputs total
  outputCount: number,         // total outputs including OP_RETURN
  opReturnBytes: number,
  feeRate: number,
  /** Values of non-OP_RETURN outputs that will exist before change (koinu). */
  fixedOutputValues: number[] = [],
  /** Ðune-bearing (or otherwise required) inputs — always spent first. */
  mustInclude: NormalisedUtxo[] = [],
): CoinSelection {
  const mustKeys = new Set(mustInclude.map(outpointKey));
  const sorted = [...utxos]
    .filter((u) => !mustKeys.has(outpointKey(u)))
    .sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [...mustInclude];
  let totalSats = mustInclude.reduce((s, u) => s + u.value, 0);
  // Assume change exists for size estimate; soft-dust on fixed outs only until we know change.
  let fee = calcFee(
    Math.max(1, selected.length),
    outputCount,
    opReturnBytes,
    feeRate,
    fixedOutputValues,
  );

  const tryFinish = () => {
    fee = calcFee(selected.length, outputCount, opReturnBytes, feeRate, fixedOutputValues);
    const needed = fee + requiredOutputSats + SOFT_DUST_KOINU;
    return totalSats >= needed;
  };

  if (!tryFinish()) {
    for (const utxo of sorted) {
      selected.push(utxo);
      totalSats += utxo.value;
      if (tryFinish()) break;
    }
  } else {
    fee = calcFee(selected.length, outputCount, opReturnBytes, feeRate, fixedOutputValues);
  }

  let needed = fee + requiredOutputSats;
  if (totalSats < needed) {
    const shortfall = ((needed - totalSats) / 1e8).toFixed(4);
    throw new Error(
      `Insufficient funds: need ${(needed / 1e8).toFixed(4)} DOGE, have ${(totalSats / 1e8).toFixed(4)} DOGE (short ${shortfall} DOGE).`,
    );
  }

  let changeSatoshis = totalSats - needed;
  changeSatoshis = discardSoftDustChangeKoinu(changeSatoshis);
  return { selected, totalSats, feeSatoshis: totalSats - requiredOutputSats - changeSatoshis, changeSatoshis };
}

// ── Transaction builder ───────────────────────────────────────────────────────

interface SignTxParams {
  fromAddress: string;
  privateKeyWIF: string;
  opReturnScript: Uint8Array;
  extraOutputs: Array<{ address: string; value: number }>;
  utxos: NormalisedUtxo[];
  feeRate: number;
  mustIncludeUtxos?: NormalisedUtxo[];
  forceChangeOutput?: boolean;
  opReturnValue?: number;
}

interface BuiltTx {
  rawHex: string;
  feeSatoshis: number;
  changeSatoshis: number;
  inputCount: number;
  fromAddress: string;
  spent: Array<{ txid: string; vout: number }>;
  /** Change output index in the final tx (after OP_RETURN + extras), if any. */
  change: { vout: number; value: number } | null;
}

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

interface BuildDuneTxParams {
  fromAddress: string;
  opReturnScript: Uint8Array;
  extraOutputs: Array<{ address: string; value: number }>;
  utxos: NormalisedUtxo[];
  feeRate: number;
  /** Always spend these first (Ðune-bearing outpoints). */
  mustIncludeUtxos?: NormalisedUtxo[];
  /**
   * Always create a soft-dust-safe change output to `fromAddress` and fold leftover
   * DOGE into it. Ðune remainder now uses a dedicated 0.001 extra (pointer) — do
   * **not** force-change for ordinary sends or leftover tokens ride the large DOGE out.
   */
  forceChangeOutput?: boolean;
  /** Value on the Dunestone OP_RETURN (burn-to-etch). Default 0. */
  opReturnValue?: number;
}

function planDuneTx(params: BuildDuneTxParams) {
  const {
    fromAddress,
    opReturnScript,
    extraOutputs,
    utxos,
    feeRate,
    mustIncludeUtxos = [],
    forceChangeOutput = false,
    opReturnValue = 0,
  } = params;

  if (forceChangeOutput) {
    // Recipient + min change postage; leftover DOGE folds into the change output.
    const requiredOutputSats =
      extraOutputs.reduce((s, o) => s + o.value, 0) + SOFT_DUST_KOINU + opReturnValue;
    const estOutputCount = 1 + extraOutputs.length + 1; // OP_RETURN + extras + change
    const fixedOutputValues = [...extraOutputs.map((o) => o.value), SOFT_DUST_KOINU];
    const { selected, feeSatoshis, changeSatoshis } = selectCoins(
      utxos,
      requiredOutputSats,
      estOutputCount,
      opReturnScript.length,
      feeRate,
      fixedOutputValues,
      mustIncludeUtxos,
    );
    // changeSatoshis is DOGE above the reserved soft-dust change floor.
    const finalChange = SOFT_DUST_KOINU + changeSatoshis;
    const outputs: Array<{ value: number; script?: Uint8Array; address?: string }> = [
      { value: opReturnValue, script: opReturnScript },
      ...extraOutputs,
      { address: fromAddress, value: finalChange },
    ];
    return {
      selected,
      feeSatoshis,
      changeSatoshis: finalChange,
      outputs,
    };
  }

  const requiredOutputSats = extraOutputs.reduce((s, o) => s + o.value, 0) + opReturnValue;
  const estOutputCount = 1 + extraOutputs.length + 1;

  const { selected, feeSatoshis, changeSatoshis } = selectCoins(
    utxos,
    requiredOutputSats,
    estOutputCount,
    opReturnScript.length,
    feeRate,
    extraOutputs.map((o) => o.value),
    mustIncludeUtxos,
  );

  const outputs: Array<{ value: number; script?: Uint8Array; address?: string }> = [
    { value: opReturnValue, script: opReturnScript },
    ...extraOutputs,
  ];

  if (changeSatoshis >= SOFT_DUST_KOINU) {
    outputs.push({ address: fromAddress, value: changeSatoshis });
  }

  return { selected, feeSatoshis, changeSatoshis, outputs };
}

function builtTxMeta(
  fromAddress: string,
  selected: NormalisedUtxo[],
  feeSatoshis: number,
  changeSatoshis: number,
  extraOutputCount: number,
): Pick<BuiltTx, 'fromAddress' | 'spent' | 'change' | 'feeSatoshis' | 'changeSatoshis' | 'inputCount'> {
  const spent = selected.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n }));
  // outputs: [OP_RETURN, ...extras, ?change]
  const change =
    changeSatoshis >= SOFT_DUST_KOINU
      ? { vout: 1 + extraOutputCount, value: changeSatoshis }
      : null;
  return {
    fromAddress,
    spent,
    change,
    feeSatoshis,
    changeSatoshis,
    inputCount: selected.length,
  };
}

async function buildDunePsbt(params: BuildDuneTxParams): Promise<{
  psbtBase64: string;
  feeSatoshis: number;
  changeSatoshis: number;
  inputCount: number;
  fromAddress: string;
  spent: Array<{ txid: string; vout: number }>;
  change: { vout: number; value: number } | null;
}> {
  const { selected, feeSatoshis, changeSatoshis, outputs } = planDuneTx(params);
  const rawTxHexes = await Promise.all(selected.map((u) => getTxHex(u.tx_hash)));

  const bitcoin = await import('bitcoinjs-lib');
  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
  psbt.setVersion(1);

  for (let i = 0; i < selected.length; i++) {
    const u = selected[i];
    psbt.addInput({
      hash: u.tx_hash,
      index: u.tx_output_n,
      nonWitnessUtxo: Buffer.from(rawTxHexes[i], 'hex'),
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
    });
  }

  for (const o of outputs) {
    if (o.script) {
      psbt.addOutput({ script: Buffer.from(o.script), value: BigInt(o.value) } as any);
    } else if (o.address) {
      psbt.addOutput({ address: o.address, value: BigInt(o.value) } as any);
    }
  }

  return {
    psbtBase64: psbt.toBase64(),
    ...builtTxMeta(
      params.fromAddress,
      selected,
      feeSatoshis,
      changeSatoshis,
      params.extraOutputs.length,
    ),
  };
}

async function buildAndSign(params: SignTxParams): Promise<BuiltTx> {
  const {
    fromAddress,
    privateKeyWIF,
    opReturnScript,
    extraOutputs,
    utxos,
    feeRate,
    mustIncludeUtxos,
    forceChangeOutput,
    opReturnValue,
  } = params;
  const { selected, feeSatoshis, changeSatoshis, outputs } = planDuneTx({
    fromAddress,
    opReturnScript,
    extraOutputs,
    utxos,
    feeRate,
    mustIncludeUtxos,
    forceChangeOutput,
    opReturnValue,
  });

  const signer = DogeMemoryWallet.fromWIF(privateKeyWIF, 'doge');
  const txBuilder = createP2PKHTransaction(signer, {
    address: fromAddress,
    inputs: selected.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
    outputs: outputs as any,
  });

  const signedTx = await txBuilder.finalizeAndSign();
  return {
    rawHex: signedTx.toHex(),
    ...builtTxMeta(fromAddress, selected, feeSatoshis, changeSatoshis, extraOutputs.length),
  };
}

async function signDuneTransaction(
  signer: DuneTxSigner,
  opReturnScript: Uint8Array,
  extraOutputs: Array<{ address: string; value: number }>,
  feeRate: number,
  opts?: {
    utxos?: NormalisedUtxo[];
    mustIncludeUtxos?: NormalisedUtxo[];
    forceChangeOutput?: boolean;
    opReturnValue?: number;
  },
): Promise<BuiltTx> {
  assertDuneTxSigner(signer);
  const utxos = opts?.utxos ?? (await getSpendableUtxos(signer.fromAddress));
  const buildParams: BuildDuneTxParams = {
    fromAddress: signer.fromAddress,
    opReturnScript,
    extraOutputs,
    utxos,
    feeRate,
    mustIncludeUtxos: opts?.mustIncludeUtxos,
    forceChangeOutput: opts?.forceChangeOutput,
    opReturnValue: opts?.opReturnValue,
  };

  if (signer.privateKeyWIF) {
    return buildAndSign({
      fromAddress: signer.fromAddress,
      privateKeyWIF: signer.privateKeyWIF,
      opReturnScript,
      extraOutputs,
      utxos,
      feeRate,
      mustIncludeUtxos: opts?.mustIncludeUtxos,
      forceChangeOutput: opts?.forceChangeOutput,
      opReturnValue: opts?.opReturnValue,
    });
  }

  if (signer.signPsbt) {
    const built = await buildDunePsbt(buildParams);
    const signedPayload = await signer.signPsbt(built.psbtBase64);
    const rawHex = coerceSignedPsdtToRawTxHex(signedPayload);
    return {
      rawHex,
      feeSatoshis: built.feeSatoshis,
      changeSatoshis: built.changeSatoshis,
      inputCount: built.inputCount,
      fromAddress: built.fromAddress,
      spent: built.spent,
      change: built.change,
    };
  }

  throw new Error('No signing method available for this wallet');
}

// ── Fetch + filter UTXOs ──────────────────────────────────────────────────────

async function getSpendableUtxos(address: string): Promise<NormalisedUtxo[]> {
  const all = await fetchSpendableUtxosConservativeForAddress(address);
  if (!all.length) throw new Error('No confirmed UTXOs found. Your wallet needs DOGE to pay the transaction fee.');
  const { safe } = await filterPaymentSpendableUtxos(address, all);
  if (!safe.length) {
    throw new Error('No safe spendable UTXOs. All UTXOs appear inscription- or Ðune-bearing. Add plain DOGE to cover fees.');
  }
  // Same mempool overlay as plain sends — avoids bad-txns-inputs-spent after recent edicts / LP steps.
  const merged = mergePaymentUtxos(
    address,
    safe.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      value: u.value,
    })),
  );
  if (!merged.length) {
    throw new Error(
      'No spendable UTXOs after excluding coins already spent in this session (pending mempool). Wait a moment or confirm the prior tx, then retry.',
    );
  }
  return merged.map((u) => ({
    tx_hash: u.txid,
    tx_output_n: u.vout,
    value: u.value,
  }));
}

function normalizeDuneId(id: string): string {
  return id.trim().toLowerCase();
}

async function fetchOutpointDuneAmount(
  txid: string,
  vout: number,
  duneId: string,
): Promise<bigint | null> {
  const want = normalizeDuneId(duneId);
  const bases = [
    getIndexerApiBase().replace(/\/+$/, ''),
    DOGEX_PUBLIC_INDEXER_URL,
  ].filter((b, i, arr) => b && arr.indexOf(b) === i);

  for (const base of bases) {
    const url = `${base}/api/dunes/outpoint/${encodeURIComponent(txid)}/${vout}`;
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer =
        ctrl && typeof window !== 'undefined'
          ? window.setTimeout(() => ctrl.abort(), 12_000)
          : null;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: ctrl?.signal,
      });
      if (timer != null) window.clearTimeout(timer);
      if (!res.ok) continue;
      const data = (await res.json()) as { dunes?: Array<{ dune_id?: string; amount?: string }> };
      const rows = Array.isArray(data?.dunes) ? data.dunes : [];
      for (const row of rows) {
        if (normalizeDuneId(String(row?.dune_id ?? '')) === want) {
          return BigInt(String(row?.amount ?? '0'));
        }
      }
      return 0n;
    } catch {
      /* try next base */
    }
  }
  return null;
}

/**
 * Ðune edicts only move balances that exist on spent outpoints. Coin-select
 * fee UTXOs alone (largest first) often skips the postage UTXO that holds the
 * Ðune — producing a no-op / burn. Probe dogex per outpoint and force-include
 * carriers that cover `amountNeeded`.
 *
 * Filter with Core `gettxout` (command.dog `/rpc/gettxout`) + session spent
 * overlay. Do **not** trust empty `/address/.../utxo` from scantxoutset — that
 * path often returns [] while gettxout still shows live coins (LP / HD wallets
 * not imported into Core).
 */
async function getUtxosForDuneSend(
  address: string,
  duneId: string,
  amountNeeded: bigint,
): Promise<{ mustInclude: NormalisedUtxo[]; utxos: NormalisedUtxo[] }> {
  const all = await fetchSpendableUtxosConservativeForAddress(address);
  if (!all.length) {
    throw new Error('No confirmed UTXOs found. Your wallet needs DOGE to pay fees and postage.');
  }

  const localSpent = listLocallySpentOutpointKeys(address);
  const notSessionSpent = all.filter((u) => !localSpent.has(outpointKey(u)));
  const probed = await filterUtxosByRpcGetTxOutIfConfigured(
    notSessionSpent.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      tx_hash: u.tx_hash,
      tx_output_n: u.tx_output_n,
      value: u.value,
    })),
  );
  const live: NormalisedUtxo[] = probed.map((u) => ({
    tx_hash: u.tx_hash,
    tx_output_n: u.tx_output_n,
    value: u.value,
  }));
  if (!live.length) {
    throw new Error(
      'No live spendable UTXOs after Core gettxout (or pending in this session). ' +
        'MyDoge may still list spent coins from LP / prior sends — wait a few seconds and retry, ' +
        'or clear this site’s session storage if a failed send marked everything spent.',
    );
  }

  type Carrier = NormalisedUtxo & { duneAmount: bigint };
  const carriers: Carrier[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < live.length; i += CONCURRENCY) {
    const batch = live.slice(i, i + CONCURRENCY);
    const probed = await Promise.all(
      batch.map(async (u) => {
        const amt = await fetchOutpointDuneAmount(u.tx_hash, u.tx_output_n, duneId);
        if (amt == null || amt <= 0n) return null;
        return { ...u, duneAmount: amt };
      }),
    );
    for (const row of probed) {
      if (row) carriers.push(row);
    }
  }

  if (!carriers.length) {
    throw new Error(
      `No live UTXOs holding Ðune ${duneId} were found. ` +
        `If you just tried Ð𝕏Ð LP / another send, wait for confirmation (or for failed commits to clear), then refresh.`,
    );
  }

  carriers.sort((a, b) => (a.duneAmount === b.duneAmount ? 0 : a.duneAmount > b.duneAmount ? -1 : 1));
  const mustInclude: NormalisedUtxo[] = [];
  let covered = 0n;
  for (const c of carriers) {
    mustInclude.push({ tx_hash: c.tx_hash, tx_output_n: c.tx_output_n, value: c.value });
    covered += c.duneAmount;
    if (covered >= amountNeeded) break;
  }
  if (covered < amountNeeded) {
    throw new Error(
      `Insufficient Ðune on live UTXOs: need ${amountNeeded.toString()}, have ${covered.toString()} ` +
        `(after excluding spent / Core-missing coins).`,
    );
  }

  const mustKeys = new Set(mustInclude.map(outpointKey));
  // Fee/postage extras: never spend *other* Ðune carriers as plain DOGE.
  const { safe } = await filterPaymentSpendableUtxos(address, live);
  const payment = [
    ...mustInclude,
    ...safe.filter((u) => !mustKeys.has(outpointKey(u))),
  ];

  const merged = mergePaymentUtxos(
    address,
    payment.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      value: u.value,
    })),
  );
  const mergedKeys = new Set(merged.map((u) => `${u.txid}:${u.vout}`));
  for (const m of mustInclude) {
    if (!mergedKeys.has(outpointKey(m))) {
      throw new Error(
        `Ðune-bearing UTXO ${outpointKey(m)} looks spent in this session (pending mempool). ` +
          `Wait for confirmation, then retry.`,
      );
    }
  }

  const utxos = merged.map((u) => ({
    tx_hash: u.txid,
    tx_output_n: u.vout,
    value: u.value,
  }));

  console.info('[dojakweb:dunes] send UTXO selection', {
    carriers: carriers.length,
    mustInclude: mustInclude.length,
    covered: covered.toString(),
    paymentPool: utxos.length,
    afterGetTxOut: live.length,
    fromProvider: all.length,
  });

  return { mustInclude, utxos };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EtchDuneParams {
  /** Dune name with optional spacers, e.g. "DOGE•COIN". */
  name: string;
  /** Total supply in human-readable form, e.g. "1000000". */
  supply: string;
  /** Decimal places (0-38). */
  divisibility: number;
  /** Optional single-char symbol. */
  symbol?: string;
  /** Open-mint terms (omit to deploy without minting). */
  terms?: DuneTerms;
  /** Enable turbo flag. */
  turbo?: boolean;
  /** Fee rate in koinu/kB (default: inclusion floor 1_000_000 = 1000 koinu/byte). */
  feeRate?: number;
  /** Browser WIF and/or extension PSBT signer (see resolveDuneTxSigner). */
  signer: DuneTxSigner;
  /** Set to false to build + return hex without broadcasting. */
  broadcast?: boolean;
}

export interface EtchResult {
  txHex: string;
  txid?: string;
  feeSatoshis: number;
  changeSatoshis: number;
}

/**
 * Build, sign, and optionally broadcast an etch (deploy) transaction.
 *
 * `supply` is the **premine** amount (human-readable). Optional `terms` enable open mint.
 * Both may be set: premine to etcher + open mint for the pack.
 */
export async function etchDune(params: EtchDuneParams): Promise<EtchResult> {
  const {
    name, supply, divisibility, symbol, terms, turbo = false,
    feeRate = 1_000_000, signer, broadcast = true,
  } = params;

  // Validate name
  parseSpacedDune(name); // throws on invalid chars

  // Convert human-readable premine to smallest units (0 allowed when open-mint only)
  const premineBig = humanToSmallestUnits(supply || '0', divisibility);
  if (premineBig < 0n) throw new Error('Premine must be non-negative');
  if (premineBig === 0n && !terms) {
    throw new Error('Set a premine amount and/or open-mint terms — supply cannot be empty');
  }

  const opReturnScript = buildEtchScript(name, premineBig, divisibility, symbol, terms, turbo);
  if (opReturnScript.length > 83) {
    throw new Error(`Dunestone is ${opReturnScript.length} bytes — exceeds the 83-byte OP_RETURN limit. Shorten the name or reduce parameters.`);
  }

  const letterLen = name.replace(/[.•]/g, '').length;
  const burnKoinu = Number(uniqueEtchBurnKoinu(letterLen));

  // Postage dust for premine-bearing output (edict → output 1)
  const extraOutputs = premineBig > 0n
    ? [{ address: signer.fromAddress, value: POSTAGE_KOINU }]
    : [];

  const built = await signDuneTransaction(signer, opReturnScript, extraOutputs, feeRate, {
    opReturnValue: burnKoinu,
  });

  let txid: string | undefined;
  if (broadcast) {
    txid = await broadcastDuneTransaction(built.rawHex, {
      address: built.fromAddress,
      spent: built.spent,
      change: built.change,
    });
  }

  return { txHex: built.rawHex, txid, feeSatoshis: built.feeSatoshis, changeSatoshis: built.changeSatoshis };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MintDuneParams {
  /** Dune ID in "block:tx" format, e.g. "5000000:12". */
  duneId: string;
  /**
   * Address that will receive the minted tokens.
   * Defaults to fromAddress.
   */
  destination?: string;
  /** Postage (koinu) on the dune-bearing output. Default: 100_000 (0.001 Ð, inscription lock). */
  postage?: number;
  /** Fee rate in koinu/kB (default: inclusion floor 1_000_000). */
  feeRate?: number;
  signer: DuneTxSigner;
  broadcast?: boolean;
}

export interface MintResult {
  txHex: string;
  txid?: string;
  feeSatoshis: number;
}

/**
 * Build, sign, and optionally broadcast a mint transaction.
 *
 * The minted tokens go to `destination` (defaults to `fromAddress`).
 * The dune indexer credits the tokens to whichever address controls output 1.
 */
export async function mintDune(params: MintDuneParams): Promise<MintResult> {
  const {
    duneId, postage = POSTAGE_KOINU, feeRate = 1_000_000,
    signer, broadcast = true,
  } = params;
  const destination = params.destination?.trim() || signer.fromAddress;

  if (postage < HARD_DUST_KOINU) {
    assertHardDustKoinu('Postage', postage);
  }

  const opReturnScript = buildMintScript(duneId);

  const built = await signDuneTransaction(
    signer,
    opReturnScript,
    [{ address: destination, value: postage }],
    feeRate,
  );

  let txid: string | undefined;
  if (broadcast) {
    txid = await broadcastDuneTransaction(built.rawHex, {
      address: built.fromAddress,
      spent: built.spent,
      change: built.change,
    });
  }

  return { txHex: built.rawHex, txid, feeSatoshis: built.feeSatoshis };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SendDuneParams {
  /** Dune ID in "block:tx" format. */
  duneId: string;
  /** Human-readable amount, e.g. "100.5". */
  amount: string;
  /** Divisibility of the dune (needed to convert amount to smallest units). */
  divisibility: number;
  /** Recipient Dogecoin address. */
  recipientAddress: string;
  /** Postage on the recipient output (koinu). Default: 100_000 (0.001 Ð). Remainder parks on a second 0.001 Ð carrier to the sender. */
  postage?: number;
  /** Fee rate in koinu/kB (default: inclusion floor 1_000_000). */
  feeRate?: number;
  signer: DuneTxSigner;
  broadcast?: boolean;
  /** Optional display name for wallet activity (e.g. THE•WHITE•DOGE). */
  duneName?: string;
  spacedName?: string;
  /** Optional wallet-activity overlay (e.g. ÐLocker dune lock instead of a plain send). */
  activity?: {
    protocol?: DojakwebWalletTxProtocol;
    action?: string;
    title?: string;
    summary?: string;
  };
}

export interface SendResult {
  txHex: string;
  txid?: string;
  feeSatoshis: number;
}

/**
 * Build, sign, and optionally broadcast a send (transfer) transaction.
 *
 * Creates an edict that moves `amount` dune tokens to `recipientAddress`.
 * Layout: OP_RETURN (0) → recipient 0.001 (1) → remainder 0.001 (2, pointer) → DOGE change (3).
 * Pointer parks unallocated Ðunes on the remainder carrier (inscription sentinel).
 *
 * On `bad-txns-inputs-spent`, marks those inputs spent locally and retries once
 * (same pattern as plain DOGE sends) — common after DXD LP commits when MyDoge lags.
 */
export async function sendDune(params: SendDuneParams): Promise<SendResult> {
  const {
    duneId, amount, divisibility,
    recipientAddress, postage = POSTAGE_KOINU,
    feeRate = 1_000_000, signer, broadcast = true,
    duneName, spacedName, symbol, activity,
  } = params;

  const amountBig = humanToSmallestUnits(amount, divisibility);
  if (amountBig <= 0n) throw new Error('Send amount must be greater than zero');
  if (postage < HARD_DUST_KOINU) {
    assertHardDustKoinu('Postage', postage);
  }

  const recipientOutput = 1;
  const remainderPointer = 2;
  const opReturnScript = buildSendScript(duneId, amountBig, recipientOutput, remainderPointer);

  const attempt = async (): Promise<SendResult> => {
    const { mustInclude, utxos } = await getUtxosForDuneSend(
      signer.fromAddress,
      duneId,
      amountBig,
    );

    const built = await signDuneTransaction(
      signer,
      opReturnScript,
      [
        { address: recipientAddress, value: postage },
        { address: signer.fromAddress, value: POSTAGE_KOINU },
      ],
      feeRate,
      {
        utxos,
        mustIncludeUtxos: mustInclude,
        forceChangeOutput: false,
      },
    );

    if (!broadcast) {
      return { txHex: built.rawHex, feeSatoshis: built.feeSatoshis };
    }

    try {
      const txid = await broadcastDuneTransaction(built.rawHex, {
        address: built.fromAddress,
        spent: built.spent,
        change: built.change,
      });
      if (txid) {
        const displayName = (spacedName || duneName || duneId).trim();
        const postageDoge = postage / 1e8;
        upsertWalletTxJournalEntry({
          txid,
          address: signer.fromAddress,
          protocol: activity?.protocol || 'dunes',
          action: activity?.action || 'send',
          title: activity?.title || `Send ${displayName}`,
          summary:
            activity?.summary ||
            `${amount}${symbol ? ` ${symbol}` : ''} → ${recipientAddress.slice(0, 12)}… · postage ${postageDoge} Ð (${duneId})`,
          status: 'broadcasted',
          metadata: {
            duneId,
            amount,
            recipientAddress,
            duneName: duneName || displayName,
            spacedName: spacedName || displayName,
            symbol: symbol || undefined,
            postageDoge,
            amountDisplay: amount,
            actionLabel: activity?.action === 'lock' ? 'Lock' : undefined,
            // Do not set amountDoge — activity DOGE figure stays net postage+fee from chain history.
          },
        });
      }
      return { txHex: built.rawHex, txid, feeSatoshis: built.feeSatoshis };
    } catch (err) {
      if (isInputsSpentBroadcastError(err)) {
        markOutpointsSpent(built.fromAddress, built.spent);
      }
      throw err;
    }
  };

  try {
    return await attempt();
  } catch (err) {
    if (broadcast && isInputsSpentBroadcastError(err)) {
      try {
        return await attempt();
      } catch (err2) {
        throw new Error(friendlyPaymentSendError(err2));
      }
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ── Unit helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a human-readable decimal string to smallest token units.
 * e.g. "100.5" with divisibility 8 → 10_050_000_000n
 */
export function humanToSmallestUnits(amount: string, divisibility: number): bigint {
  const trimmed = amount.trim();
  if (!trimmed || trimmed === '.') throw new Error('Amount is required');

  const dotIndex = trimmed.indexOf('.');
  if (dotIndex === -1) {
    // No decimal point
    return BigInt(trimmed) * (10n ** BigInt(divisibility));
  }

  const intPart = trimmed.slice(0, dotIndex) || '0';
  const fracPart = trimmed.slice(dotIndex + 1).padEnd(divisibility, '0').slice(0, divisibility);

  const intBig  = BigInt(intPart)  * (10n ** BigInt(divisibility));
  const fracBig = fracPart ? BigInt(fracPart) : 0n;
  return intBig + fracBig;
}

/**
 * Convert smallest token units back to human-readable decimal string.
 */
export function smallestUnitsToHuman(amount: bigint, divisibility: number): string {
  if (divisibility === 0) return amount.toString();
  const factor = 10n ** BigInt(divisibility);
  const intPart  = amount / factor;
  const fracPart = amount % factor;
  const fracStr  = fracPart.toString().padStart(divisibility, '0').replace(/0+$/, '');
  return fracStr ? `${intPart}.${fracStr}` : intPart.toString();
}

export type DuneAirdropRecipient = {
  address: string;
  /** Smallest units. */
  amount: bigint;
};

export type DuneAirdropJobFee = {
  address: string;
  value: number;
};

export async function sendDuneAirdropBatch(params: {
  duneId: string;
  recipients: DuneAirdropRecipient[];
  signer: DuneTxSigner;
  postage?: number;
  feeRate?: number;
  jobFee?: DuneAirdropJobFee;
  /** Previous batch change — remaining Ðunes live here until confirmed. */
  chainedCarrier?: NormalisedUtxo;
}): Promise<SendResult & { change: BuiltTx['change']; spent: BuiltTx['spent'] }> {
  const {
    duneId,
    recipients,
    signer,
    postage = POSTAGE_KOINU,
    feeRate = 1_000_000,
    jobFee,
    chainedCarrier,
  } = params;
  if (!recipients.length) throw new Error('Ðune airdrop batch is empty');
  if (postage < HARD_DUST_KOINU) {
    assertHardDustKoinu('Postage', postage);
  }

  const amountBig = recipients.reduce((sum, r) => sum + r.amount, 0n);
  if (amountBig <= 0n) throw new Error('Send amount must be greater than zero');

  const extraOutputs: Array<{ address: string; value: number }> = recipients.map((r) => ({
    address: r.address,
    value: postage,
  }));
  if (jobFee && jobFee.value > 0) {
    extraOutputs.push({ address: jobFee.address, value: jobFee.value });
  }
  extraOutputs.push({ address: signer.fromAddress, value: POSTAGE_KOINU });
  const pointer = extraOutputs.length;
  const opReturnScript = buildAirdropSendScript(
    duneId,
    recipients.map((r, idx) => ({ amount: r.amount, output: idx + 1 })),
    pointer,
  );

  const { mustInclude, utxos } = chainedCarrier
    ? await getUtxosForDuneSendChained(signer.fromAddress, chainedCarrier)
    : await getUtxosForDuneSend(signer.fromAddress, duneId, amountBig);

  const built = await signDuneTransaction(signer, opReturnScript, extraOutputs, feeRate, {
    utxos,
    mustIncludeUtxos: mustInclude,
    forceChangeOutput: false,
  });

  const txid = await broadcastDuneTransaction(built.rawHex, {
    address: built.fromAddress,
    spent: built.spent,
    change: built.change,
  });
  return { txHex: built.rawHex, txid, feeSatoshis: built.feeSatoshis, change: built.change, spent: built.spent };
}

async function getUtxosForDuneSendChained(
  address: string,
  carrier: NormalisedUtxo,
): Promise<{ mustInclude: NormalisedUtxo[]; utxos: NormalisedUtxo[] }> {
  const all = await fetchSpendableUtxosConservativeForAddress(address);
  const { safe } = await filterPaymentSpendableUtxos(address, all.length ? all : [carrier]);
  const payment = [
    carrier,
    ...safe.filter((u) => u.tx_hash !== carrier.tx_hash || u.tx_output_n !== carrier.tx_output_n),
  ];
  const merged = mergePaymentUtxos(
    address,
    payment.map((u) => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
  );
  const carrierKey = `${carrier.tx_hash.toLowerCase()}:${carrier.tx_output_n}`;
  const hasCarrier = merged.some((u) => `${u.txid}:${u.vout}` === carrierKey);
  if (!hasCarrier) {
    throw new Error(
      `Chained Ðune change ${carrierKey} is missing from the session overlay. Wait a block and retry the remaining drop.`,
    );
  }
  const utxos: NormalisedUtxo[] = merged.map((u) => ({
    tx_hash: u.txid,
    tx_output_n: u.vout,
    value: u.value,
  }));
  return { mustInclude: [carrier], utxos };
}

export async function sendDuneAirdrop(params: {
  duneId: string;
  recipients: DuneAirdropRecipient[];
  signer: DuneTxSigner;
  postage?: number;
  feeRate?: number;
  jobFee?: DuneAirdropJobFee;
  onBatch?: (info: {
    batchIndex: number;
    batchCount: number;
    txid: string;
    recipientCount: number;
  }) => void | Promise<void>;
}): Promise<{ txids: string[]; feeSatoshis: number }> {
  const batches = packDuneAirdropBatches(params.duneId, params.recipients);
  const txids: string[] = [];
  let feeSatoshis = 0;
  let chainedCarrier: NormalisedUtxo | undefined;
  for (let i = 0; i < batches.length; i++) {
    const result = await sendDuneAirdropBatch({
      duneId: params.duneId,
      recipients: batches[i]!,
      signer: params.signer,
      postage: params.postage,
      feeRate: params.feeRate,
      jobFee: i === 0 ? params.jobFee : undefined,
      chainedCarrier,
    });
    if (!result.txid) throw new Error('Ðune airdrop batch broadcast returned no txid');
    txids.push(result.txid);
    feeSatoshis += result.feeSatoshis;
    chainedCarrier =
      result.change != null
        ? { tx_hash: result.txid, tx_output_n: result.change.vout, value: result.change.value }
        : undefined;
    await params.onBatch?.({
      batchIndex: i,
      batchCount: batches.length,
      txid: result.txid,
      recipientCount: batches[i]!.length,
    });
  }
  return { txids, feeSatoshis };
}
