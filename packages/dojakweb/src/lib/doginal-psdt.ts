/**
 * Ordinal PSDT — Dogecoin inscription marketplace trade logic
 * Ported from OpenOrdex-style flows for the wzrd.dog / dojakweb stack.
 *
 * Atomic swap (Nostr / QR listing):
 *   Seller: buildListingPSBT → signListingPSDT (SIGHASH_SINGLE|ANYONECANPAY) → publish PSDT
 *   Buyer:  validateSellerPSBT → buildBuyPSDTSimple / buildBuyPSDT → wallet signs buyer inputs
 *           → raw tx hex → broadcastTx
 *
 * Wallets: in-browser Dojakweb (`signPsdtWithWifToTxHex` / UnifiedWallet.signPSBT) signs
 * buyer-owned inputs only (skips the seller inscription, which is not always vin 0).
 * may return either raw tx hex or an encoded PSBT; use `coerceSignedPsdtToRawTxHex` before broadcast.
 *
 * Seller flow  : buildListingPSDT → signListingPSDT → publishToNostr (or show QR)
 * Buyer flow   : (optionally) buildDummyUtxoPSDT → buildBuyPSDT → sign → broadcastTx
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as secp from '@noble/secp256k1';
import { decodePrivateKeyFromWIF } from 'doge-sdk';
import { browserRpcProxyAbsoluteUrl, rpcViaProxy } from './rpc-proxy-client';
import { broadcastUtxoTx } from './utxo-tools';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
  waitForBroadcastPropagationVerified,
} from './broadcast/dogecoinTxBroadcast';
import { mergePaymentUtxos } from './mempoolSpendOverlay';
import { dogeTxExplorerUrl } from '../utils/dogeTxExplorer';
import { loadWalletTxJournal, upsertWalletTxJournalEntry } from './wallet-tx-journal';
import { SOFT_DUST_KOINU, softDustFeePenaltyKoinu } from './dogecoin/softDust';

// ── Dogecoin network params for bitcoinjs-lib ────────────────────────────────
export const DOGE_NETWORK: bitcoin.Network = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

/**
 * bitcoinjs-lib defaults `maximumFeeRate` to 5000 sat/vB (Bitcoin). Dogecoin
 * inclusion is 1_000–50_000 koinu/byte, so extractTransaction() throws a
 * misleading "missing signatures" / setMaximumFeeRate warning on valid dummy splits.
 */
export const DOGE_PSBT_MAX_FEE_RATE = 1_000_000;

export const DOGE_PSBT_OPTS: { network: bitcoin.Network; maximumFeeRate: number } = {
  network: DOGE_NETWORK,
  maximumFeeRate: DOGE_PSBT_MAX_FEE_RATE,
};

function isBitcoinjsFeeRateError(msg: string): boolean {
  return /setMaximumFeeRate|satoshi per byte|pass true to the first arg of extractTransaction/i.test(
    msg,
  );
}

function redeemHasCltv(redeem: Buffer | Uint8Array | undefined): boolean {
  if (!redeem || !redeem.length) return false;
  const chunks = bitcoin.script.decompile(Buffer.from(redeem));
  return Boolean(chunks?.includes(bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY));
}

/** bitcoinjs cannot classify `<locktime> OP_CLTV OP_DROP` + P2PKH as p2pkh. */
function tryFinalizeCltvP2shInput(psbt: bitcoin.Psbt, index: number): boolean {
  const input = psbt.data.inputs[index];
  if (!input) return false;
  if (input.finalScriptSig) return true;
  if (!redeemHasCltv(input.redeemScript) || !input.partialSig?.length) return false;
  try {
    psbt.finalizeInput(index, (_i, inp) => {
      const ps = inp.partialSig![0];
      const payment = bitcoin.payments.p2sh({
        redeem: {
          output: Buffer.from(inp.redeemScript!),
          input: bitcoin.script.compile([Buffer.from(ps.signature), Buffer.from(ps.pubkey)]),
        },
        network: DOGE_NETWORK,
      });
      if (!payment.input) throw new Error('CLTV P2SH finalize produced empty scriptSig');
      return { finalScriptSig: payment.input };
    });
    return true;
  } catch (e) {
    console.warn('[doginal-psdt] CLTV P2SH finalize failed', e);
    return false;
  }
}

/** Finalize inputs and extract raw tx hex, ignoring Bitcoin-oriented fee caps. */
export function extractDogePsbtTxHex(psbt: bitcoin.Psbt): string {
  for (let i = 0; i < psbt.inputCount; i++) {
    if (tryFinalizeCltvP2shInput(psbt, i)) continue;
    try {
      psbt.finalizeInput(i);
    } catch {
      /* already finalized or incomplete */
    }
  }
  try {
    return psbt.extractTransaction().toHex();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isBitcoinjsFeeRateError(msg)) {
      return psbt.extractTransaction(true).toHex();
    }
    throw e;
  }
}

