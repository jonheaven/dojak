/**
 * QuantumDemoPage.tsx
 *
 * Full demo page for Dogecoin Post-Quantum commitment transactions.
 *
 * =========================================================================
 * WHAT THIS PAGE DEMONSTRATES
 * =========================================================================
 *
 * This page shows the complete Phase 1 quantum-proofing protocol for
 * Dogecoin, as pioneered by the Dogecoin Foundation (Ed Tubbs, Michi Lumin,
 * Timothy Stebbing) and merged into libdogecoin 0.1.5-dev in April 2026.
 *
 * DOJAKWEB IS ONE OF THE FIRST WALLET TOOLKITS IN THE WORLD TO SUPPORT
 * THIS PROTOCOL NATIVELY IN THE BROWSER.
 *
 * The demo lets you:
 *   1. Send DOGE with a Falcon-512 or ML-DSA-44 commitment attached.
 *   2. Download a cryptographic proof JSON for off-chain verification.
 *   3. Optionally broadcast a TX_R "reveal" transaction that spends the
 *      carrier output and anchors the reveal on-chain.
 *   4. Verify any commitment hex off-chain using your saved proof file.
 *
 * =========================================================================
 * READING THIS FILE — INTEGRATION GUIDE FOR AGENTS AND DEVELOPERS
 * =========================================================================
 *
 * The complete quantum protocol is documented in src/lib/quantum.ts.
 * This file shows how to USE that library from a React wallet UI.
 *
 * Key integration points:
 *
 *  • QuantumToggle (src/components/QuantumToggle.tsx):
 *    Lazy-loads the PQC module when the user enables quantum mode.
 *    Preloads Falcon-512 or ML-DSA-44 in the background.
 *
 *  • broadcastQuantumCommitmentTx (src/lib/dogetag/broadcastQuantumTx.ts):
 *    Complete TX_C flow — fetches UTXOs, computes sighash, generates PQC
 *    commitment, appends OP_RETURN, signs ECDSA, broadcasts.
 *
 *  • broadcastQuantumRevealTx (same file):
 *    TX_R flow — spends carrier, returns DOGE, anchors reveal on-chain.
 *
 *  • exportProofAsJson / verifyQuantumCommitment (src/lib/quantum.ts):
 *    Proof serialization and off-chain verification.
 *
 * Outside the Dojak monorepo (third-party wallets / indexers):
 *   Follow the public **dogenals/spec** corpus plus Foundation / BIP PQC drafts.
 *   Use **@noble/post-quantum** (or another audited PQC stack) in **your** codebase.
 *   Implement broadcast, parse, and verify against the on-chain format yourself.
 *   **@dojak/web** is proprietary and not published for external `npm install`.
 */

import React, { useEffect, useState } from 'react';
import {
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentMagnifyingGlassIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { toast } from 'sonner';
import { QuantumToggle } from './QuantumToggle';
import {
  broadcastQuantumCommitmentTx,
  broadcastQuantumRevealTx,
  type BroadcastQuantumParams,
  type QuantumTxResult,
  type QuantumRevealResult,
} from '../lib/dogetag/broadcastQuantumTx';
import {
  verifyQuantumCommitment,
  importProofFromJson,
  type PQCAlgorithm,
  type QuantumProofExport,
  PQC_ALGORITHM_INFO,
} from '../lib/quantum';
import { pollTxForConfirmation } from '../lib/broadcast/dogecoinTxBroadcast';
import { dogeTxExplorerUrl } from '../utils/dogeTxExplorer';

// ─── Explorer helpers ─────────────────────────────────────────────────────────

function explorerUrl(txid: string): string {
  return dogeTxExplorerUrl(txid);
}

function shortTxid(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-8)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
      <CheckCircleIcon className="w-3 h-3" /> Valid
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-400 border border-red-700/40">
      <ExclamationTriangleIcon className="w-3 h-3" /> Invalid
    </span>
  );
}

function HexDisplay({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className={`bg-black/50 rounded-lg px-3 py-2 text-xs break-all ${mono ? 'font-mono text-emerald-300' : 'text-zinc-300'}`}>
        {value}
      </div>
    </div>
  );
}

// ─── Proof verifier sub-panel ─────────────────────────────────────────────────

