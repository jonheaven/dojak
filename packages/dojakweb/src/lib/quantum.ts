/**
 * quantum.ts — Dogecoin Post-Quantum Commitment Protocol
 *
 * =========================================================================
 * OVERVIEW
 * =========================================================================
 *
 * This module implements the Phase 1 OP_RETURN quantum-resistance scheme
 * pioneered by the Dogecoin Foundation (Ed Tubbs, Michi Lumin, Timothy
 * Stebbing) and merged into libdogecoin 0.1.5-dev (PR #288, April 2026).
 *
 * The core idea: attach a post-quantum cryptographic COMMITMENT to any
 * standard Dogecoin transaction using a tiny 36-byte OP_RETURN output —
 * no consensus change, no soft fork, no changes to ECDSA signing.
 *
 * =========================================================================
 * WHY QUANTUM-PROOFING MATTERS NOW
 * =========================================================================
 *
 * Dogecoin (like Bitcoin) uses ECDSA over secp256k1 for transaction
 * authorization. ECDSA is broken by Shor's algorithm running on a
 * sufficiently large quantum computer.
 *
 * While "cryptographically relevant" quantum computers do not yet exist
 * (as of April 2026), the timeline is shortening:
 *   • Google's Willow chip (Dec 2024): 105 qubits, sub-threshold error
 *   • NIST PQC standards finalized (2024): ML-DSA (FIPS 204), Falcon (FIPS 206)
 *   • Industry consensus: 10–15 year window before ECDSA is threatened
 *
 * The "harvest now, decrypt later" threat is real: adversaries can capture
 * signed transactions TODAY and attempt decryption with future quantum
 * computers. Committing a quantum-safe signature to the blockchain NOW
 * provides forward security before the threat materializes.
 *
 * =========================================================================
 * THE TWO-TRANSACTION PROTOCOL (TX_C + TX_R)
 * =========================================================================
 *
 * ─── TX_C: Commitment Transaction (the main event) ───────────────────────
 *
 *  1. Build a standard Dogecoin P2PKH transaction (inputs + payment + change).
 *     This is the "pre-commitment template."
 *
 *  2. Compute sighash32 = the 32-byte ECDSA sighash of the pre-commitment
 *     transaction (input 0, SIGHASH_ALL, using the sender's P2PKH scriptPubKey).
 *     This is the "message" for PQC signing. Using the pre-commitment sighash
 *     avoids a circular dependency (the OP_RETURN output isn't added yet).
 *
 *  3. Generate a PQC keypair:
 *       • Falcon-512 (NIST FIPS 206) — compact sigs, primary in testnet
 *       • ML-DSA-44 / Dilithium2 (NIST FIPS 204) — lattice-based, also supported
 *
 *  4. Sign sighash32 with the PQC private key → (publicKey, signature).
 *
 *  5. Compute commitment32 = SHA-256(publicKey_bytes || signature_bytes).
 *     This 32-byte hash "binds" the quantum proof to the specific transaction
 *     without revealing the (larger) pubkey/signature on-chain.
 *
 *  6. Append canonical OP_RETURN output to the tx:
 *       0x6a            — OP_RETURN opcode
 *       0x24            — push 36 bytes
 *       <4-byte tag>    — "FLC1" (Falcon-512) or "DIL2" (Dilithium2)
 *       <32-byte hash>  — commitment32
 *     Total: 38 bytes in the output script. Zero-value output.
 *
 *  7. OPTIONAL: Append a 1-DOGE "carrier" output (P2PKH to any address
 *     controlled by the sender). This carrier is needed only for TX_R reveal.
 *
 *  8. Sign the full transaction (including OP_RETURN output) with ECDSA
 *     as usual. Broadcast.
 *
 *  Result: a normal Dogecoin transaction with an extra 38-byte provably
 *  quantum-safe commitment. Legacy nodes see it as an OP_RETURN and ignore
 *  it. PQC-aware nodes/indexers detect and log it.
 *
 * ─── TX_R: Reveal Reference Transaction (optional Phase 1 anchor) ─────────
 *
 *  1. Spend the 1-DOGE carrier output from TX_C.
 *  2. Return ~0.999 DOGE minus fee back to the sender's address.
 *  3. Embed a reference OP_RETURN: tag + raw txid_of_txc bytes.
 *     This on-chain record links the carrier spend back to the original
 *     commitment in TX_C.
 *  4. The full PQC proof (publicKey + signature) is exported as a
 *     downloadable JSON proof file. Anyone can verify off-chain by:
 *       a. Fetching TX_C from the blockchain
 *       b. Parsing the OP_RETURN commitment
 *       c. Recomputing SHA-256(pubkey || sig) → must match commitment32
 *       d. Verifying the PQC signature over sighash32 using the pubkey
 *
 *  Note: the full PQC proof (897 + 654 = 1551 bytes for Falcon-512;
 *  1312 + 2420 = 3732 bytes for Dilithium2) exceeds Dogecoin's standard
 *  80-byte OP_RETURN relay limit. Phase 1 therefore stores the full proof
 *  client-side and off-chain; a future Phase 2 protocol (using OP_SUCCESSx
 *  or extended carriers per PR #294) will enable richer on-chain reveals.
 *
 * =========================================================================
 * ON-CHAIN DETECTION (for indexers / explorers / SPV)
 * =========================================================================
 *
 * To detect quantum-proof transactions, scan outputs for:
 *
 *   Falcon-512:  output script starting with 6a 24 46 4c 43 31  ("FLC1")
 *   Dilithium2:  output script starting with 6a 24 44 49 4c 32  ("DIL2")
 *
 * Use `parseQuantumCommitmentScript()` from this module.
 *
 * =========================================================================
 * SECURITY MODEL (Phase 1)
 * =========================================================================
 *
 *   • ECDSA remains the authoritative spend mechanism — nothing changes.
 *   • The PQC commitment runs in PARALLEL: it does not replace ECDSA.
 *   • The commitment is BINDING: SHA-256(pubkey||sig) is collision-resistant.
 *   • The scheme is BACKWARD-COMPATIBLE: old nodes ignore OP_RETURN data.
 *   • Forward security: even if ECDSA is broken later, the PQC signature
 *     proves the transaction was authorized by the quantum-safe key owner.
 *
 * =========================================================================
 * ALGORITHM SIZES (for fee estimation)
 * =========================================================================
 *
 *   Falcon-512:   pubkey 897 bytes,  signature 654 bytes  (variable)
 *   ML-DSA-44:    pubkey 1312 bytes, signature 2420 bytes (fixed)
 *
 *   On-chain commitment (TX_C OP_RETURN): always 38 bytes total.
 *   Off-chain proof export: pubkey + sig + sighash + metadata (~JSON).
 *
 * =========================================================================
 * REFERENCES
 * =========================================================================
 *
 *   • Ed Tubbs (@EdTubbs) April 10 2026 post on X — mainnet experiments
 *   • libdogecoin 0.1.5-dev, PR #288 (PQC merged), PR #294 (carrier/reveal)
 *   • BIP draft: dogecoinfoundation/libdogecoin
 *       doc/spec/bip-post-quantum-signature-commitments.mediawiki
 *   • NIST FIPS 204 (ML-DSA / Dilithium), FIPS 206 (Falcon)
 *   • @noble/post-quantum by Paul Miller — browser-native PQC implementation
 *
 * =========================================================================
 * IMPLEMENTATION NOTES (public protocol, proprietary shipping)
 * =========================================================================
 *
 *  This module ships inside Dojak’s private monorepo only — not as a public npm package.
 *  Third-party wallets should follow the Dogecoin Foundation / libdogecoin PQC draft and
 *  implement the same steps with `@noble/post-quantum` (or equivalent) in their own codebase.
 *
 *  Step 1  — `npm install @noble/post-quantum` in your project.
 *  Step 2  — Call generateQuantumCommitment(sighash32) before ECDSA sign.
 *  Step 3  — Call buildQuantumCommitmentScript(commitment) for the OP_RETURN bytes.
 *  Step 4  — Sign + broadcast as usual.
 *  Step 5  — (Optional) Export proof JSON for off-chain storage / TX_R.
 *
 *  Indexers: scan outputs with the same parsing rules as parseQuantumCommitmentScript.
 *  Verifiers: recompute commitment + verify PQC per the draft.
 */