function tryPsbtFromBase64Variants(trimmed: string): bitcoin.Psbt | null {
  const candidates = [trimmed, trimmed.replace(/-/g, '+').replace(/_/g, '/')];
  for (const c of candidates) {
    try {
      return bitcoin.Psbt.fromBase64(c, DOGE_PSBT_OPTS);
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Parse PSDT from hex (with magic) or base64. Returns null if input is not a PSDT (e.g. raw tx hex). */
export function tryParsePsdt(psbtInput: string): bitcoin.Psbt | null {
  const trimmed = psbtInput.trim();
  try {
    if (
      /^[0-9a-fA-F]+$/i.test(trimmed) &&
      trimmed.length >= 10 &&
      trimmed.toLowerCase().startsWith('70736274')
    ) {
      return bitcoin.Psbt.fromBuffer(Buffer.from(trimmed, 'hex'), DOGE_PSBT_OPTS);
    }
    if (!/^[0-9a-fA-F]+$/i.test(trimmed)) {
      return tryPsbtFromBase64Variants(trimmed);
    }
    // All-hex but no PSBT magic: raw tx hex, or rare base64 that only uses 0-9a-f
    const asB64 = tryPsbtFromBase64Variants(trimmed);
    if (asB64) return asB64;
    return null;
  } catch {
    return null;
  }
}

const SIGHASH_ANYONECANPAY = bitcoin.Transaction.SIGHASH_ANYONECANPAY;

function prevOutScriptForInput(psbt: bitcoin.Psbt, index: number): Buffer | null {
  const data = psbt.data.inputs[index];
  if (data?.witnessUtxo?.script) return Buffer.from(data.witnessUtxo.script);
  if (data?.nonWitnessUtxo) {
    try {
      const prev = bitcoin.Transaction.fromBuffer(Buffer.from(data.nonWitnessUtxo));
      const vout = psbt.txInputs[index]?.index;
      if (typeof vout !== 'number' || !prev.outs[vout]) return null;
      return Buffer.from(prev.outs[vout].script);
    } catch {
      return null;
    }
  }
  return null;
}

function pubkeyHashInRedeem(redeem: Buffer, publicKey: Buffer): boolean {
  try {
    const pkh = Buffer.from(bitcoin.crypto.hash160(publicKey));
    const chunks = bitcoin.script.decompile(redeem);
    if (!chunks) return false;
    return chunks.some((c) => Buffer.isBuffer(c) && c.equals(pkh));
  } catch {
    return false;
  }
}

function inputScriptMatchesPubkey(
  script: Buffer,
  publicKey: Buffer,
  redeemScript?: Buffer | Uint8Array,
): boolean {
  try {
    const out = bitcoin.payments.p2pkh({ pubkey: publicKey, network: DOGE_NETWORK }).output;
    if (out && Buffer.from(out).equals(script)) return true;
  } catch {
    /* not p2pkh compressed */
  }
  if (!redeemScript?.length) return false;
  try {
    const redeem = Buffer.from(redeemScript);
    const p2sh = bitcoin.payments.p2sh({
      redeem: { output: redeem, network: DOGE_NETWORK },
      network: DOGE_NETWORK,
    }).output;
    if (!p2sh || !Buffer.from(p2sh).equals(script)) return false;
    return pubkeyHashInRedeem(redeem, publicKey);
  } catch {
    return false;
  }
}

/**
 * Seller listing input: ANYONECANPAY (often SIGHASH_SINGLE|ACP) at any vin.
 * doggy.market buy PSDTs do **not** always put the inscription at index 0
 * (dummy pair can sit first; seller payment is then a later output).
 */
function isSellerListingInput(psbt: bitcoin.Psbt, index: number): boolean {
  if (psbt.inputCount < 2) return false;
  const inp = psbt.data.inputs[index];
  if (!inp) return false;
  const sh = inp.sighashType;
  if (typeof sh === 'number' && (sh & SIGHASH_ANYONECANPAY) !== 0) return true;
  if (index === 0 && inp.partialSig?.length) return true;
  return false;
}

/** Input indexes that still need the buyer's signature (no pubkey — skip ACP / existing sigs). */
export function getUnsignedPsdtInputIndexes(psbt: bitcoin.Psbt): number[] {
  const indexes: number[] = [];
  for (let i = 0; i < psbt.inputCount; i++) {
    if (isSellerListingInput(psbt, i)) continue;
    const partial = psbt.data.inputs[i]?.partialSig;
    if (!partial?.length) indexes.push(i);
  }
  return indexes;
}

/**
 * Sighash to pass to MyDoge `requestPsdt` when `partial: true`.
 * MyDoge forwards this as bitcoinjs `signInput(..., [sighashType])`; that list must include each
 * input's PSBT `sighashType` or signing throws (listing PSBTs use SIGHASH_SINGLE|ANYONECANPAY on input 0).
 */
export function sighashTypeForMyDogePsdtSign(
  psbt: bitcoin.Psbt,
  signIndexes: number[],
): number {
  const fallback = bitcoin.Transaction.SIGHASH_ALL;
  if (!signIndexes.length) return fallback;
  return psbt.data.inputs[signIndexes[0]]?.sighashType ?? fallback;
}

/**
 * Indexes the local WIF key can actually sign. Skip seller listing (ACP / vin0 sig)
 * and any prevout that is not this wallet's P2PKH — doggy.market often places the
 * inscription input after dummy coins, so "skip index 0" is not enough.
 */
function getLocalWifSignerInputIndexes(psbt: bitcoin.Psbt, publicKey: Buffer): number[] {
  const pub = Buffer.from(publicKey);
  const indexes: number[] = [];
  for (let i = 0; i < psbt.inputCount; i++) {
    if (isSellerListingInput(psbt, i)) continue;
    // Already-finalized co-signer / treasury inputs — do not touch.
    if (psbt.data.inputs[i]?.finalScriptSig?.length) continue;
    if (psbt.data.inputs[i]?.partialSig?.length) continue;
    const script = prevOutScriptForInput(psbt, i);
    const redeem = psbt.data.inputs[i]?.redeemScript;
    if (!script || !inputScriptMatchesPubkey(script, pub, redeem)) continue;
    indexes.push(i);
  }
  return indexes;
}

function unsignedTxFromPsbt(psbt: bitcoin.Psbt): bitcoin.Transaction | null {
  const cache = (psbt as unknown as { __CACHE?: { __TX?: bitcoin.Transaction } }).__CACHE;
  return cache?.__TX ?? null;
}

/** bitcoinjs may refuse CLTV-prefixed redeem scripts even when HASH160 matches. */
async function trySignCltvP2shInput(
  psbt: bitcoin.Psbt,
  index: number,
  signer: bitcoin.SignerAsync,
): Promise<boolean> {
  const redeem = psbt.data.inputs[index]?.redeemScript;
  if (!redeemHasCltv(redeem) || !pubkeyHashInRedeem(Buffer.from(redeem!), Buffer.from(signer.publicKey))) {
    return false;
  }
  const tx = unsignedTxFromPsbt(psbt);
  if (!tx) return false;
  const sh = psbt.data.inputs[index]?.sighashType ?? bitcoin.Transaction.SIGHASH_ALL;
  try {
    const hash = Buffer.from(tx.hashForSignature(index, Buffer.from(redeem!), sh));
    const compact = await signer.sign(hash);
    const signature = bitcoin.script.signature.encode(Buffer.from(compact), sh);
    psbt.updateInput(index, {
      partialSig: [{ pubkey: Buffer.from(signer.publicKey), signature }],
    });
    return true;
  } catch (e) {
    console.warn(`[doginal-psdt] CLTV P2SH sign failed for input ${index}`, e);
    return false;
  }
}

function isUnownedInputSignError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /can not sign for this input with the key/i.test(msg);
}

async function signPsbtInputsWithWif(
  psbt: bitcoin.Psbt,
  signer: bitcoin.SignerAsync,
  explicitIndexes?: number[],
): Promise<number[]> {
  const pub = Buffer.from(signer.publicKey);
  const owned = getLocalWifSignerInputIndexes(psbt, pub);
  const indexes = explicitIndexes?.length
    ? [...new Set(explicitIndexes)].filter((i) => owned.includes(i))
    : owned;
  const signed: number[] = [];
  for (const i of indexes) {
    try {
      const sh = psbt.data.inputs[i]?.sighashType;
      if (typeof sh === 'number') {
        await psbt.signInputAsync(i, signer, [sh]);
      } else {
        await psbt.signInputAsync(i, signer);
      }
      signed.push(i);
    } catch (err) {
      if (await trySignCltvP2shInput(psbt, i, signer)) {
        signed.push(i);
        continue;
      }
      if (isUnownedInputSignError(err)) {
        console.warn(`[doginal-psdt] skip input ${i}: not this wallet's key`);
        continue;
      }
      throw err;
    }
  }
  if (!signed.length) {
    const cltv = [...Array(psbt.inputCount).keys()].some((i) =>
      redeemHasCltv(psbt.data.inputs[i]?.redeemScript),
    );
    throw new Error(
      cltv
        ? 'This wallet could not sign the ÐLocker time-lock. Reconnect the same address that created the lock and try Unlock again.'
        : 'This wallet could not sign any input on the PSDT (seller inscription / other-party inputs only). Reconnect the buyer address used for dummy coins and try again.',
    );
  }
  return signed;
}

/**
 * Parse PSDT for local (browser / WIF) signing. Rejects non-PSBT hex payloads.
 */
export function parsePsdtForLocalSign(psbtInput: string): bitcoin.Psbt {
  const parsed = tryParsePsdt(psbtInput);
  if (!parsed) {
    throw new Error(
      'Invalid PSDT: pass base64 PSDT or hex PSDT (magic 70736274). Raw transaction hex is not supported for browser signing.',
    );
  }
  return parsed;
}

/**
 * Normalize `signPSDT` output for broadcasting: pass through raw transaction hex, or if the wallet
 * returned a PSDT (base64 or hex with PSDT magic), finalize and extract the raw tx hex.
 */
export function coerceSignedPsdtToRawTxHex(walletOutput: string): string {
  const trimmed = walletOutput.trim();
  const psbt = tryParsePsdt(trimmed);
  if (!psbt) {
    try {
      bitcoin.Transaction.fromHex(trimmed);
      return trimmed;
    } catch {
      throw new Error('Wallet returned neither a valid PSDT nor parseable raw transaction hex.');
    }
  }
  try {
    return extractDogePsbtTxHex(psbt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not finalize the signed PSDT into a raw transaction (missing signatures or incompatible inputs). ${msg}`,
    );
  }
}

/**
 * Normalize caller input (hex or base64) to raw PSBT hex and pick input indexes
 * the wallet should sign. Skips inputs that already have partial signatures (e.g.
 * seller inscription input in a Nostr / OpenOrdex buy PSBT). MyDoge expects hex, not base64.
 */
export function preparePsdtForMyDogeSign(psbtInput: string): {
  psbtHex: string;
  indexes: number[];
  sighashType: number;
} {
  const trimmed = psbtInput.trim();
  const psbt = tryParsePsdt(trimmed);
  if (psbt) {
    const indexes = getUnsignedPsdtInputIndexes(psbt);
    const sighashType = sighashTypeForMyDogePsdtSign(psbt, indexes);
    // In browsers, psbt.toBuffer() may be a Uint8Array; normalize to Buffer before hex encoding.
    return { psbtHex: Buffer.from(psbt.toBuffer()).toString('hex'), indexes, sighashType };
  }
  if (/^[0-9a-fA-F]+$/i.test(trimmed)) {
    return {
      psbtHex: trimmed.toLowerCase(),
      indexes: [0, 1],
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
    };
  }
  throw new Error('Invalid PSDT: expected base64 or hex-encoded PSDT.');
}

/**
 * Normalize a PSBT input for extensions that can sign PSBT base64 directly.
 * Returns canonical base64 plus the input indexes that still need signatures.
 */
export function preparePsdtForExtensionSign(psbtInput: string): { psbtBase64: string; indexes: number[] } {
  const trimmed = psbtInput.trim();
  const psbt = tryParsePsdt(trimmed);
  if (psbt) {
    return {
      psbtBase64: psbt.toBase64(),
      indexes: getUnsignedPsdtInputIndexes(psbt),
    };
  }
  throw new Error('Invalid PSDT: expected base64 or hex-encoded PSDT.');
}

/**
 * Normalize any wallet-returned PSBT payload into canonical PSBT base64.
 * Throws if the wallet returned a raw transaction instead of a PSBT.
 */
export function normalizeSignedPsdtToBase64(walletOutput: string): string {
  const trimmed = walletOutput.trim();
  const psbt = tryParsePsdt(trimmed);
  if (!psbt) {
    throw new Error('Wallet returned a raw transaction instead of a signed PSDT.');
  }
  return psbt.toBase64();
}

function paymentScriptFromAddress(addr: string): Buffer | undefined {
  if (!addr?.trim()) return undefined;
  const a = addr.trim();
  try {
    const p2pkh = bitcoin.payments.p2pkh({ address: a, network: DOGE_NETWORK });
    if (p2pkh.output?.length) return Buffer.from(p2pkh.output);
  } catch { /* */ }
  try {
    const p2sh = bitcoin.payments.p2sh({ address: a, network: DOGE_NETWORK });
    if (p2sh.output?.length) return Buffer.from(p2sh.output);
  } catch { /* */ }
  try {
    const p2wpkh = bitcoin.payments.p2wpkh({ address: a, network: DOGE_NETWORK });
    if (p2wpkh.output?.length) return Buffer.from(p2wpkh.output);
  } catch { /* */ }
  return undefined;
}

function resolveListingPaymentScript(out: bitcoin.PsbtTxOutput | undefined): Buffer | undefined {
  if (!out) return undefined;
  if (out.script && out.script.length > 0) return Buffer.from(out.script);
  if (out.address) return paymentScriptFromAddress(out.address);
  return undefined;
}

/**
 * Ensure a previous tx buffer actually contains `vout` with a script.
 * bitcoinjs-lib would otherwise throw `Cannot read properties of undefined (reading 'script')` during sign/finalize.
 */
function assertPrevoutExists(txBuf: Buffer, vout: number, ctx: string): void {
  let tx: bitcoin.Transaction;
  try {
    tx = bitcoin.Transaction.fromBuffer(txBuf);
  } catch {
    throw new Error(`${ctx}: invalid previous transaction bytes.`);
  }
  const o = tx.outs[vout];
  if (!o?.script?.length) {
    throw new Error(
      `${ctx}: no output #${vout} in previous transaction (bad embedded tx or vout).`,
    );
  }
}

/**
 * BIP174 witnessUtxo built from the full previous transaction.
 * MyDoge and some PSBT paths read `witnessUtxo.script` / `.value` directly; `nonWitnessUtxo` alone
 * can produce "Cannot read properties of undefined (reading 'script')" inside those stacks.
 */
function witnessUtxoFromPrevTx(txBuf: Buffer, vout: number, ctx: string): { script: Buffer; value: bigint } {
  const tx = bitcoin.Transaction.fromBuffer(txBuf);
  const o = tx.outs[vout];
  if (!o?.script?.length) {
    throw new Error(`${ctx}: cannot build witnessUtxo — missing output #${vout}.`);
  }
  const v = o.value;
  const value = typeof v === 'bigint' ? v : BigInt(Math.floor(Number(v)));
  return { script: Buffer.from(o.script), value };
}

// ── Constants ────────────────────────────────────────────────────────────────
/**
 * Fallback only when fee API is unreachable. Prefer `resolveBuyFeeRateKoinuPerByte`
 * / `enforceBroadcastFeeRateKoinuPerByte` — static 1000 koinu/B stuck ÐLaunch etches.
 */
export const DEFAULT_FEE_RATE   = 1_000;       // koinu / byte fallback (NOT a safe broadcast rate)
export const DUMMY_UTXO_VALUE   = 100_000;     // 0.001 DOGE — "dummy" sentinel

/** Extra vbytes in buy/dummy fee math (output count varints, signature length slack). */
const BUY_FEE_SIZE_PADDING_BYTES = 32;

/**
 * Fee rate for marketplace buy / dummy-setup txs (koinu per byte).
 * Uses Command.dog inclusion policy (≥10× relay) with the same estimatesmartfee path as inscribe.
 */
export async function resolveBuyFeeRateKoinuPerByte(targetBlocks = 6): Promise<number> {
  const { resolveInclusionFeeRateKoinuPerByte } = await import('./fees/dogecoinFeePolicy');
  return resolveInclusionFeeRateKoinuPerByte(targetBlocks);
}
export const BLOCKCHAIR_URL     = 'https://api.blockchair.com/dogecoin';
export const NOSTR_RELAY_URL    = 'wss://relay.damus.io';
export const NOSTR_BACKUP_RELAYS = ['wss://nos.lol', 'wss://relay.nostr.band'];
export const NOSTR_ORDER_KIND   = 802;
export const EXCHANGE_NAME      = 'dogenals.org';
export const DOGE_NETWORK_NAME  = 'dogecoin-mainnet';

// ── Utilities ────────────────────────────────────────────────────────────────
export const shibesToDoge = (s: number) => Number(s) / 1e8;
export const dogeToShibes = (d: number) => Math.floor(Number(d) * 1e8);

/** P2PKH tx‑size estimate: 10 base + 148·vins + 34·vouts + optional 34 change */
export function calculateFee(
  vins: number,
  vouts: number,
  feeRate = DEFAULT_FEE_RATE,
  includeChange = true,
  sizePaddingBytes = 0,
): number {
  const bytes =
    10 + vins * 148 + vouts * 34 + (includeChange ? 34 : 0) + sizePaddingBytes;
  return Math.ceil(bytes * feeRate);
}

// ── Tx‑hex cache (per page lifetime) ─────────────────────────────────────────
const txHexCache: Record<string, string> = {};
// In-flight deduplication: concurrent fetches for the same txid reuse one request.
const txHexInflight: Partial<Record<string, Promise<string>>> = {};

function loadTatumApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('dojakweb-broadcast-config');
    if (!raw) return '';
    return (JSON.parse(raw) as { tatumApiKey?: string }).tatumApiKey?.trim() ?? '';
  } catch {
    return '';
  }
}