function ProofVerifier() {
  const [proofJson, setProofJson]   = useState('');
  const [result, setResult]         = useState<{ valid: boolean; reason?: string } | null>(null);
  const [verifying, setVerifying]   = useState(false);

  const verify = async () => {
    setVerifying(true);
    setResult(null);
    try {
      const parsed = JSON.parse(proofJson) as QuantumProofExport;
      const commitment = importProofFromJson(parsed);
      const res = await verifyQuantumCommitment({
        algorithm:  commitment.algorithm,
        publicKey:  commitment.fullPubkey,
        signature:  commitment.fullSignature,
        sighash32:  commitment.sighash32,
        commitment: commitment.commitment,
      });
      setResult(res);
    } catch (err) {
      setResult({ valid: false, reason: err instanceof Error ? err.message : 'Invalid proof JSON' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={proofJson}
        onChange={e => setProofJson(e.target.value)}
        placeholder='Paste your proof JSON here (from "Download Proof" button)…'
        rows={6}
        className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 font-mono text-xs text-zinc-300 resize-none"
      />
      <button
        type="button"
        onClick={() => void verify()}
        disabled={!proofJson.trim() || verifying}
        className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl text-sm font-medium transition-colors"
      >
        {verifying ? 'Verifying…' : 'Verify Proof'}
      </button>
      {result && (
        <div className={`rounded-xl p-4 border ${result.valid ? 'border-emerald-700/40 bg-emerald-950/20' : 'border-red-700/40 bg-red-950/20'}`}>
          <div className="flex items-center gap-2">
            <StatusBadge ok={result.valid} />
            <span className={`text-sm ${result.valid ? 'text-emerald-300' : 'text-red-300'}`}>
              {result.valid ? 'Quantum proof is cryptographically valid.' : result.reason}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TX result panel ──────────────────────────────────────────────────────────

function TxResultPanel({
  result,
  onReveal,
  isRevealing,
  revealResult,
  commitConfirmations,
  revealConfirmations,
  proofVerified,
  onDownloadProof,
  onCopyAllDetails,
}: {
  result: QuantumTxResult;
  onReveal: () => void;
  isRevealing: boolean;
  revealResult: QuantumRevealResult | null;
  commitConfirmations: number;
  revealConfirmations: number;
  proofVerified: boolean | null;
  onDownloadProof: () => void;
  onCopyAllDetails: () => void;
}) {
  const algoInfo = PQC_ALGORITHM_INFO[result.commitment.algorithm];
  const proof = result.proof;

  return (
    <div className="space-y-4">
      {/* Success header */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-700/30">
        <CheckCircleIcon className="w-8 h-8 text-emerald-400 flex-shrink-0" />
        <div>
          <div className="font-semibold text-emerald-300">Quantum-Protected Transaction Broadcast</div>
          <div className="text-sm text-emerald-400/70 mt-0.5">
            {algoInfo.label} commitment is now permanently on the Dogecoin blockchain.
          </div>
        </div>
      </div>

      {/* TX_C details */}
      <div className="space-y-3 bg-zinc-950 rounded-2xl p-4 border border-zinc-800">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">TX_C — Commitment Transaction</div>
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-300">
          {commitConfirmations >= 6 ? `Confirmed (${commitConfirmations}/6)` : `Confirmingâ€¦ ${commitConfirmations}/6`}
        </div>
        <HexDisplay label="Txid" value={result.txid} />
        <a
          href={explorerUrl(result.txid)}
          target="_blank"
          rel="noreferrer"
          className="block text-center py-2 text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
        >
          View on Explorer ↗
        </a>
        <HexDisplay label={`OP_RETURN Commitment (${algoInfo.label}, tag: ${proof.tag})`} value={proof.commitment} />
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center">
            <div className="text-xs text-zinc-600">Fee</div>
            <div className="text-sm font-mono text-zinc-300">{(result.feeSatoshis / 1e8).toFixed(4)} DOGE</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-600">Inputs</div>
            <div className="text-sm font-mono text-zinc-300">{result.inputCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-600">Change</div>
            <div className="text-sm font-mono text-zinc-300">{(result.changeSatoshis / 1e8).toFixed(4)} DOGE</div>
          </div>
        </div>
      </div>

      {/* Proof download */}
      <button
        type="button"
        onClick={onDownloadProof}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
      >
        <ArrowDownTrayIcon className="w-4 h-4" />
        Download Proof JSON
      </button>
      <button
        type="button"
        onClick={onCopyAllDetails}
        className="w-full py-3 rounded-xl border border-zinc-700 text-sm font-medium transition-colors hover:bg-zinc-900"
      >
        Copy All Details
      </button>
      <p className="text-xs text-zinc-600 text-center">
        Save this file — it contains the public proof material needed for off-chain verification and to link any optional TX_R reference back to TX_C.
      </p>

      {proofVerified !== null && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${proofVerified ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-300' : 'border-red-700/40 bg-red-950/20 text-red-300'}`}>
          {proofVerified
            ? 'Downloaded proof verified successfully in the background.'
            : 'Downloaded proof failed verification. Regenerate the proof before relying on it.'}
        </div>
      )}

      {/* TX_R reveal section */}
      {result.carrierVout !== undefined && !revealResult && (
        <div className="rounded-2xl border border-zinc-800 p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">TX_R — Reveal Transaction (Optional)</div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            A 1 DOGE carrier was included in TX_C. Broadcasting TX_R spends this carrier, returns ~0.999 DOGE minus fee to you, and anchors a
            compact reference back to TX_C on-chain. In this Phase 1 implementation the full Falcon or ML-DSA proof stays in the downloaded JSON,
            because the full proof does not fit within Dogecoin&apos;s standard OP_RETURN relay limits.
          </p>
          <button
            type="button"
            onClick={onReveal}
            disabled={isRevealing}
            className="w-full py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-sm font-medium transition-colors"
          >
            {isRevealing ? 'Broadcasting TX_R…' : 'Broadcast Reveal Transaction (TX_R)'}
          </button>
        </div>
      )}

      {/* TX_R result */}
      {revealResult && (
        <div className="space-y-3 bg-zinc-950 rounded-2xl p-4 border border-emerald-800/40">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">TX_R — Broadcast</div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-300">
            {revealConfirmations >= 6 ? `Confirmed (${revealConfirmations}/6)` : `Confirmingâ€¦ ${revealConfirmations}/6`}
          </div>
          <HexDisplay label="Reveal Txid" value={revealResult.txid} />
          <a
            href={explorerUrl(revealResult.txid)}
            target="_blank"
            rel="noreferrer"
            className="block text-center py-2 text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            View TX_R on Explorer ↗
          </a>
          <p className="text-xs text-zinc-500">
            {(revealResult.returnedSatoshis / 1e8).toFixed(4)} DOGE returned to your address. TX_R now anchors a reference to TX_C on-chain.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const QuantumDemoPage: React.FC = () => {
  const { connected, address, walletType } = useUnifiedWallet();
  const browser  = useBrowserWallet();

  const [toAddress,      setToAddress]      = useState('');
  const [amountDoge,     setAmountDoge]      = useState('5');
  const [quantumEnabled, setQuantumEnabled]  = useState(false);
  const [algorithm,      setAlgorithm]       = useState<PQCAlgorithm>('falcon512');
  const [includeCarrier, setIncludeCarrier]  = useState(true);

  const [sending,        setSending]         = useState(false);
  const [sendStatus,     setSendStatus]      = useState<string | null>(null);
  const [error,          setError]           = useState<string | null>(null);
  const [txResult,       setTxResult]        = useState<QuantumTxResult | null>(null);
  const [isRevealing,    setIsRevealing]     = useState(false);
  const [revealResult,   setRevealResult]    = useState<QuantumRevealResult | null>(null);
  const [txcConfirmations, setTxcConfirmations] = useState(0);
  const [txrConfirmations, setTxrConfirmations] = useState(0);
  const [proofVerified,  setProofVerified]   = useState<boolean | null>(null);

  const [showDocs,       setShowDocs]        = useState(false);
  const [showVerifier,   setShowVerifier]    = useState(true);

  const isBrowserWallet = walletType === 'browser' && !!browser.wallet?.privateKey;

  useEffect(() => {
    if (address && !toAddress.trim()) {
      setToAddress(address);
    }
  }, [address, toAddress]);

  useEffect(() => {
    if (!txResult?.txid) return;
    const controller = new AbortController();
    setTxcConfirmations(0);
    void pollTxForConfirmation(txResult.txid, setTxcConfirmations, {
      signal: controller.signal,
      targetConfirmations: 6,
      intervalMs: 20_000,
    }).catch(() => {});
    return () => controller.abort();
  }, [txResult?.txid]);

  useEffect(() => {
    if (!revealResult?.txid) return;
    const controller = new AbortController();
    setTxrConfirmations(0);
    void pollTxForConfirmation(revealResult.txid, setTxrConfirmations, {
      signal: controller.signal,
      targetConfirmations: 6,
      intervalMs: 20_000,
    }).catch(() => {});
    return () => controller.abort();
  }, [revealResult?.txid]);

  const handleSend = async () => {
    if (!connected || !address) { toast.error('Connect your wallet first.'); return; }
    if (!isBrowserWallet) {
      toast.error('Quantum transactions require the Dojakweb browser wallet (needs direct key access). Connect or unlock your local wallet.');
      return;
    }
    const amountSatoshis = Math.round(parseFloat(amountDoge || '0') * 1e8);
    if (!toAddress.trim()) { toast.error('Enter a recipient address.'); return; }
    if (!Number.isFinite(amountSatoshis) || amountSatoshis < 100_000) {
      toast.error('Amount must be at least 0.001 DOGE.');
      return;
    }

    setSending(true);
    setSendStatus('Preparing quantum send…');
    setError(null);
    setTxResult(null);
    setRevealResult(null);
    setTxcConfirmations(0);
    setTxrConfirmations(0);
    setProofVerified(null);

    try {
      const params: BroadcastQuantumParams = {
        toAddress:       toAddress.trim(),
        amountSatoshis,
        fromAddress:     address,
        privateKeyWIF:   browser.wallet!.privateKey,
        algorithm:       quantumEnabled ? algorithm : 'falcon512',
        includeCarrier:  quantumEnabled && includeCarrier,
        feeRate:         1000,
      };

      if (quantumEnabled) {
        setSendStatus('Generating commitment and broadcasting TX_C…');
        const result = await broadcastQuantumCommitmentTx(params);
        setTxResult(result);
        setShowVerifier(true);
        toast.success(`TX_C broadcast! Commitment: ${result.proof.commitment.slice(0, 16)}…`);
      } else {
        // Normal send — still use the quantum flow but without adding the OP_RETURN
        // (redirect user to standard Send flow in practice; this is demo-only)
        toast.info('Enable Quantum-Proof Mode to broadcast a quantum commitment transaction.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Broadcast failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
      setSendStatus(null);
    }
  };

  const handleReveal = async () => {
    if (!txResult || txResult.carrierVout === undefined) return;
    if (!isBrowserWallet) return;

    setIsRevealing(true);
    try {
      const reveal = await broadcastQuantumRevealTx({
        txcTxid:       txResult.txid,
        carrierVout:   txResult.carrierVout,
        commitment:    txResult.commitment,
        fromAddress:   address!,
        privateKeyWIF: browser.wallet!.privateKey,
        existingProof: txResult.proof,
      });
      setRevealResult(reveal);
      toast.success(`TX_R broadcast! Txid: ${shortTxid(reveal.txid)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'TX_R failed.');
    } finally {
      setIsRevealing(false);
    }
  };

  const handleDownloadProof = async () => {
    if (!txResult) return;
    const json = JSON.stringify(txResult.proof, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quantum-proof-${txResult.txid.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    try {
      const commitment = importProofFromJson(txResult.proof);
      const verification = await verifyQuantumCommitment({
        algorithm: commitment.algorithm,
        publicKey: commitment.fullPubkey,
        signature: commitment.fullSignature,
        sighash32: commitment.sighash32,
        commitment: commitment.commitment,
      });
      setProofVerified(verification.valid);
      if (verification.valid) {
        toast.success('Proof downloaded and verified.');
      } else {
        toast.error(verification.reason ?? 'Proof verification failed.');
      }
    } catch (err) {
      setProofVerified(false);
      toast.error(err instanceof Error ? err.message : 'Proof verification failed.');
    }
  };

  const handleCopyAllDetails = async () => {
    if (!txResult) return;
    const details = [
      `Algorithm: ${txResult.commitment.algorithm}`,
      `TX_C: ${txResult.txid}`,
      `TX_C confirmations: ${txcConfirmations}/6`,
      `Commitment: ${txResult.proof.commitment}`,
      revealResult ? `TX_R: ${revealResult.txid}` : 'TX_R: not broadcast',
      revealResult ? `TX_R confirmations: ${txrConfirmations}/6` : null,
      `Proof tag: ${txResult.proof.tag}`,
      `Proof createdAt: ${txResult.proof.createdAt}`,
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(details);
    toast.success('Quantum transaction details copied.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-8 text-text-primary dark:text-inherit">

      {/* ── Header ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-900/30 border border-emerald-700/30">
            <ShieldCheckIcon className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary dark:text-white">Quantum-Proof DOGE</h1>
            <p className="mt-0.5 text-sm text-text-secondary dark:text-zinc-400">
              Falcon-512 / ML-DSA-44 commitments on Dogecoin Layer 1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-900/30 text-emerald-400 border border-emerald-700/30">
            <CpuChipIcon className="w-3.5 h-3.5" />
            Phase 1 — OP_RETURN Commitment
          </span>
          <span className="text-xs text-text-tertiary dark:text-zinc-600">
            Compatible with libdogecoin 0.1.5-dev BIP draft
          </span>
        </div>
      </div>

      {/* ── Connect prompt ── */}
      {!connected && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <ShieldCheckIcon className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Connect your Dojakweb browser wallet to send quantum-proof transactions.</p>
        </div>
      )}

      {connected && !isBrowserWallet && (
        <div className="rounded-2xl border border-amber-700/30 bg-amber-950/20 p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">
            Quantum mode requires the <strong>Dojakweb browser wallet</strong> (needs direct private key access for PQC signing). Unlock your local wallet or switch to it.
          </p>
        </div>
      )}

      {/* ── Quantum toggle ── */}
      {connected && (
        <QuantumToggle
          enabled={quantumEnabled}
          algorithm={algorithm}
          onChange={setQuantumEnabled}
          onAlgorithmChange={setAlgorithm}
          showAlgorithmSelector={quantumEnabled}
        />
      )}

      {/* ── Send form ── */}
      {connected && isBrowserWallet && !txResult && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-5">
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Recipient Address</label>
            <input
              type="text"
              value={toAddress}
              onChange={e => setToAddress(e.target.value)}
              placeholder="DQwVJPL64zuQFXmGfzHTdbXFkFTkrXgPGF"
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 font-mono text-sm text-zinc-200 placeholder-zinc-700"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Amount (DOGE)</label>
            <input
              type="number"
              value={amountDoge}
              onChange={e => setAmountDoge(e.target.value)}
              min="0.001"
              step="1"
              placeholder="0.000"
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-2xl font-semibold text-white"
            />
          </div>

          {quantumEnabled && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeCarrier}
                onChange={e => setIncludeCarrier(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <div>
                <span className="text-sm text-zinc-300 group-hover:text-zinc-200">Include 1 DOGE carrier (enables TX_R reveal)</span>
                <div className="text-xs text-zinc-600">Returned to you minus fee when you broadcast the optional reveal.</div>
              </div>
            </label>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-700/30">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !quantumEnabled}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all ${
              quantumEnabled && !sending
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {sending
              ? 'Generating commitment & broadcasting…'
              : !quantumEnabled
                ? 'Enable Quantum-Proof Mode to send'
                : `Send with ${algorithm === 'falcon512' ? 'Falcon-512' : 'ML-DSA-44'} Commitment`}
          </button>

          {!quantumEnabled && (
            <p className="text-xs text-zinc-600 text-center">
              Toggle Quantum-Proof Mode above to attach a PQC commitment to your transaction.
            </p>
          )}
        </div>
      )}

      {/* ── TX result ── */}
      {txResult && (
        <TxResultPanel
          result={txResult}
          onReveal={() => void handleReveal()}
          isRevealing={isRevealing}
          revealResult={revealResult}
          commitConfirmations={txcConfirmations}
          revealConfirmations={txrConfirmations}
          proofVerified={proofVerified}
          onDownloadProof={() => void handleDownloadProof()}
          onCopyAllDetails={() => void handleCopyAllDetails()}
        />
      )}

      {txResult && (
        <button
          type="button"
          onClick={() => { setTxResult(null); setRevealResult(null); setError(null); setProofVerified(null); }}
          className="w-full rounded-xl border border-border-primary py-3 text-sm text-text-secondary transition-colors hover:bg-bg-secondary dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Send Another Transaction
        </button>
      )}

      {/* ── Proof verifier ── */}
      <div className="overflow-hidden rounded-2xl border border-emerald-700/30 bg-emerald-50/80 dark:bg-emerald-950/10">
        <button
          type="button"
          onClick={() => setShowVerifier(v => !v)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-bg-secondary dark:hover:bg-zinc-900"
        >
          <DocumentMagnifyingGlassIcon className="h-5 w-5 shrink-0 text-text-tertiary dark:text-zinc-400" />
          <div className="flex-1">
            <div className="font-medium text-text-primary dark:text-zinc-200">Verify a Proof</div>
            <div className="text-xs text-text-secondary dark:text-zinc-500">Paste a proof JSON to verify the PQC signature off-chain</div>
          </div>
          {showVerifier ? <ChevronUpIcon className="h-4 w-4 text-text-tertiary dark:text-zinc-500" /> : <ChevronDownIcon className="h-4 w-4 text-text-tertiary dark:text-zinc-500" />}
        </button>
        {showVerifier && (
          <div className="border-t border-border-primary px-5 pb-5 pt-2 dark:border-zinc-800">
            <ProofVerifier />
          </div>
        )}
      </div>

      {/* ── Important Reality Check ── */}
      <div className="rounded-2xl border border-amber-700/30 bg-amber-950/20 p-6">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-amber-300 mb-3">Important Reality Check</h2>
            <div className="text-sm text-amber-200 leading-relaxed space-y-2">
              <p>This feature is still experimental. Here's the honest situation right now:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>We are attaching a small 'fingerprint' (quantum commitment) to normal Dogecoin transactions.</li>
                <li>This fingerprint proves that a post-quantum signature was also created for the transaction.</li>
                <li>However, the actual authorization to spend DOGE is still done using normal ECDSA signatures (the same as every other Dogecoin transaction).</li>
                <li>Right now, these commitments are mostly <strong>cryptographic evidence and historical data</strong>. They show that someone was thinking about quantum security.</li>
                <li>They will <strong>not</strong> automatically protect old transactions if quantum computers become a threat in the future.</li>
                <li>Real protection will only come if Dogecoin eventually upgrades its protocol (a soft fork) to natively support post-quantum signatures.</li>
              </ul>
              <p className="mt-3">
                Think of it like this: We're putting a modern security system into an old house. The house can't fully use the new system yet, so we're leaving clear evidence that we were prepared for the future. It may help during a future migration, but it is not a complete solution by itself.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full technical documentation ── */}
      <div className="overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary dark:border-zinc-800 dark:bg-transparent">
        <button
          type="button"
          onClick={() => setShowDocs(v => !v)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-bg-tertiary dark:hover:bg-zinc-900"
        >
          <InformationCircleIcon className="h-5 w-5 shrink-0 text-text-tertiary dark:text-zinc-400" />
          <div className="flex-1">
            <div className="font-medium text-text-primary dark:text-zinc-200">Full Protocol Documentation</div>
            <div className="text-xs text-text-secondary dark:text-zinc-500">For developers, agents, and projects integrating quantum support. Canonical implementation guide: docs/quantum-integration-guide.md</div>
          </div>
          {showDocs ? <ChevronUpIcon className="h-4 w-4 text-text-tertiary dark:text-zinc-500" /> : <ChevronDownIcon className="h-4 w-4 text-text-tertiary dark:text-zinc-500" />}
        </button>

        {showDocs && (
          <div className="space-y-8 border-t border-border-primary px-5 pb-8 pt-2 text-sm leading-7 text-text-secondary dark:border-zinc-800 dark:text-zinc-300">

            {/* ── 1: Why ── */}
            <section>
              <p className="mb-3 text-xs text-text-tertiary dark:text-zinc-500">
                Canonical repo guide: <code className="font-mono">docs/quantum-integration-guide.md</code>. This page is the UI-facing overview; the library modules remain the source of truth.
              </p>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">Why Quantum-Proof Dogecoin?</h2>
              <p>
                Dogecoin transactions are authorized by <strong>ECDSA over secp256k1</strong>, the same elliptic-curve
                signature scheme used by Bitcoin. ECDSA is computationally secure against classical computers but is
                broken in polynomial time by <strong>Shor's algorithm</strong> running on a sufficiently large
                quantum computer.
              </p>
              <p className="mt-3">
                While no quantum computer of sufficient scale exists today (April 2026), the timeline is shortening
                rapidly. Google's <em>Willow</em> processor (December 2024) demonstrated sub-threshold error rates at
                105 qubits. NIST finalized its first post-quantum cryptography standards in 2024 (FIPS 203–206). The
                cryptographic community broadly estimates a 10–20 year window before ECDSA is practically threatened.
              </p>
              <p className="mt-3">
                Additionally, the <strong>"harvest now, decrypt later"</strong> threat is immediate: adversaries can
                record signed Dogecoin transactions today and attempt to extract private keys once quantum hardware
                matures. Attaching a quantum-safe signature commitment to the blockchain now provides cryptographic
                forward security before the threat materializes.
              </p>
              <p className="mt-3">
                The Dogecoin Foundation's approach is uniquely elegant: it adds quantum resistance{' '}
                <strong>without any protocol change, soft fork, or consensus modification</strong>. Phase 1 is fully
                backward-compatible and deployable today.
              </p>
            </section>

            {/* ── 2: Algorithms ── */}
            <section>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">PQC Algorithms Supported</h2>
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-700 p-4 bg-black/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-emerald-400 font-bold">FLC1</span>
                    <span className="font-semibold text-text-primary dark:text-white">Falcon-512</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-700/30">Primary</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    NIST FIPS 206. Lattice-based NTRU signature scheme. Compact signatures (~654 bytes variable-length,
                    897-byte public key). Used in the Dogecoin Foundation's April 2026 mainnet experiments. The primary
                    algorithm in the BIP draft. On-chain tag: <code className="font-mono text-emerald-300">0x464c4331</code> ("FLC1").
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-700 p-4 bg-black/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-blue-400 font-bold">DIL2</span>
                    <span className="font-semibold text-text-primary dark:text-white">ML-DSA-44 (Dilithium2)</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    NIST FIPS 204. CRYSTALS-Dilithium Level 2. Fixed-size signatures (2420 bytes, 1312-byte public key).
                    Formally standardized and widely adopted. Also supported in the Dogecoin BIP.
                    On-chain tag: <code className="font-mono text-blue-300">0x44494c32</code> ("DIL2").
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Both algorithms are implemented via{' '}
                <code className="font-mono text-zinc-400">@noble/post-quantum</code> by Paul Miller — a pure TypeScript,
                audited, browser-native implementation with zero native dependencies or WebAssembly.
              </p>
            </section>

            {/* ── 3: Protocol ── */}
            <section>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">The TX_C + TX_R Protocol</h2>

              <h3 className="text-base font-semibold text-text-primary dark:text-zinc-200 mb-2">TX_C — Commitment Transaction</h3>
              <ol className="list-decimal pl-5 space-y-2 text-xs text-zinc-400">
                <li>Build a standard Dogecoin P2PKH transaction: inputs covering payment + fee + optional 1 DOGE carrier.</li>
                <li>Compute <strong>sighash32</strong> = <code className="font-mono text-zinc-300">hashForSignature(input 0, p2pkh_script, SIGHASH_ALL)</code> using the pre-commitment template (no OP_RETURN yet). This avoids a circular dependency.</li>
                <li>Generate a fresh PQC keypair (Falcon-512 or ML-DSA-44).</li>
                <li>Sign sighash32 with the PQC secret key → <code className="font-mono text-zinc-300">(publicKey, signature)</code>.</li>
                <li>Compute <strong>commitment32</strong> = <code className="font-mono text-zinc-300">SHA-256(publicKey_bytes || signature_bytes)</code>. This 32-byte hash is the on-chain fingerprint.</li>
                <li>Append OP_RETURN output to the tx: <code className="font-mono text-emerald-300">6a 24 [4-byte tag] [32-byte commitment]</code>. Zero value. 38 bytes total.</li>
                <li>Optionally append a 1 DOGE carrier P2PKH output (same address, for TX_R).</li>
                <li>Sign the full tx with ECDSA (covers OP_RETURN + all outputs). Broadcast.</li>
              </ol>

              <h3 className="text-base font-semibold text-text-primary dark:text-zinc-200 mt-5 mb-2">TX_R — Reveal Transaction (Optional)</h3>
              <ol className="list-decimal pl-5 space-y-2 text-xs text-zinc-400">
                <li>Spend the 1 DOGE carrier output from TX_C as an input.</li>
                <li>Add a P2PKH output returning ~0.999 DOGE (minus fee) to the sender.</li>
                <li>Append a reveal-reference OP_RETURN: <code className="font-mono text-zinc-300">tag + raw TX_C txid bytes</code>. This anchors the carrier spend to the original commitment.</li>
                <li>Sign + broadcast TX_R.</li>
                <li>Update the proof JSON with <code className="font-mono text-zinc-300">txidReveal</code> for a complete audit trail.</li>
              </ol>

              <div className="mt-4 rounded-xl border border-zinc-700 p-4 bg-black/30">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">On-Chain OP_RETURN Format (TX_C)</div>
                <div className="font-mono text-xs space-y-1">
                  <div><span className="text-zinc-500">byte 0   </span><span className="text-yellow-300">6a</span> <span className="text-zinc-500">— OP_RETURN opcode</span></div>
                  <div><span className="text-zinc-500">byte 1   </span><span className="text-yellow-300">24</span> <span className="text-zinc-500">— push 36 bytes (decimal 36)</span></div>
                  <div><span className="text-zinc-500">bytes 2-5  </span><span className="text-emerald-300">46 4c 43 31</span> <span className="text-zinc-500">— tag "FLC1" (Falcon-512) or <span className="text-blue-300">44 49 4c 32</span> "DIL2" (ML-DSA-44)</span></div>
                  <div><span className="text-zinc-500">bytes 6-37 </span><span className="text-purple-300">[32 bytes]</span> <span className="text-zinc-500">— SHA-256(publicKey || signature)</span></div>
                  <div className="mt-2 text-zinc-600">Total: 38 bytes. Value: 0 koinu. Non-canonical encodings are invalid.</div>
                </div>
              </div>
            </section>

            {/* ── 4: Detection ── */}
            <section>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">Detection for Indexers &amp; Explorers</h2>
              <p>
                To flag quantum-protected transactions in a block scanner, indexer, or explorer, scan every output script and call:
              </p>
              <pre className="mt-3 rounded-xl bg-black/50 border border-zinc-700 p-4 text-xs font-mono text-emerald-300 overflow-x-auto">
{`import { parseQuantumCommitmentScript } from '@dojak/web';

// For each transaction output:
const result = parseQuantumCommitmentScript(outputScript);
if (result) {
  // result.algorithm  → 'falcon512' | 'dilithium2'
  // result.tagLabel   → 'Falcon-512' | 'ML-DSA-44 (Dilithium2)'
  // result.commitment → 32-byte Uint8Array
  // result.commitHex  → 64-char hex string
  console.log(\`PQC commitment detected: \${result.tagLabel}\`);
}`}
              </pre>
              <p className="mt-3 text-xs text-zinc-500">
                Detection patterns:
                Falcon-512 = <code className="font-mono text-emerald-400">6a2446 4c4331</code> + 32 bytes,
                Dilithium2 = <code className="font-mono text-blue-400">6a2444494c32</code> + 32 bytes.
                libdogecoin's SPV layer already implements this detection (see updated spv.c in 0.1.5-dev).
              </p>
            </section>

            {/* ── 5: Verification ── */}
            <section>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">Off-Chain Verification</h2>
              <p>Anyone with a proof JSON can verify it off-chain:</p>
              <pre className="mt-3 rounded-xl bg-black/50 border border-zinc-700 p-4 text-xs font-mono text-emerald-300 overflow-x-auto">
{`import {
  importProofFromJson,
  verifyQuantumCommitment,
} from '@dojak/web';

const commitment = importProofFromJson(proofJson);
const result = await verifyQuantumCommitment({
  algorithm:  commitment.algorithm,
  publicKey:  commitment.fullPubkey,
  signature:  commitment.fullSignature,
  sighash32:  commitment.sighash32,
  commitment: commitment.commitment,
});
// result.valid → true if both the commitment hash and PQC sig check out`}
              </pre>
              <p className="mt-3 text-xs text-zinc-500">
                Verification steps: (1) recompute SHA-256(pubkey || sig) and compare with the on-chain commitment,
                (2) verify the PQC signature over sighash32. Both must pass for <code className="font-mono">result.valid = true</code>.
              </p>
            </section>

            {/* ── 6: Security model ── */}
            <section>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">Security Model &amp; Guarantees</h2>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li><strong className="text-text-primary dark:text-zinc-200">Binding:</strong> SHA-256(pubkey || sig) is collision-resistant. An attacker cannot forge a matching commitment for a different transaction.</li>
                <li><strong className="text-text-primary dark:text-zinc-200">Quantum-resistant:</strong> Both Falcon-512 and ML-DSA-44 are NIST-standardized lattice-based schemes believed to be resistant to Shor's and Grover's algorithms.</li>
                <li><strong className="text-text-primary dark:text-zinc-200">Backward-compatible:</strong> OP_RETURN outputs are provably unspendable and ignored by all legacy nodes. No consensus change required.</li>
                <li><strong className="text-text-primary dark:text-zinc-200">Non-interactive:</strong> The PQC keypair is ephemeral (generated fresh per transaction). No key management overhead for the user.</li>
                <li><strong className="text-text-primary dark:text-zinc-200">Parallel protection:</strong> ECDSA remains the authoritative spend mechanism. The PQC commitment runs in parallel, adding quantum-safe evidence without replacing the existing security model.</li>
                <li><strong className="text-text-primary dark:text-zinc-200">Client-side:</strong> All PQC operations happen in your browser. No data is sent to a server. The Dogecoin spend key never leaves your device.</li>
              </ul>
            </section>

            {/* ── 7: First-party integration ── */}
            <section>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">First-party integration (private modular stack)</h2>
              <p className="mb-3 text-xs text-zinc-400">
                <strong className="text-text-primary dark:text-zinc-200">@dojak/web</strong> is a private workspace package—there is no public{' '}
                <code className="font-mono text-zinc-300">npm install @dojak/web</code>. Our proprietary dApps (monorepo apps, internal demo, other linked hosts)
                reuse it via <code className="font-mono text-zinc-300">pnpm</code> workspace / <code className="font-mono text-zinc-300">file:</code> paths. Third parties
                should read <code className="font-mono text-zinc-300">dogenals/spec</code> and ship their own implementation.
              </p>
              <div className="space-y-3 text-xs text-zinc-400">
                <div className="rounded-xl border border-zinc-700 p-4 bg-black/30">
                  <div className="mb-2 font-semibold text-text-primary dark:text-zinc-200">Step 1 — Dependencies</div>
                  <pre className="font-mono text-emerald-300 text-xs whitespace-pre-wrap">{`# Dojak monorepo + proprietary dApps linked to it:
pnpm add @noble/post-quantum   # if not already hoisted
# @dojak/web resolves via workspace — not from the public npm registry`}</pre>
                </div>
                <div className="rounded-xl border border-zinc-700 p-4 bg-black/30">
                  <div className="mb-2 font-semibold text-text-primary dark:text-zinc-200">Step 2 — Send with quantum commitment</div>
                  <pre className="font-mono text-emerald-300 text-xs overflow-x-auto whitespace-pre">{`import { broadcastQuantumCommitmentTx } from '@dojak/web';

const result = await broadcastQuantumCommitmentTx({
  toAddress:      recipientAddress,
  amountSatoshis: 5_00000000,  // 5 DOGE
  fromAddress:    myAddress,
  privateKeyWIF:  myPrivateKey,
  algorithm:      'falcon512',
  includeCarrier: true,
});
console.log('TX_C txid:', result.txid);
console.log('Commitment:', result.proof.commitment);`}</pre>
                </div>
                <div className="rounded-xl border border-zinc-700 p-4 bg-black/30">
                  <div className="mb-2 font-semibold text-text-primary dark:text-zinc-200">Step 3 — Index quantum transactions</div>
                  <pre className="font-mono text-emerald-300 text-xs overflow-x-auto whitespace-pre">{`import { parseQuantumCommitmentScript } from '@dojak/web';

// In your block scanner:
for (const out of tx.outs) {
  const pqc = parseQuantumCommitmentScript(out.script);
  if (pqc) flagTransactionAsQuantumProtected(tx, pqc);
}`}</pre>
                </div>
              </div>
            </section>

            {/* ── 8: References ── */}
            <section>
              <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">References &amp; Credits</h2>
              <ul className="space-y-1 text-xs text-zinc-500">
                <li>Ed Tubbs (@EdTubbs, Dogecoin Foundation) — April 10 2026 mainnet announcement on X</li>
                <li>Michi Lumin, Timothy Stebbing — Dogecoin Foundation mainnet PQC experiments</li>
                <li>libdogecoin 0.1.5-dev, PR #288 (Falcon/PQC merged by michilumin), PR #294 (carrier/reveal)</li>
                <li>BIP draft: <em>bip-post-quantum-signature-commitments.mediawiki</em> in libdogecoin repo</li>
                <li>NIST FIPS 204 (ML-DSA / Dilithium), FIPS 205 (SLH-DSA), FIPS 206 (Falcon)</li>
                <li>@noble/post-quantum by Paul Miller — pure TypeScript PQC library</li>
                <li>Dojakweb implementation: <em>src/lib/quantum.ts</em> and <em>src/lib/dogetag/broadcastQuantumTx.ts</em></li>
              </ul>
            </section>
          </div>
        )}
      </div>

    </div>
  );
};