// ─── Internal utilities ───────────────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters.');
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Hex string contains non-hex characters.');
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ─── Algorithm type ──────────────────────────────────────────────────────────

/** The two PQC algorithms supported in the Dogecoin BIP draft (Phase 1). */
export type PQCAlgorithm = 'falcon512' | 'dilithium2';

/**
 * Human-readable labels and BIP-defined 4-byte ASCII tags for each algorithm.
 *
 *  Falcon-512  → "FLC1"  (0x46 0x4c 0x43 0x31) — primary in mainnet experiments
 *  Dilithium2  → "DIL2"  (0x44 0x49 0x4c 0x32) — ML-DSA-44, NIST FIPS 204
 */
export const PQC_ALGORITHM_INFO: Record<PQCAlgorithm, {
  label:     string;
  tag:       string;   // 4-char ASCII tag
  tagHex:    string;   // hex representation
  pubkeyLen: number;   // expected pubkey size in bytes
  sigLen:    number;   // typical sig size in bytes (Falcon is variable)
}> = {
  falcon512: {
    label:     'Falcon-512',
    tag:       'FLC1',
    tagHex:    '464c4331',
    pubkeyLen: 897,
    sigLen:    654,
  },
  dilithium2: {
    label:     'ML-DSA-44 (Dilithium2)',
    tag:       'DIL2',
    tagHex:    '44494c32',
    pubkeyLen: 1312,
    sigLen:    2420,
  },
};

