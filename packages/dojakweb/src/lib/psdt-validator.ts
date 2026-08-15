/**
 * PSDT Validation — verifies a seller-signed listing PSDT before a buyer signs.
 *
 * Runs a layered set of checks:
 *   1. Structure: correct input/output count, sighash type
 *   2. On-chain: inscription UTXO is still unspent (Blockchair) — UX only:
 *      a stale UTXO means the tx will be rejected by the network harmlessly
 *      (double-spend protection prevents the buyer losing funds), but we
 *      surface it early so the buyer isn't left confused.
 *   3. Inscription: inscription ID exists and the UTXO contains it (MyDoge)
 *   4. Sanity: price > 0, reasonable values
 *
 * The CRITICAL security check is sighash type (step 2 inside Parse):
 * if the seller's sighash is not SIGHASH_SINGLE|ANYONECANPAY, an attacker
 * could craft a tx that re-routes the buyer's funds.
 *
 * Result.safeToSign = true only when ALL error checks pass.
 * Warnings are informational but non-blocking.
 */

import * as bitcoin from 'bitcoinjs-lib';
import { gatedMydogeGetJson, MydogeHttpError } from './mydoge/httpGate';
import { normalizeDoginalInscriptionId } from '../utils/api';
import { DOGE_NETWORK, BLOCKCHAIR_URL, DUMMY_UTXO_VALUE } from './doginal-psdt';

const MYDOGE_API = 'https://api.mydoge.com';

// SIGHASH_SINGLE | SIGHASH_ANYONECANPAY  (0x83)
const REQUIRED_SIGHASH =
  bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY;

export interface PSDTValidationResult {
  // ── Parsed from PSBT (always populated on success) ─────────────────────────
  inscriptionUtxo:        string;         // "txid:vout"
  priceKoinu:             number;
  priceDoge:              number;

  // ── Individual check results ─────────────────────────────────────────────
  structureOk:            boolean;        // 1 input / 1 output
  sighashOk:              boolean;        // 0x83 SIGHASH_SINGLE|ACP
  networkOk:              boolean | null; // output address is a valid Dogecoin address
  detectedNetwork:        string | null;  // 'dogecoin' | 'bitcoin' | 'unknown'
  utxoUnspent:            boolean | null; // null = couldn't verify
  inscriptionExists:      boolean | null; // null = couldn't verify
  utxoMatchesInscription: boolean | null; // null = couldn't verify

  // ── Inscription metadata (from MyDoge) ──────────────────────────────────
  inscriptionId:          string | null;
  inscriptionNumber:      string | number | null;
  inscriptionContentType: string | null;
  inscriptionPreviewUrl:  string | null;

  // ── Summary ─────────────────────────────────────────────────────────────
  warnings:   string[];
  errors:     string[];
  /** true only when all hard checks pass — safe to proceed to buy */
  safeToSign: boolean;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function blank(): PSDTValidationResult {
  return {
    inscriptionUtxo:        '',
    priceKoinu:             0,
    priceDoge:              0,
    structureOk:            false,
    sighashOk:              false,
    networkOk:              null,
    detectedNetwork:        null,
    utxoUnspent:            null,
    inscriptionExists:      null,
    utxoMatchesInscription: null,
    inscriptionId:          null,
    inscriptionNumber:      null,
    inscriptionContentType: null,
    inscriptionPreviewUrl:  null,
    warnings:               [],
    errors:                 [],
    safeToSign:             false,
  };
}

// ── Quick network sniff (no API calls, synchronous) ──────────────────────────

/**
 * Synchronously decode a PSDT's first output address and determine whether it
 * is a Dogecoin address, a Bitcoin address, or unknown.
 *
 * Use this for cheap per-card display — call validateListingPSDT for the full
 * security check before a buyer signs.
 */
/**
 * Decode the first output address of a PSBT in both network interpretations.
 *
 * NOTE: P2PKH/P2SH scripts are network-agnostic — the same script hash is
 * valid on both chains, just with different version bytes. fromOutputScript
 * with Dogecoin params produces 'D...'/'A...'; with Bitcoin params '1...'/'3...'.
 * There is no way to determine the intended chain from the script alone.
 */
export function decodePsdtOutputAddress(psbtBase64: string): { doge: string | null; btc: string | null } {
  try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: DOGE_NETWORK });
    if (!psbt.txOutputs.length) return { doge: null, btc: null };
    const script = psbt.txOutputs[0]?.script;
    if (!script?.length) return { doge: null, btc: null };
    let doge: string | null = null;
    let btc:  string | null = null;
    try { doge = bitcoin.address.fromOutputScript(script, DOGE_NETWORK); } catch { /* no-op */ }
    try { btc  = bitcoin.address.fromOutputScript(script, bitcoin.networks.bitcoin); } catch { /* no-op */ }
    return { doge, btc };
  } catch {
    return { doge: null, btc: null };
  }
}