async function fetchTxHexFromTatum(txid: string): Promise<string | null> {
  const apiKey = loadTatumApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.tatum.io/v3/dogecoin/tx/${txid}`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hex = (data?.hex ?? data?.raw ?? data?.txHex) as string | undefined;
    return typeof hex === 'string' && hex.length > 0 ? hex : null;
  } catch {
    return null;
  }
}

async function fetchTxHexFromBlockchair(txid: string): Promise<string | null> {
  try {
    const res = await fetch(`${BLOCKCHAIR_URL}/raw/transaction/${txid}`);
    if (!res.ok) return null;
    const data = await res.json();
    const hex = data?.data?.[txid]?.raw_transaction as string | undefined;
    return typeof hex === 'string' && hex.length > 0 ? hex : null;
  } catch {
    return null;
  }
}

export async function getTxHex(txid: string): Promise<string> {
  if (txHexCache[txid]) return txHexCache[txid];
  const inflightExisting = txHexInflight[txid];
  if (inflightExisting) return inflightExisting;

  const inflight = (async () => {
    const hex = (await fetchTxHexFromTatum(txid)) ?? (await fetchTxHexFromBlockchair(txid));
    if (!hex) throw new Error(`Tx ${txid} not found (tried Tatum and Blockchair — add a Tatum API key in Settings if missing)`);
    txHexCache[txid] = hex;
    delete txHexInflight[txid];
    return hex;
  })();

  txHexInflight[txid] = inflight;
  return inflight;
}

/** Prevout value in shibes from the actual raw tx (authoritative for signing — Blockchair list `value` can disagree). */
export async function getPrevoutValueShibes(txid: string, vout: number): Promise<number> {
  const hex = await getTxHex(txid);
  return prevoutValueShibesFromTxBuf(Buffer.from(hex, 'hex'), vout, `Tx ${txid}:${vout}`);
}

function prevoutValueShibesFromTxBuf(txBuf: Buffer, vout: number, ctx: string): number {
  const tx = bitcoin.Transaction.fromBuffer(txBuf);
  const o = tx.outs[vout];
  if (!o?.script?.length) {
    throw new Error(`${ctx}: missing output #${vout}`);
  }
  const v = o.value;
  return typeof v === 'bigint' ? Number(v) : Math.floor(Number(v));
}