export const PQC_TAGS: Record<PQCAlgorithm, string> = {
  falcon512: PQC_ALGORITHM_INFO.falcon512.tag,
  dilithium2: PQC_ALGORITHM_INFO.dilithium2.tag,
};

export const PQC_COMMITMENT_PAYLOAD_BYTES = 36;

// ─── Core types ──────────────────────────────────────────────────────────────

export interface QuantumKeyPair {
  publicKey:  Uint8Array;
  secretKey:  Uint8Array;
  algorithm:  PQCAlgorithm;
}

/**
 * A quantum commitment — everything needed for TX_C and optional TX_R / export.
 *
 * The `commitment` is the only field that goes on-chain (in the OP_RETURN).
 * Everything else is kept client-side for the optional reveal / off-chain proof.
 */
export interface QuantumCommitment {
  algorithm:     PQCAlgorithm;
  /** 4-byte ASCII algorithm tag ("FLC1" or "DIL2"). */
  tag:           Uint8Array;
  /** 32-byte SHA-256(publicKey || signature) — the on-chain fingerprint. */
  commitment:    Uint8Array;
  /** Full PQC public key — NOT broadcast in Phase 1, kept for TX_R / export. */
  fullPubkey:    Uint8Array;
  /** Full PQC signature — NOT broadcast in Phase 1, kept for TX_R / export. */
  fullSignature: Uint8Array;
  /** The 32-byte message that was signed (pre-commitment sighash32). */
  sighash32:     Uint8Array;
}

/** Exportable proof bundle — download this as JSON for off-chain storage and verification. */
export interface QuantumProofExport {
  version:       1;
  algorithm:     PQCAlgorithm;
  tag:           string;   // ASCII tag
  commitment:    string;   // hex
  publicKey:     string;   // hex
  signature:     string;   // hex
  sighash32:     string;   // hex — the tx sighash that was signed
  txidCommit?:   string;   // txid of TX_C (set after broadcast)
  txidReveal?:   string;   // txid of TX_R (set after reveal broadcast)
  createdAt:     string;   // ISO timestamp
}