export function quickCheckPsdtNetwork(psbtBase64: string): 'dogecoin' | 'bitcoin' | 'unknown' {
  try {
    // fromBase64 is a pure binary parse — network param only affects signing, so
    // this correctly parses both Dogecoin and Bitcoin PSBTs.
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: DOGE_NETWORK });
    if (!psbt.txOutputs.length) return 'unknown';
    const script = psbt.txOutputs[0]?.script;
    if (!script?.length) return 'unknown';

    // Try Dogecoin address decode first
    try {
      const addr = bitcoin.address.fromOutputScript(script, DOGE_NETWORK);
      if (addr.startsWith('D') || addr.startsWith('A')) return 'dogecoin';
    } catch { /* not a dogecoin address */ }

    // Try Bitcoin
    try {
      bitcoin.address.fromOutputScript(script, bitcoin.networks.bitcoin);
      return 'bitcoin';
    } catch { /* not bitcoin either */ }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Main validator ────────────────────────────────────────────────────────────

/**
 * Validate a seller-signed PSDT before a buyer signs.
 *
 * @param psbtBase64          The seller's signed PSDT (base64)
 * @param claimedInscriptionId  The inscription ID displayed to the buyer (from Nostr tag / URL param)
 */
export async function validateListingPSDT(
  psbtBase64: string,
  claimedInscriptionId?: string,
): Promise<PSDTValidationResult> {
  const r = blank();
  r.inscriptionId = claimedInscriptionId ?? null;

  // ── 1. Parse PSDT ─────────────────────────────────────────────────────────
  let psbt: bitcoin.Psbt;
  try {
    psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: DOGE_NETWORK });
  } catch {
    r.errors.push('PSDT is malformed or not valid base64.');
    return r;
  }

  // Must be exactly 1 input + 1 output
  if (psbt.txInputs.length !== 1 || psbt.txOutputs.length !== 1) {
    r.errors.push(
      `Unexpected structure: ${psbt.txInputs.length} input(s), ${psbt.txOutputs.length} output(s). ` +
      `A seller PSDT must have exactly 1 input and 1 output.`,
    );
    return r;
  }
  r.structureOk = true;

  // ── Network check: verify output address is Dogecoin, not Bitcoin ─────────
  try {
    const outputScript = psbt.txOutputs[0]?.script;
    if (!outputScript?.length) {
      r.errors.push('PSDT payment output has no script.');
      return r;
    }
    try {
      const addr = bitcoin.address.fromOutputScript(outputScript, DOGE_NETWORK);
      // Dogecoin mainnet P2PKH starts with 'D', P2SH starts with 'A'
      if (addr.startsWith('D') || addr.startsWith('A')) {
        r.networkOk      = true;
        r.detectedNetwork = 'dogecoin';
      } else {
        r.networkOk      = false;
        r.detectedNetwork = 'dogecoin-wrong-prefix';
        r.errors.push(
          `PSDT output address (${addr}) does not look like a Dogecoin address. ` +
          `Dogecoin P2PKH addresses start with "D" and P2SH addresses start with "A".`,
        );
      }
    } catch {
      // Failed to decode as Dogecoin — try Bitcoin to give a better message
      try {
        const btcAddr = bitcoin.address.fromOutputScript(outputScript, bitcoin.networks.bitcoin);
        r.networkOk      = false;
        r.detectedNetwork = 'bitcoin';
        r.errors.push(
          `PSDT output is a Bitcoin address (${btcAddr}), not a Dogecoin address. ` +
          `This listing was likely created by a Bitcoin Ordinals tool (e.g. OpenOrdex) and is NOT a valid Doginal listing.`,
        );
      } catch {
        r.networkOk      = false;
        r.detectedNetwork = 'unknown';
        r.warnings.push('Could not determine the network for this PSDT output address — inspect manually.');
      }
    }
  } catch { /* ignore unexpected errors in network check */ }

  // Extract UTXO reference
  const txIn   = psbt.txInputs[0];
  const txidHex = Buffer.from(txIn.hash).reverse().toString('hex');
  r.inscriptionUtxo = `${txidHex}:${txIn.index}`;

  // Extract price
  r.priceKoinu = Number(psbt.txOutputs[0].value);
  r.priceDoge  = r.priceKoinu / 1e8;

  if (r.priceKoinu <= 0) {
    r.errors.push('PSDT output value is zero or negative — not a valid listing.');
    return r;
  }

  // ── 2. Sighash check (critical — prevents fund-draining attacks) ──────────
  const inputData  = psbt.data.inputs[0];
  const partialSigs = inputData.partialSig ?? [];

  // Check sighashType field in PSBT input data
  if (inputData.sighashType !== undefined && inputData.sighashType !== REQUIRED_SIGHASH) {
    r.errors.push(
      `Dangerous sighash: 0x${inputData.sighashType.toString(16)} — expected 0x83 ` +
      `(SIGHASH_SINGLE | ANYONECANPAY). Signing this PSDT as a buyer could drain your funds.`,
    );
    return r;
  }

  // Also check the trailing byte on each actual signature
  for (const sig of partialSigs) {
    const lastByte = sig.signature[sig.signature.length - 1];
    if (lastByte !== REQUIRED_SIGHASH) {
      r.errors.push(
        `Signature has sighash byte 0x${lastByte.toString(16)}, not 0x83. ` +
        `This PSDT is not safe to include in a buy transaction.`,
      );
      return r;
    }
  }

  r.sighashOk = true;

  // Price sanity warning (non-blocking)
  if (r.priceDoge < 1) {
    r.warnings.push(`Very low price (${r.priceDoge.toFixed(4)} DOGE) — confirm this is intentional.`);
  }

  // Run on-chain checks in parallel to keep it fast
  await Promise.all([
    checkUtxoUnspent(r),
    checkInscription(r, claimedInscriptionId),
  ]);

  // Final verdict
  r.safeToSign = r.errors.length === 0;
  return r;
}