// ── On‑chain data ─────────────────────────────────────────────────────────────

export interface InscriptionData {
  id: string;
  number: number;
  address: string;
  output: string;      // "txid:vout"
  outputValue: number; // shibes
  scriptPubKey: string;
  contentType: string;
}

export interface InscriptionHint {
  address?: string;
  output?: string;
  outputValue?: string | number;
  contentType?: string;
  inscriptionNumber?: number;
}

/**
 * Resolve inscription data needed to build a PSBT.
 *
 * Pass `hint` when you already have the inscription from a wallet list
 * (e.g. MyDogeInscription) — avoids a redundant API call and works around
 * the fact that single-inscription lookup endpoints often omit UTXO location.
 */
export async function getInscriptionData(
  inscriptionId: string,
  hint?: InscriptionHint,
): Promise<InscriptionData> {
  // If the caller already has the UTXO location, skip the API call entirely
  if (hint?.output) {
    const address = hint.address ?? '';
    let scriptPubKey = '';
    if (address) {
      try {
        const { output } = bitcoin.payments.p2pkh({ address, network: DOGE_NETWORK });
        if (output) scriptPubKey = Buffer.from(output).toString('hex');
      } catch { /* ignore */ }
    }
    return {
      id:          inscriptionId,
      number:      hint.inscriptionNumber ?? 0,
      address,
      output:      hint.output,
      outputValue: Number(hint.outputValue ?? 0),
      scriptPubKey,
      contentType: hint.contentType ?? '',
    };
  }

  // Fallback: fetch from address inscriptions list using owner address hint
  // The single-inscription endpoint only returns content metadata, not UTXO location.
  throw new Error(
    `Cannot resolve UTXO location for inscription ${inscriptionId} without a hint. ` +
    `Pass the inscription object as the second argument to getInscriptionData().`,
  );
}

export interface OrdUtxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
}

// ── RPC config (mirrors utxo-tools.ts — loaded from localStorage) ─────────────

const BROADCAST_CONFIG_KEY = 'dojakweb-broadcast-config';

function loadRpcConfig(): { rpcUrl: string; rpcUser: string; rpcPass: string } {
  const defaults = { rpcUrl: 'http://127.0.0.1:22555', rpcUser: '', rpcPass: '' };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(BROADCAST_CONFIG_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

async function fetchUtxosViaRpc(address: string): Promise<OrdUtxo[] | null> {
  const { rpcUrl, rpcUser, rpcPass } = loadRpcConfig();
  if (!rpcUser || !rpcPass || !rpcUrl) return null;
  const mapRows = (rows: unknown): OrdUtxo[] | null => {
    if (!Array.isArray(rows)) return null;
    return rows.map((u: any) => ({
      txid: String(u.txid),
      vout: Number(u.vout),
      value: Math.round(Number(u.amount) * 1e8),
      scriptPubKey: String(u.scriptPubKey ?? ''),
    }));
  };
  try {
    // Browser: same-origin proxy avoids CORS on direct POST to 127.0.0.1:22555
    if (browserRpcProxyAbsoluteUrl()) {
      const result = await rpcViaProxy<unknown[]>('listunspent', [0, 9999999, [address]], {
        rpcUrl,
        rpcUser,
        rpcPass,
      });
      if (result === null) return null;
      return mapRows(result);
    }
    const auth = btoa(`${rpcUser}:${rpcPass}`);
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'doginal-psdt', method: 'listunspent', params: [0, 9999999, [address]] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !Array.isArray(data.result)) return null;
    return mapRows(data.result);
  } catch {
    return null;
  }
}

/**
 * Fetches spendable UTXOs for address.
 *
 * Order (browser wallets):
 * 1. Dogecoin Core RPC when it actually returns coins for this address
 * 2. dojakweb wallet data provider (MyDoge by default) + local mempool overlay
 *
 * Locked UTXOs (inscription-bearing) are excluded via the dojakweb lock registry.
 */
export async function getAddressUtxos(address: string): Promise<OrdUtxo[]> {
  // Load locked-UTXO registry (inscription UTXOs are auto-locked by dojakweb)
  let lockedKeys = new Set<string>();
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`dojakweb-locked-utxos-${address}`);
      if (raw) lockedKeys = new Set(JSON.parse(raw) as string[]);
    }
  } catch { /* ignore */ }

  const applyLocks = (utxos: OrdUtxo[]) =>
    utxos.filter(u => {
      // Never spend locked UTXOs (inscription-tagged or manually locked).
      if (lockedKeys.has(`${u.txid}:${u.vout}`)) return false;
      // Never spend 0.001 DOGE outputs — canonical Doginals inscription carrier value.
      if (u.value === DUMMY_UTXO_VALUE) return false;
      return true;
    });

  // ── Optional: RPC when Core watches this address and has coins ───────────
  const rpcUtxos = await fetchUtxosViaRpc(address);
  if (rpcUtxos !== null && rpcUtxos.length > 0) {
    console.log(`[doginal-psdt] RPC returned ${rpcUtxos.length} UTXOs`);
    return applyLocks(rpcUtxos);
  }

  if (rpcUtxos !== null && rpcUtxos.length === 0) {
    console.warn(
      '[doginal-psdt] RPC returned 0 UTXOs — Core may not watch this address; trying wallet data provider',
    );
  } else {
    console.log('[doginal-psdt] RPC unavailable — wallet data provider');
  }

  // ── Primary browser path: wallet provider + local spent overlay ──────────
  try {
    const conservative = await fetchSpendableUtxosConservativeForAddress(address);
    const { safe } = await filterPaymentSpendableUtxos(address, conservative);
    const merged = mergePaymentUtxos(
      address,
      safe.map((u) => ({
        txid: u.tx_hash,
        vout: u.tx_output_n,
        value: u.value,
      })),
    );
    const asOrd: OrdUtxo[] = merged.map((u) => ({
      txid: u.txid,
      vout: u.vout,
      value: u.value,
      scriptPubKey: u.scriptPubKey ?? '',
    }));
    const afterLocks = applyLocks(asOrd);
    console.log(
      `[doginal-psdt] wallet provider: ${conservative.length} indexed → ${afterLocks.length} spendable after overlay+locks`,
    );
    return afterLocks;
  } catch (e) {
    console.warn(
      '[doginal-psdt] wallet provider UTXO path failed:',
      e instanceof Error ? e.message : e,
    );
    throw e instanceof Error ? e : new Error(String(e));
  }
}

// ── UTXO selection ────────────────────────────────────────────────────────────

export function selectUtxos(
  utxos: OrdUtxo[],
  amount: number,
  vins: number,
  vouts: number,
  feeRate = DEFAULT_FEE_RATE,
): OrdUtxo[] {
  const selected: OrdUtxo[] = [];
  let total = 0;

  const sorted = utxos
    // Exclude 0.001 DOGE UTXOs — canonical Doginals inscription carrier value.
    // These are reserved as dummy slots in the buy flow and must never be spent as fee inputs.
    // `getAddressUtxos` already strips locked/0.001-DOGE UTXOs; this is a defence-in-depth guard.
    .filter(u => u.value > DUMMY_UTXO_VALUE)
    .sort((a, b) => b.value - a.value);

  for (const u of sorted) {
    selected.push(u);
    total += u.value;
    const needed = amount + DUMMY_UTXO_VALUE
      + calculateFee(vins + selected.length, vouts, feeRate);
    if (total >= needed) break;
  }

  if (total < amount) {
    throw new Error(
      `Not enough spendable DOGE.\nHave: ${shibesToDoge(total)} DOGE\nNeed: ${shibesToDoge(amount)} DOGE`,
    );
  }
  return selected;
}