// ─── Lazy module loading ─────────────────────────────────────────────────────

type MlDsaMod  = typeof import('@noble/post-quantum/ml-dsa.js');
type FalconMod = typeof import('@noble/post-quantum/falcon.js');

let _mlDsa:  MlDsaMod | null  = null;
let _falcon: FalconMod | null = null;
let _mlDsaP:  Promise<MlDsaMod>  | null = null;
let _falconP: Promise<FalconMod> | null = null;

async function loadMlDsa(): Promise<MlDsaMod> {
  if (_mlDsa) return _mlDsa;
  if (!_mlDsaP) _mlDsaP = import('@noble/post-quantum/ml-dsa.js').then(m => { _mlDsa = m; return m; });
  return _mlDsaP;
}

async function loadFalcon(): Promise<FalconMod> {
  if (_falcon) return _falcon;
  if (!_falconP) _falconP = import('@noble/post-quantum/falcon.js').then(m => { _falcon = m; return m; });
  return _falconP;
}

// ─── Commitment generation ────────────────────────────────────────────────────

/**
 * Generate a Falcon-512 PQC commitment over the given 32-byte sighash.
 *
 * Falcon-512 (NIST FIPS 206, lattice-based NTRU) is the primary algorithm
 * used in the Dogecoin Foundation's April 2026 mainnet experiments.
 * It produces compact signatures (~654 bytes variable-length) and is
 * significantly smaller than Dilithium2.
 *
 * Tag on-chain: "FLC1" (0x464c4331).
 */
export async function generateFalconCommitment(sighash32: Uint8Array): Promise<QuantumCommitment> {
  const { falcon512 } = await loadFalcon();

  const kp = falcon512.keygen();
  const signature = falcon512.sign(sighash32, kp.secretKey);

  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  const combined = new Uint8Array(kp.publicKey.length + signature.length);
  combined.set(kp.publicKey, 0);
  combined.set(signature, kp.publicKey.length);
  const commitHash = await crypto.subtle.digest('SHA-256', combined as any);

  return {
    algorithm:     'falcon512',
    tag:           new TextEncoder().encode('FLC1'),
    commitment:    new Uint8Array(commitHash),
    fullPubkey:    kp.publicKey,
    fullSignature: signature,
    sighash32,
  };
}

/**
 * Generate a Dilithium2 / ML-DSA-44 PQC commitment over the given 32-byte sighash.
 *
 * ML-DSA-44 (CRYSTALS-Dilithium Level 2, NIST FIPS 204) is the second PQC
 * algorithm in the Dogecoin BIP draft. It has larger fixed-size signatures
 * (2420 bytes) vs Falcon-512 (~654 bytes), but is simpler to implement and
 * is formally standardized as FIPS 204.
 *
 * Tag on-chain: "DIL2" (0x44494c32).
 */
export async function generateDilithiumCommitment(sighash32: Uint8Array): Promise<QuantumCommitment> {
  const { ml_dsa44 } = await loadMlDsa();

  const kp = ml_dsa44.keygen();
  const signature = ml_dsa44.sign(sighash32, kp.secretKey);

  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  const combined = new Uint8Array(kp.publicKey.length + signature.length);
  combined.set(kp.publicKey, 0);
  combined.set(signature, kp.publicKey.length);
  const commitHash = await crypto.subtle.digest('SHA-256', combined as any);

  return {
    algorithm:     'dilithium2',
    tag:           new TextEncoder().encode('DIL2'),
    commitment:    new Uint8Array(commitHash),
    fullPubkey:    kp.publicKey,
    fullSignature: signature,
    sighash32,
  };
}

/**
 * Generate a PQC commitment for the given algorithm and 32-byte sighash.
 * This is the primary entry point — dispatches to Falcon or Dilithium.
 *
 * @param sighash32  32-byte buffer — the pre-commitment ECDSA sighash (input 0, SIGHASH_ALL).
 *                   Compute this BEFORE appending the OP_RETURN output to avoid a circular dep.
 * @param algorithm  Which PQC algorithm to use (default: 'falcon512').
 */