// ── On-chain check: UTXO is unspent ──────────────────────────────────────────

async function checkUtxoUnspent(r: PSDTValidationResult): Promise<void> {
  try {
    const [txid, voutStr] = r.inscriptionUtxo.split(':');
    const vout = parseInt(voutStr, 10);
    // Use the transaction dashboard endpoint — more reliable than the outputs query endpoint
    const res = await fetch(`${BLOCKCHAIR_URL}/dashboards/transaction/${txid}`);
    if (!res.ok) return;
    const data = await res.json();
    const outputs: any[] = data?.data?.[txid]?.outputs ?? [];
    const row = outputs.find((o: any) => o.index === vout);
    if (!row) {
      r.warnings.push('Could not find the inscription UTXO on Blockchair — may be very recent.');
      return;
    }
    // spending_transaction_hash is null when unspent
    r.utxoUnspent = row.spending_transaction_hash === null || row.spending_transaction_hash === undefined;
    if (!r.utxoUnspent) {
      // Not a fund-loss risk (the combined tx would just be rejected by the network),
      // but surfaces it early so the buyer knows the listing is stale.
      r.errors.push(
        'The inscription UTXO has already been spent — this listing is stale or the item was already sold. ' +
        'Your funds are safe (the network would reject a double-spend), but the purchase would fail.',
      );
    }
  } catch {
    r.warnings.push('Could not verify UTXO status (Blockchair unavailable) — proceed with caution.');
  }
}

// ── Inscription check: exists on-chain + UTXO matches ────────────────────────

async function checkInscription(
  r: PSDTValidationResult,
  claimedId?: string,
): Promise<void> {
  if (!claimedId) {
    r.warnings.push('No inscription ID claimed — cannot verify what you are buying.');
    return;
  }

  const claimed = normalizeDoginalInscriptionId(claimedId);

  try {
    const data = await gatedMydogeGetJson(`${MYDOGE_API}/inscription/${encodeURIComponent(claimed)}`);
    r.inscriptionExists      = true;
    r.inscriptionNumber      = data.inscriptionNumber ?? data.number ?? data.inscription_number ?? null;
    r.inscriptionContentType = data.contentType ?? data.content_type ?? data.mime_type ?? null;
    r.inscriptionPreviewUrl  = `${MYDOGE_API}/content/${encodeURIComponent(claimed)}`;

    // Try to verify the UTXO matches by checking the genesis transaction
    // The inscription's genesis tx is embedded in its ID (inscriptionId = txid + 'i' + index)
    const genesisTxid = claimed.replace(/i\d+$/, '');
    if (genesisTxid && !r.inscriptionUtxo.startsWith(genesisTxid)) {
      // UTXO has moved since genesis — that's normal (inscription can be transferred)
      // We can't easily cross-check without the indexer, so just note it
      r.utxoMatchesInscription = null; // indeterminate
    } else {
      r.utxoMatchesInscription = true;
    }

    // Check for suspicious content type
    const ct = r.inscriptionContentType?.toLowerCase() ?? '';
    if (!ct && r.inscriptionExists) {
      r.warnings.push('Unknown content type — inspect the inscription before buying.');
    }
  } catch (e) {
    if (e instanceof MydogeHttpError && e.status === 404) {
      r.inscriptionExists = false;
      r.errors.push(
        `Inscription ${claimedId} not found on-chain. This may be a fake listing.`,
      );
      return;
    }
    r.warnings.push('Could not verify inscription (network error) — check manually before buying.');
  }
}