// ── Async signer compatible with bitcoinjs‑lib v7 ────────────────────────────

async function makeAsyncSigner(privateKeyWif: string): Promise<bitcoin.SignerAsync> {
  const privBytes = decodePrivateKeyFromWIF(privateKeyWif);
  const pubKey = secp.getPublicKey(privBytes, true); // 33-byte compressed
  return {
    publicKey: Buffer.from(pubKey),
    /**
     * bitcoinjs passes the **final 32-byte sighash** from `hashForSignature` / BIP143 — sign it as-is.
     * @noble/secp256k1 defaults `prehash: true` (extra SHA256); that must be disabled or every signature is wrong.
     * `script.signature.encode` expects **64-byte compact r||s**, not DER (it DER-encodes + appends hashType).
     */
    sign: async (hash: Uint8Array): Promise<Uint8Array> => {
      const compact = await secp.signAsync(hash, privBytes, { lowS: true, prehash: false });
      return Buffer.from(compact);
    },
  };
}

/**
 * Sign inputs that still need signatures, finalize all inputs, return raw tx hex.
 * Optional explicitIndexes overrides auto-detection (must be subset of inputs).
 */
export async function signPsdtWithWifToTxHex(
  psbtInput: string,
  privateKeyWif: string,
  explicitIndexes?: number[],
): Promise<string> {
  const psbt   = parsePsdtForLocalSign(psbtInput);
  const signer = await makeAsyncSigner(privateKeyWif);
  await signPsbtInputsWithWif(psbt, signer, explicitIndexes);
  return extractDogePsbtTxHex(psbt);
}

/**
 * Partially sign PSDT (buyer inputs only); return PSBT as hex (not finalized).
 * Seller inscription inputs are skipped so doggy.market `buyListing` can keep their sig.
 */
export async function signPartialPsdtWithWifToHex(
  psbtInput: string,
  privateKeyWif: string,
  explicitIndexes?: number[],
): Promise<string> {
  const psbt   = parsePsdtForLocalSign(psbtInput);
  const signer = await makeAsyncSigner(privateKeyWif);
  await signPsbtInputsWithWif(psbt, signer, explicitIndexes);
  // In browsers, psbt.toBuffer() may be a Uint8Array; normalize to Buffer before hex encoding.
  return Buffer.from(psbt.toBuffer()).toString('hex');
}

// ── Seller PSBT ───────────────────────────────────────────────────────────────

/**
 * Build an unsigned PSBT for selling an inscription.
 * Input 0  : inscription UTXO  (SIGHASH_SINGLE | ANYONECANPAY)
 * Output 0 : seller payment to paymentAddress
 */
export async function buildListingPSDT(
  inscriptionOutput: string,
  priceKoinu: number,
  paymentAddress: string,
): Promise<string> {
  const [txId, voutStr] = inscriptionOutput.split(':');
  const txHex = await getTxHex(txId);
  const psbt  = new bitcoin.Psbt(DOGE_PSBT_OPTS);

  psbt.addInput({
    hash: txId,
    index: parseInt(voutStr, 10),
    nonWitnessUtxo: Buffer.from(txHex, 'hex'),
    sighashType:
      bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY,
  } as any);

  psbt.addOutput({ address: paymentAddress, value: BigInt(priceKoinu) });
  return psbt.toBase64();
}

/**
 * Sign the seller's listing PSBT with SIGHASH_SINGLE | ANYONECANPAY.
 * Returns signed PSBT base64.
 */
export async function signListingPSDT(
  psbtBase64: string,
  privateKeyWif: string,
): Promise<string> {
  const psbt   = bitcoin.Psbt.fromBase64(psbtBase64, DOGE_PSBT_OPTS);
  const signer = await makeAsyncSigner(privateKeyWif);

  await psbt.signInputAsync(0, signer, [
    bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY,
  ]);

  return psbt.toBase64();
}

// ── PSBT validation ───────────────────────────────────────────────────────────

/**
 * Validate a seller's signed PSBT and extract the asking price (koinu).
 * Returns the price if valid, or null if invalid.
 */
export function validateSellerPSDT(
  psbtBase64: string,
  expectedInscriptionUtxo?: string,
): number | null {
  try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, DOGE_PSBT_OPTS);

    if (psbt.txInputs.length !== 1 || psbt.txOutputs.length !== 1) return null;

    const input    = psbt.txInputs[0];
    // Reverse hash bytes to get little‑endian txid string
    const txidHex  = Buffer.from(input.hash).reverse().toString('hex');
    const psbtUtxo = `${txidHex}:${input.index}`;

    if (expectedInscriptionUtxo && psbtUtxo !== expectedInscriptionUtxo) return null;

    // Seller PSBT is signed but must not be fully extractable yet (buyer adds inputs).
    try {
      psbt.extractTransaction(true);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      // These are expected for SIGHASH_SINGLE | ANYONECANPAY listing PSBTs
      if (msg === 'Not finalized' || msg === 'Outputs are spending more than Inputs') {
        /* ok */
      } else {
        return null;
      }
    }

    const out0 = psbt.txOutputs[0];
    if (!out0) return null;
    return Number(out0.value);
  } catch {
    return null;
  }
}

// ── Buyer PSBTs ───────────────────────────────────────────────────────────────

/**
 * Build a PSBT that creates dummy UTXO(s) needed before buying.
 *
 * OpenOrdex / dojak default: one 100_000 koinu (0.001 Ð) output.
 * doggy.market: two **100_001** koinu outputs — they skip 100_000 as inscription postage
 * (`no dummy utxos`). Pass `{ dummyValueKoinu: 100_001, dummyCount: 2 }`.
 */
export async function buildDummyUtxoPSDT(
  payerAddress: string,
  paymentUtxos: OrdUtxo[],
  opts?: { feeRateKoinuPerByte?: number; dummyValueKoinu?: number; dummyCount?: number },
): Promise<string> {
  // Dummy splits are ~226 vB. Cap so we do not trip MyDoge/bitcoinjs maximumFeeRate,
  // but never underpay the live inclusion estimate within that cap.
  const live = await resolveBuyFeeRateKoinuPerByte(6);
  const feeRate = Math.min(5_000, Math.max(opts?.feeRateKoinuPerByte ?? live, live));
  const dummyValue = opts?.dummyValueKoinu ?? DUMMY_UTXO_VALUE;
  const dummyCount = Math.max(1, Math.floor(opts?.dummyCount ?? 1));
  const psbt  = new bitcoin.Psbt(DOGE_PSBT_OPTS);
  let total   = 0;

  for (const u of paymentUtxos) {
    const txHex = await getTxHex(u.txid);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
    } as any);
    total += u.value;
  }

  for (let i = 0; i < dummyCount; i++) {
    psbt.addOutput({ address: payerAddress, value: BigInt(dummyValue) });
  }

  // Size fee for dummies + change. Sub-0.01 Ð outs are Dogecoin soft-dust, so Core
  // requires +0.01 Ð extra fee per such output or the split sits unconfirmed forever.
  const sizeFee = calculateFee(
    psbt.txInputs.length,
    dummyCount + 1,
    feeRate,
    false,
    BUY_FEE_SIZE_PADDING_BYTES,
  );
  const dummyValues = Array.from({ length: dummyCount }, () => dummyValue);
  const dustPenalty = softDustFeePenaltyKoinu(dummyValues);
  const fee = sizeFee + dustPenalty;
  const dummyTotal = dummyValue * dummyCount;
  const change = total - dummyTotal - fee;
  if (change < 0) {
    throw new Error(
      `Not enough spendable DOGE to create dummy coin(s) (need ~${shibesToDoge(dummyTotal + fee).toFixed(4)} Ð including soft-dust fee).`,
    );
  }
  if (change >= SOFT_DUST_KOINU) {
    psbt.addOutput({ address: payerAddress, value: BigInt(change) });
  }
  // Change below 0.01 Ð is absorbed into the miner fee (another soft-dust out would cost +0.01).

  return psbt.toBase64();
}