export async function generateQuantumCommitment(
  sighash32: Uint8Array,
  algorithm: PQCAlgorithm = 'falcon512',
): Promise<QuantumCommitment> {
  if (sighash32.length !== 32) {
    throw new Error(`[quantum] sighash32 must be exactly 32 bytes, got ${sighash32.length}`);
  }
  return algorithm === 'dilithium2'
    ? generateDilithiumCommitment(sighash32)
    : generateFalconCommitment(sighash32);
}

// ─── OP_RETURN script builders ────────────────────────────────────────────────

/**
 * Build the canonical OP_RETURN commitment script for TX_C.
 *
 * Exact encoding (38 bytes):
 *   Byte 0:     0x6a       — OP_RETURN
 *   Byte 1:     0x24       — push 36 bytes (decimal 36)
 *   Bytes 2–5:  <tag>      — "FLC1" or "DIL2" (4 bytes ASCII)
 *   Bytes 6–37: <commit>   — SHA-256(pubkey || signature) (32 bytes)
 *
 * This output is added with value = 0 (provably unspendable).
 * The 38-byte encoding is fixed and canonical; any other encoding is invalid.
 * Non-canonical encodings MUST be rejected by verifiers.
 */
export function buildQuantumCommitmentScript(commitment: QuantumCommitment): Uint8Array {
  if (commitment.commitment.length !== 32) {
    throw new Error('[quantum] Commitment must be exactly 32 bytes');
  }
  if (commitment.tag.length !== 4) {
    throw new Error('[quantum] Tag must be exactly 4 bytes');
  }
  return new Uint8Array([
    0x6a,                          // OP_RETURN
    0x24,                          // push 36 bytes
    ...commitment.tag,             // 4-byte algorithm tag
    ...commitment.commitment,      // 32-byte SHA-256 commitment
  ]);
}

/**
 * Build the TX_R reveal reference OP_RETURN script.
 *
 * This compact 38-byte OP_RETURN goes in the reveal transaction (TX_R) and
 * binds the carrier spend back to the original TX_C commitment. It contains:
 *   • The algorithm tag (to identify the PQC algorithm used)
 *   • The raw TX_C txid bytes — links TX_R to the specific commitment tx
 *
 * The full PQC proof (pubkey + sig) is exported separately as a JSON proof
 * file (see exportProofAsJson). Phase 2 of the BIP will enable full on-chain
 * proof embedding once extended carrier scripts are standardized.
 */
export function buildQuantumRevealReferenceScript(
  tag: Uint8Array,
  txcTxidHex: string,
): Uint8Array {
  if (tag.length !== 4) throw new Error('[quantum] Tag must be exactly 4 bytes');
  // Store the raw txid bytes in little-endian (reversed from hex) as Bitcoin/Dogecoin convention
  const txidBytes = fromHex(txcTxidHex);
  txidBytes.reverse();
  if (txidBytes.length !== 32) throw new Error('[quantum] txid must be 32 bytes');
  return new Uint8Array([0x6a, 0x24, ...tag, ...txidBytes]);
}

export function parseQuantumRevealReferenceScript(script: Uint8Array): {
  algorithm: PQCAlgorithm;
  tag: Uint8Array;
  txidHex: string;
} | null {
  if (script.length !== 38) return null;
  if (script[0] !== 0x6a || script[1] !== 0x24) return null;

  const tag = new Uint8Array(script.slice(2, 6));
  const tagStr = new TextDecoder().decode(tag);
  const txidBytes = new Uint8Array(script.slice(6, 38));
  const txidHex = toHex(Uint8Array.from(Array.from(txidBytes).reverse()));

  if (tagStr === 'FLC1') {
    return { algorithm: 'falcon512', tag, txidHex };
  }
  if (tagStr === 'DIL2') {
    return { algorithm: 'dilithium2', tag, txidHex };
  }
  return null;
}

// ─── Off-chain verification ───────────────────────────────────────────────────

/**
 * Verify a quantum commitment off-chain (e.g., after downloading a proof JSON).
 *
 * Verification steps:
 *   1. Recompute SHA-256(pubkey || sig) and compare with the on-chain commitment.
 *   2. Verify the PQC signature itself over the original sighash32.
 *
 * Both steps must pass for the proof to be valid.
 *
 * This mirrors the full-node verification that Phase 2 will perform on-chain.
 * In Phase 1, it is performed off-chain by anyone who has the proof file.
 */
export async function verifyQuantumCommitment(params: {
  algorithm:  PQCAlgorithm;
  publicKey:  Uint8Array;
  signature:  Uint8Array;
  sighash32:  Uint8Array;
  commitment: Uint8Array;
}): Promise<{ valid: boolean; reason?: string }> {
  const { algorithm, publicKey, signature, sighash32, commitment } = params;

  // Step 1: recompute commitment and compare
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  const combined = new Uint8Array(publicKey.length + signature.length);
  combined.set(publicKey, 0);
  combined.set(signature, publicKey.length);
  const recomputed = new Uint8Array(await crypto.subtle.digest('SHA-256', combined as any));

  if (!bytesEqual(recomputed, commitment)) {
    return {
      valid:  false,
      reason: 'Commitment mismatch: SHA-256(pubkey || sig) does not equal the on-chain commitment. ' +
              'The proof may have been tampered with or belongs to a different transaction.',
    };
  }

  // Step 2: verify PQC signature
  if (algorithm === 'dilithium2') {
    const { ml_dsa44 } = await loadMlDsa();
    const sigValid = ml_dsa44.verify(signature, sighash32, publicKey);
    return sigValid
      ? { valid: true }
      : { valid: false, reason: 'ML-DSA-44 signature verification failed.' };
  }

  if (algorithm === 'falcon512') {
    const { falcon512 } = await loadFalcon();
    const sigValid = falcon512.verify(signature, sighash32, publicKey);
    return sigValid
      ? { valid: true }
      : { valid: false, reason: 'Falcon-512 signature verification failed.' };
  }

  return { valid: false, reason: `Unknown algorithm: ${String(algorithm)}` };
}

// ─── OP_RETURN parser (for indexers / explorers / SPV nodes) ─────────────────

/**
 * Parse a transaction output script and detect a quantum commitment.
 *
 * Use this in block scanners, indexers, or SPV clients to flag quantum-protected
 * transactions. The match is strict — any deviation from canonical encoding
 * (wrong opcode, wrong push length, unknown tag) returns null.
 *
 * Detection patterns:
 *   Falcon-512:  0x6a 0x24 0x46 0x4c 0x43 0x31 <32 bytes>  ("FLC1")
 *   Dilithium2:  0x6a 0x24 0x44 0x49 0x4c 0x32 <32 bytes>  ("DIL2")
 *
 * @param script  Raw output script bytes from the transaction.
 * @returns       Parsed commitment data, or null if not a quantum commitment.
 */
export function parseQuantumCommitmentScript(script: Uint8Array): {
  algorithm:  PQCAlgorithm;
  tag:        Uint8Array;
  tagLabel:   string;
  commitment: Uint8Array;
  commitHex:  string;
} | null {
  if (script.length !== 38) return null;
  if (script[0] !== 0x6a) return null;   // must be OP_RETURN
  if (script[1] !== 0x24) return null;   // must push exactly 36 bytes

  const tag = new Uint8Array(script.slice(2, 6));
  const tagStr = new TextDecoder().decode(tag);
  const commitment = new Uint8Array(script.slice(6, 38));

  if (tagStr === 'FLC1') {
    return {
      algorithm:  'falcon512',
      tag,
      tagLabel:   'Falcon-512',
      commitment,
      commitHex:  toHex(commitment),
    };
  }
  if (tagStr === 'DIL2') {
    return {
      algorithm:  'dilithium2',
      tag,
      tagLabel:   'ML-DSA-44 (Dilithium2)',
      commitment,
      commitHex:  toHex(commitment),
    };
  }

  return null;  // unknown tag — not a recognized quantum commitment
}