export interface BuildBuyPSDTParams {
  sellerSignedPsbtBase64: string;
  dummyUtxo: OrdUtxo;
  paymentUtxos: OrdUtxo[];
  receiverAddress: string;
  payerAddress: string;
  inscriptionOutputValue: number; // shibes in the inscription UTXO
  /** When set, used for fee sizing; otherwise resolved via `resolveBuyFeeRateKoinuPerByte`. */
  feeRateKoinuPerByte?: number;
}

/**
 * Assemble the complete buyer PSBT:
 *   Input 0  : inscription UTXO  (seller's SIGHASH_SINGLE|ACP — **must stay index 0** to match listing sig)
 *   Input 1  : dummy UTXO  (merged with inscription into one output)
 *   Inputs 2+: buyer payment UTXOs
 *   Output 0 : seller payment (same script/value as listing — only output covered by seller sig)
 *   Output 1 : inscription → buyer (dummy + inscription value)
 *   Output 2 : new dummy UTXO for buyer
 *   Output 3 : buyer change
 *
 * Compared to some marketplace PSBT stacks: those use seller SIGHASH_NONE|ANYONECANPAY, a 3‑output seller
 * template (seller + fee + inscription), and an optional pre‑purchase consolidation tx. This flow is
 * OpenOrdex‑style: 1/1 seller PSBT, dummy input + merged inscription output, no marketplace fee output.
 */
export async function buildBuyPSDT(p: BuildBuyPSDTParams): Promise<string> {
  const feeRate =
    p.feeRateKoinuPerByte ?? (await resolveBuyFeeRateKoinuPerByte());
  const sellerPsbt = bitcoin.Psbt.fromBase64(p.sellerSignedPsbtBase64, DOGE_PSBT_OPTS);

  const sellerPay0 = sellerPsbt.txOutputs[0];
  if (!sellerPay0) {
    throw new Error(
      'Seller listing PSDT has no outputs. The listing may be invalid or incompatible with this buyer flow.',
    );
  }
  const payScript = resolveListingPaymentScript(sellerPay0);
  if (!payScript?.length) {
    throw new Error(
      'Seller listing PSDT has no valid payment output script (output 0). The listing may be invalid or incompatible with this buyer flow.',
    );
  }
  const price = Number(sellerPay0.value);
  const sellerPayValue =
    typeof sellerPay0.value === 'bigint' ? sellerPay0.value : BigInt(Math.floor(Number(sellerPay0.value)));

  // ── Input 0: seller's inscription input (copy with existing partial sigs) ──
  // Must remain at vin 0: listing was signed with SIGHASH_SINGLE|ANYONECANPAY at index 0, which commits
  // to output 0 (seller payment). Shifting this input breaks the preimage vs. the stored signature.
  const sellerGlobalTx = (sellerPsbt.data.globalMap.unsignedTx as any)?.tx as bitcoin.Transaction | undefined;
  const sellerTxIn     = sellerGlobalTx?.ins?.[0];
  const sellerPsbtIn   = sellerPsbt.data.inputs[0];
  if (!sellerTxIn || !sellerPsbtIn) {
    throw new Error('Seller PSDT is missing input 0 (inscription). Cannot build buy transaction.');
  }

  const psbt  = new bitcoin.Psbt(DOGE_PSBT_OPTS);
  // Preserve the seller's transaction version and locktime — both are part of the
  // SIGHASH_SINGLE|ANYONECANPAY preimage. If the buyer assembles a transaction with a
  // different version (e.g. 1 vs 2) or locktime than what the seller signed, the
  // seller's signature will fail network verification (NULLFAIL / script-verify-flag-failed).
  // setVersion/setLocktime must be called before any inputs are added (bitcoinjs-lib
  // rejects changes after partialSig data is present).
  if (typeof sellerGlobalTx?.version  === 'number') psbt.setVersion(sellerGlobalTx.version);
  if (typeof sellerGlobalTx?.locktime === 'number' && sellerGlobalTx.locktime !== 0) psbt.setLocktime(sellerGlobalTx.locktime);

  let paymentTotal = 0;
  const prevTxid = Buffer.from(sellerTxIn.hash).reverse().toString('hex');
  let sellerPrevTx = sellerPsbtIn.nonWitnessUtxo as Buffer | undefined;
  if (sellerPrevTx) {
    try {
      assertPrevoutExists(sellerPrevTx, sellerTxIn.index, 'Seller PSDT embedded parent tx');
    } catch {
      sellerPrevTx = undefined;
    }
  }
  if (!sellerPrevTx) {
    sellerPrevTx = Buffer.from(await getTxHex(prevTxid), 'hex');
    assertPrevoutExists(sellerPrevTx as Buffer, sellerTxIn.index, 'Inscription parent tx (from chain)');
  }
  if (!sellerPrevTx) {
    throw new Error('Failed to resolve inscription parent transaction.');
  }
  const sellerPrevTxBuf = sellerPrevTx;

  const inscriptionWU = witnessUtxoFromPrevTx(
    sellerPrevTxBuf,
    sellerTxIn.index,
    'Inscription prevout',
  );

  // MyDoge / strict PSBT codecs reject keys like redeemScript when present as `undefined`
  // (Expected Uint8Array and got undefined). Only copy optional fields that are set.
  const sellerInputData: any = {
    hash: sellerTxIn.hash,
    index: sellerTxIn.index,
    sequence: sellerTxIn.sequence,
    nonWitnessUtxo: sellerPrevTxBuf,
    witnessUtxo: inscriptionWU,
    partialSig: sellerPsbtIn.partialSig,
    sighashType: sellerPsbtIn.sighashType,
  };
  const redeem = sellerPsbtIn.redeemScript as Buffer | Uint8Array | undefined;
  if (redeem != null && redeem.length > 0) sellerInputData.redeemScript = redeem;
  const wscript = sellerPsbtIn.witnessScript as Buffer | Uint8Array | undefined;
  if (wscript != null && wscript.length > 0) sellerInputData.witnessScript = wscript;
  if (sellerPsbtIn.bip32Derivation?.length) {
    sellerInputData.bip32Derivation = sellerPsbtIn.bip32Derivation;
  }
  psbt.addInput(sellerInputData as any);

  // ── Input 1: dummy UTXO ──
  const dummyTxHex = await getTxHex(p.dummyUtxo.txid);
  const dummyTxBuf = Buffer.from(dummyTxHex, 'hex');
  assertPrevoutExists(dummyTxBuf, p.dummyUtxo.vout, 'Dummy UTXO');
  const dummyOnChainShibes = prevoutValueShibesFromTxBuf(dummyTxBuf, p.dummyUtxo.vout, 'Dummy UTXO');
  // Buyer dummy + payment inputs are legacy P2PKH: use nonWitnessUtxo only.
  psbt.addInput({
    hash: p.dummyUtxo.txid,
    index: p.dummyUtxo.vout,
    nonWitnessUtxo: dummyTxBuf,
  } as any);

  // ── Output 0: seller payment (must match listing — seller’s SIGHASH_SINGLE|ACP binds this output) ──
  psbt.addOutput({ script: payScript, value: sellerPayValue });

  // ── Output 1: inscription → buyer
  psbt.addOutput({
    address: p.receiverAddress,
    value: BigInt(dummyOnChainShibes + p.inscriptionOutputValue),
  });

  // ── Inputs 2+: buyer payment UTXOs ──
  for (const u of p.paymentUtxos) {
    const txHex = await getTxHex(u.txid);
    const payBuf = Buffer.from(txHex, 'hex');
    assertPrevoutExists(payBuf, u.vout, `Payment UTXO ${u.txid}:${u.vout}`);
    const payOnChain = prevoutValueShibesFromTxBuf(payBuf, u.vout, `Payment ${u.txid}:${u.vout}`);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: payBuf,
    } as any);
    paymentTotal += payOnChain;
  }

  // ── Output 2: new dummy UTXO for buyer ──
  psbt.addOutput({ address: p.payerAddress, value: BigInt(DUMMY_UTXO_VALUE) });

  const fee = calculateFee(
    psbt.txInputs.length,
    psbt.txOutputs.length,
    feeRate,
    true,
    BUY_FEE_SIZE_PADDING_BYTES,
  );
  // Balance: dummy + inscription + payments = (dummy+inscription out) + price + new_dummy + change + fee
  // ⇒ payments = price + new_dummy + change + fee
  const change = paymentTotal - price - DUMMY_UTXO_VALUE - fee;

  if (change < 0) {
    throw new Error(
      `Not enough DOGE to buy this doginal.\nPrice: ${shibesToDoge(price)} DOGE\n` +
        `New dummy + fees: ${shibesToDoge(DUMMY_UTXO_VALUE + fee)} DOGE\n` +
        `You have in payment UTXOs: ${shibesToDoge(paymentTotal)} DOGE`,
    );
  }

  // ── Output 3: buyer change (only if above dust limit — else absorb into fee) ──
  if (change >= DUMMY_UTXO_VALUE) {
    psbt.addOutput({ address: p.payerAddress, value: BigInt(change) });
  } else if (change < 0) {
    // Already caught above, but guard against race conditions in fee re-estimation.
    throw new Error(`Unexpected negative change (${change}) — coin selection error.`);
  }
  // change between 0 and DUMMY_UTXO_VALUE (dust): absorbed into miner fee intentionally.

  return psbt.toBase64();
}

/**
 * Sign buyer inputs (1, 2, 3, …) — skip input 0 (seller's pre‑signed inscription).
 * Finalizes all inputs and returns the raw tx hex ready to broadcast.
 */
export async function signAndFinalizeBuyPSDT(
  psbtBase64: string,
  privateKeyWif: string,
): Promise<string> {
  const psbt   = bitcoin.Psbt.fromBase64(psbtBase64, DOGE_PSBT_OPTS);
  const signer = await makeAsyncSigner(privateKeyWif);

  for (let i = 0; i < psbt.inputCount; i++) {
    if (i === 0) continue;
    await psbt.signInputAsync(i, signer);
  }

  for (let i = 0; i < psbt.inputCount; i++) {
    try { psbt.finalizeInput(i); } catch { /* input 0 may already be finalized */ }
  }

  return extractDogePsbtTxHex(psbt);
}

/**
 * Sign buyer inputs of a PSBT (all inputs for a dummy‑UTXO creation tx).
 */
export async function signAndFinalizeSimplePSDT(
  psbtBase64: string,
  privateKeyWif: string,
): Promise<string> {
  const psbt   = bitcoin.Psbt.fromBase64(psbtBase64, DOGE_PSBT_OPTS);
  const signer = await makeAsyncSigner(privateKeyWif);

  await psbt.signAllInputsAsync(signer);
  return extractDogePsbtTxHex(psbt);
}

// ── Send inscription (transfer to another address) ───────────────────────────

export interface SendInscriptionParams {
  inscriptionOutput: string;   // "txid:vout"
  inscriptionOutputValue: number; // shibes
  recipientAddress: string;
  senderAddress: string;
  paymentUtxos: OrdUtxo[];
  privateKeyWif: string;
}

/** Unsigned send-inscription PSBT + human-readable plan (for review UI before signing). */
export interface SendInscriptionPsbtDraft {
  psbtBase64: string;
  feeShib: number;
  inputs: { outpoint: string; valueShib: number; role: 'inscription' | 'fee_input' }[];
  outputs: { address: string; valueShib: number; role: 'to_recipient' | 'change' }[];
}

function txInputHashLeHex(txin: { hash: Uint8Array }): string {
  return Buffer.from(txin.hash).reverse().toString('hex');
}

/**
 * Build an unsigned PSBT that spends the inscription to `recipientAddress` and uses `paymentUtxos` for fees.
 */
export async function buildSendInscriptionPsbtUnsigned(
  p: Omit<SendInscriptionParams, 'privateKeyWif'>,
): Promise<bitcoin.Psbt> {
  const [insTxid, insVoutStr] = p.inscriptionOutput.split(':');
  const insVout = parseInt(insVoutStr, 10);
  const insTxHex = await getTxHex(insTxid);

  const psbt = new bitcoin.Psbt(DOGE_PSBT_OPTS);

  psbt.addInput({
    hash: insTxid,
    index: insVout,
    nonWitnessUtxo: Buffer.from(insTxHex, 'hex'),
  } as any);

  psbt.addOutput({ address: p.recipientAddress.trim(), value: BigInt(p.inscriptionOutputValue) });

  let paymentTotal = 0;
  for (const u of p.paymentUtxos) {
    const txHex = await getTxHex(u.txid);
    psbt.addInput({ hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(txHex, 'hex') } as any);
    paymentTotal += u.value;
  }

  const fee = calculateFee(psbt.txInputs.length, psbt.txOutputs.length);
  const change = paymentTotal - fee;
  if (change < 0) throw new Error('Insufficient DOGE for transaction fee.');
  if (change > 546) psbt.addOutput({ address: p.senderAddress.trim(), value: BigInt(change) });

  return psbt;
}

export function describeSendInscriptionPsbt(
  psbt: bitcoin.Psbt,
  senderAddress: string,
): Pick<SendInscriptionPsbtDraft, 'feeShib' | 'inputs' | 'outputs'> {
  const sender = senderAddress.trim();
  let inputTotal = 0;
  const inputs: SendInscriptionPsbtDraft['inputs'] = [];
  for (let i = 0; i < psbt.inputCount; i++) {
    const txin = psbt.txInputs[i];
    const outpoint = `${txInputHashLeHex(txin)}:${txin.index}`;
    const nw = psbt.data.inputs[i]?.nonWitnessUtxo;
    if (!nw) {
      throw new Error('Send inscription PSBT is missing a full previous transaction for an input.');
    }
    const prevTx = bitcoin.Transaction.fromBuffer(nw as Buffer);
    const out = prevTx.outs[txin.index];
    if (!out) throw new Error(`Missing prevout for input ${i}`);
    const valueShib = Number(out.value);
    inputTotal += valueShib;
    inputs.push({
      outpoint,
      valueShib,
      role: i === 0 ? 'inscription' : 'fee_input',
    });
  }

  const outputs: SendInscriptionPsbtDraft['outputs'] = [];
  let outputTotal = 0;
  for (let o = 0; o < psbt.txOutputs.length; o++) {
    const out = psbt.txOutputs[o];
    outputTotal += Number(out.value);
    let address: string;
    try {
      address = bitcoin.address.fromOutputScript(out.script, DOGE_NETWORK);
    } catch {
      address = '(non-address output)';
    }
    const valueShib = Number(out.value);
    const role: 'to_recipient' | 'change' =
      o === 0 ? 'to_recipient' : address === sender ? 'change' : 'to_recipient';
    outputs.push({ address, valueShib, role });
  }

  const feeShib = inputTotal - outputTotal;
  if (feeShib < 0) {
    throw new Error('Invalid send plan: outputs exceed inputs.');
  }
  return { feeShib, inputs, outputs };
}

/** Build unsigned PSBT + fee / input / output breakdown for wallet review UI. */
export async function buildSendInscriptionDraft(
  p: Omit<SendInscriptionParams, 'privateKeyWif'>,
): Promise<SendInscriptionPsbtDraft> {
  const psbt = await buildSendInscriptionPsbtUnsigned(p);
  const rest = describeSendInscriptionPsbt(psbt, p.senderAddress);
  return { psbtBase64: psbt.toBase64(), ...rest };
}

/**
 * Build, sign, and return the raw tx hex for transferring an inscription.
 * The inscription UTXO goes as input 0 → output 0 (to recipient).
 * Fee is paid from paymentUtxos.
 */
export async function buildAndSignSendInscription(p: SendInscriptionParams): Promise<string> {
  const psbt = await buildSendInscriptionPsbtUnsigned(p);
  return signAndFinalizeSimplePSDT(psbt.toBase64(), p.privateKeyWif);
}

/**
 * Extract the inscription UTXO's on-chain value (shibes) from a seller-signed PSBT.
 * Returns DUMMY_UTXO_VALUE as a safe fallback if the nonWitnessUtxo is missing.
 */