// ─── Proof export / import ────────────────────────────────────────────────────

/**
 * Export a quantum commitment as a portable JSON proof.
 *
 * This proof file should be stored securely by the wallet owner.
 * It enables:
 *   • Off-chain verification by third parties
 *   • Future TX_R reveal (once Phase 2 BIP is implemented)
 *   • Audit trail for enterprise/regulated use cases
 *
 * The JSON contains all data needed to re-derive and verify the on-chain
 * commitment from scratch: algorithm, tag, commitment hex, full pubkey hex,
 * full signature hex, and the sighash32 that was signed.
 */
export function exportProofAsJson(
  commitment: QuantumCommitment,
  opts?: { txidCommit?: string; txidReveal?: string },
): QuantumProofExport {
  return {
    version:     1,
    algorithm:   commitment.algorithm,
    tag:         new TextDecoder().decode(commitment.tag),
    commitment:  toHex(commitment.commitment),
    publicKey:   toHex(commitment.fullPubkey),
    signature:   toHex(commitment.fullSignature),
    sighash32:   toHex(commitment.sighash32),
    txidCommit:  opts?.txidCommit,
    txidReveal:  opts?.txidReveal,
    createdAt:   new Date().toISOString(),
  };
}

/**
 * Import a quantum proof from its JSON export.
 * Use this to reload a proof for verification or TX_R construction.
 */
export function importProofFromJson(json: QuantumProofExport): QuantumCommitment {
  if (json.version !== 1) {
    throw new Error(`Unsupported quantum proof version: ${json.version}`);
  }
  if (json.tag.length !== 4) {
    throw new Error(`Quantum proof tag must be 4 ASCII characters, got "${json.tag}"`);
  }
  return {
    algorithm:     json.algorithm,
    tag:           new TextEncoder().encode(json.tag),
    commitment:    fromHex(json.commitment),
    fullPubkey:    fromHex(json.publicKey),
    fullSignature: fromHex(json.signature),
    sighash32:     fromHex(json.sighash32),
  };
}

// ─── Preload helper (UI — call when user enables quantum mode) ────────────────

/**
 * Preload the PQC module(s) so the first actual signing has minimal latency.
 *
 * Call this when the user enables "Quantum Mode" in the UI. The modules are
 * loaded lazily and cached; subsequent calls are no-ops.
 *
 * Loading time on modern hardware: typically 50–200ms per module.
 */
export async function preloadQuantumModules(algorithm: PQCAlgorithm = 'falcon512'): Promise<void> {
  if (algorithm === 'dilithium2') {
    await loadMlDsa();
  } else {
    await loadFalcon();
  }
}

// ─── Fee estimation helpers ───────────────────────────────────────────────────

/**
 * Number of additional bytes added to a transaction when quantum mode is enabled.
 *
 * TX_C OP_RETURN output:  38 bytes (script) + 8 bytes (value) + 1 byte (script_len) = 47 bytes
 * TX_C carrier output:    34 bytes (P2PKH output, only if includeReveal=true)
 *
 * At 1000 koinu/kB (standard fee rate), the OP_RETURN adds ~47 koinu.
 * At 100 koinu/byte (minimum relay), it's ~5 koinu. Both are negligible.
 */
export const QUANTUM_OPRETURN_OUTPUT_BYTES = 47;  // OP_RETURN output overhead
export const QUANTUM_CARRIER_OUTPUT_BYTES  = 34;  // P2PKH carrier output overhead
export const QUANTUM_CARRIER_VALUE_KOINU   = 100_000_000;  // 1 DOGE in koinu