export function getInscriptionValueFromPsdt(psbtBase64: string): number {
  try {
    const psbt  = bitcoin.Psbt.fromBase64(psbtBase64, DOGE_PSBT_OPTS);
    const input = psbt.data.inputs[0];
    const txIn  = psbt.txInputs[0];
    if (input.nonWitnessUtxo) {
      const tx  = bitcoin.Transaction.fromBuffer(input.nonWitnessUtxo as Buffer);
      const out = tx.outs[txIn.index];
      if (out) return Number(out.value);
    }
  } catch { /* fall through */ }
  return DUMMY_UTXO_VALUE;
}

/**
 * Simplified buy PSBT builder for Nostr/QR-code listing purchases.
 *
 * Handles inscription value extraction and dummy-UTXO selection automatically:
 *  - Reads the inscription output value directly from the seller's nonWitnessUtxo
 *  - Uses the smallest buyer UTXO as the dummy (merged buy PSBT: seller input 0, dummy input 1)
 *  - Uses remaining UTXOs for payment
 *
 * Requires at least 2 UTXOs in `buyerUtxos`.
 */
export async function buildBuyPSDTSimple(params: {
  sellerSignedPsbtBase64: string;
  buyerUtxos: OrdUtxo[];
  receiverAddress: string;
  payerAddress: string;
  feeRateKoinuPerByte?: number;
}): Promise<string> {
  const { sellerSignedPsbtBase64, buyerUtxos, receiverAddress, payerAddress } = params;
  const feeRate =
    params.feeRateKoinuPerByte ?? (await resolveBuyFeeRateKoinuPerByte());

  if (buyerUtxos.length < 2) {
    throw new Error(
      'Need at least 2 UTXOs to buy (one dummy + one for payment). ' +
      'Split a large UTXO into two using UTXO Tools first.',
    );
  }

  // Extract inscription output value from seller PSBT (embedded parent tx, else chain)
  const sellerPsbt  = bitcoin.Psbt.fromBase64(sellerSignedPsbtBase64, DOGE_PSBT_OPTS);
  const sellerInput = sellerPsbt.data.inputs[0];
  const sellerTxIn  = sellerPsbt.txInputs[0];
  const readInscriptionValue = (txBuf: Buffer, vout: number): number | null => {
    try {
      const sellerTx = bitcoin.Transaction.fromBuffer(txBuf);
      const out = sellerTx.outs[vout];
      if (!out?.script?.length) return null;
      const v = out.value;
      return typeof v === 'bigint' ? Number(v) : Number(v);
    } catch {
      return null;
    }
  };
  let inscriptionOutputValue: number | null = null;
  if (sellerInput.nonWitnessUtxo) {
    inscriptionOutputValue = readInscriptionValue(
      sellerInput.nonWitnessUtxo as Buffer,
      sellerTxIn.index,
    );
  }
  if (inscriptionOutputValue === null) {
    const prevTxid = Buffer.from(sellerTxIn.hash).reverse().toString('hex');
    try {
      const hex = await getTxHex(prevTxid);
      inscriptionOutputValue = readInscriptionValue(Buffer.from(hex, 'hex'), sellerTxIn.index);
    } catch {
      /* ignore */
    }
  }
  if (inscriptionOutputValue === null) inscriptionOutputValue = DUMMY_UTXO_VALUE;

  // Read price from seller PSBT (needed for coin selection below).
  const sellerPay0 = sellerPsbt.txOutputs[0];
  if (!sellerPay0) throw new Error('Seller PSDT has no output — invalid listing.');
  const price = Number(sellerPay0.value);

  // Sort by on-chain prevout value (Blockchair output `value` can disagree with raw tx → wrong dummy pick).
  const withChainValues = await Promise.all(
    buyerUtxos.map(async (u) => ({
      ...u,
      value: await getPrevoutValueShibes(u.txid, u.vout),
    })),
  );
  // Smallest UTXO = dummy slot; largest-first for payment (fewer inputs = lower fee).
  const sortedAsc = [...withChainValues].sort((a, b) => a.value - b.value);
  const dummyUtxo = sortedAsc[0];
  const paymentCandidates = [...sortedAsc.slice(1)].sort((a, b) => b.value - a.value);

  // ── Greedy coin selection ──────────────────────────────────────────────────
  // Pick the minimum set of payment UTXOs to cover: price + new-dummy output + fee.
  // Iterate adding one UTXO at a time (largest first) and re-estimate fee each time.
  //   inputs:  1 (seller inscription) + 1 (dummy) + paymentUtxos.length
  //   outputs: 3 fixed (seller pay, inscription→buyer, new dummy) + 1 change = 4
  const paymentUtxos: typeof paymentCandidates = [];
  let paymentTotal = 0;
  for (const u of paymentCandidates) {
    paymentUtxos.push(u);
    paymentTotal += u.value;
    const nInputs = 2 + paymentUtxos.length;
    const fee = calculateFee(
      nInputs,
      3,
      feeRate,
      /* includeChange */ true,
      BUY_FEE_SIZE_PADDING_BYTES,
    );
    if (paymentTotal >= price + DUMMY_UTXO_VALUE + fee) break;
  }

  const finalNInputs = 2 + paymentUtxos.length;
  const finalFee = calculateFee(
    finalNInputs,
    3,
    feeRate,
    true,
    BUY_FEE_SIZE_PADDING_BYTES,
  );
  if (paymentTotal < price + DUMMY_UTXO_VALUE + finalFee) {
    throw new Error(
      `Insufficient DOGE to complete purchase.\n` +
      `Price: ${shibesToDoge(price).toFixed(8)} DOGE\n` +
      `Buyer needs (price + fees): ${shibesToDoge(price + DUMMY_UTXO_VALUE + finalFee).toFixed(8)} DOGE\n` +
      `Available in spendable UTXOs: ${shibesToDoge(paymentTotal).toFixed(8)} DOGE`,
    );
  }

  return buildBuyPSDT({
    sellerSignedPsbtBase64,
    dummyUtxo,
    paymentUtxos,
    receiverAddress,
    payerAddress,
    inscriptionOutputValue,
    feeRateKoinuPerByte: feeRate,
  });
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Tx explorer URL from Wallet → Settings preference (defaults to explorer.dogenals.com). */
export function sochainDogeTxUrl(txid: string): string {
  // Kept name for callers; prefers Ðexplorer / user preference over hardcoded SoChain.
  return dogeTxExplorerUrl(txid);
}

/**
 * Poll until the tx is known to command.dog Core (or optional wallet RPC).
 * Name kept for API compat — does **not** call BlockCypher.
 */
export async function waitForTxOnBlockcypher(
  txid: string,
  _opts?: { attempts?: number; delayMs?: number },
): Promise<boolean> {
  try {
    await waitForBroadcastPropagationVerified(txid.trim().toLowerCase());
    return true;
  } catch {
    return false;
  }
}

export async function broadcastTx(txHex: string): Promise<string> {
  // command.dog → Core only (same as Wallet Settings studio default). Public relays are not a fallback.
  const txid = await broadcastUtxoTx(txHex);
  console.log('[doginal-psdt] Broadcast succeeded via wallet relay order:', txid);
  const normalizedTxid = txid.toLowerCase();
  // Do not clobber a richer protocol journal row (Ðunes / Ðalkanes / etc.) that the
  // caller is about to (or already did) write for this txid.
  const existing = loadWalletTxJournal().find((row) => row.txid === normalizedTxid);
  if (!existing) {
    upsertWalletTxJournalEntry({
      txid: normalizedTxid,
      protocol: 'dogecoin',
      action: 'broadcast',
      title: 'Dogecoin transaction broadcast',
      summary: 'Raw transaction accepted by the configured Dojakweb relay path',
      status: 'broadcasted',
    });
  } else if (existing.status === 'draft' || existing.status === 'signed') {
    upsertWalletTxJournalEntry({
      txid: normalizedTxid,
      address: existing.address,
      protocol: existing.protocol,
      action: existing.action,
      title: existing.title,
      summary: existing.summary,
      status: 'broadcasted',
      originHost: existing.originHost,
      originPath: existing.originPath,
      originLabel: existing.originLabel,
      metadata: existing.metadata,
    });
  }
  return normalizedTxid;
}
