// DogetagCreator.tsx
// Main UI component for creating Dogecoin on-chain text inscriptions

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PencilSquareIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  RadioIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { validateDogetagMessage } from '../lib/dogetag/encodeDogetag';
import { signInscriptionTxs, SignedInscriptionPair, INSCRIPTION_MAX_CONTENT_BYTES } from '../lib/dogetag/inscribe';
import { getFeeEstimate } from '../utils/txBroadcaster';
import { DogeAmount } from './DogeAmount';
import { DogeCurrencyIcon } from './DogeCurrencyIcon';
import {
  buildOpReturnPSDT,
  broadcastSignedTransaction,
  broadcastTxWithStatus,
  getConfirmationPollIntervalMs,
  pollTxForConfirmation,
  type BroadcastAttemptUpdate,
  type BuiltOpReturnPSDT,
} from '../lib/broadcast/dogecoinTxBroadcast';
import { BroadcastRelayAttempts } from '@/components/chain/BroadcastRelayAttempts';
import { TxConfirmationPollProgress } from '@/components/chain/TxConfirmationPollProgress';
import {
  useDogeTxExplorerPreference,
  dogeTxExplorerUrl,
  dogeTxExplorerDisplayName,
} from '../utils/dogeTxExplorer';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';

/** Public read API — JSON for this id means the inscription is visible to MyDoge-style indexers. */
function myDogeInscriptionApiUrl(inscriptionId: string): string {
  return `https://api.mydoge.com/inscription/${encodeURIComponent(inscriptionId)}`;
}

type MyDogeIndexerCheck = 'idle' | 'checking' | 'found' | 'not_yet' | 'error';

interface DogetagCreatorProps {
  wallet: any; // Compatible with both browser extension and local wallets
  onDogetagCreated?: (txid: string, message: string) => void;
  initialInscriptionMode?: 'op_return' | 'witness';
  /** Fired when the user picks DogeTag:tx vs DogeTag:inscription (tabs or “switch to inscription”); parent can sync URL / sidebar. */
  onInscriptionModeChange?: (mode: 'op_return' | 'witness') => void;
}

type CreationStep =
  | 'compose'
  | 'preview'
  | 'build'
  | 'sign'
  | 'broadcast'              // OP_RETURN path only
  | 'inscription_commit'     // witness: user broadcasts commit tx
  | 'inscription_confirming' // witness: waiting for commit confirmation
  | 'inscription_reveal'     // witness: user broadcasts reveal tx
  | 'success';

export const DogetagCreator: React.FC<DogetagCreatorProps> = ({
  wallet,
  onDogetagCreated,
  initialInscriptionMode = 'op_return',
  onInscriptionModeChange,
}) => {
  const [message, setMessage] = useState('');
  /** koinu per kB — same unit as Dogecoin Core / Inscribe page (not “per byte”). */
  const [feeRate, setFeeRate] = useState(100_000);
  const [currentStep, setCurrentStep] = useState<CreationStep>('compose');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inscriptionMode, setInscriptionMode] = useState<'op_return' | 'witness'>(initialInscriptionMode);
  const [showModeSuggestion, setShowModeSuggestion] = useState(false);
  const [showTooltip, setShowTooltip] = useState<'op_return' | 'witness' | 'bytes' | null>(null);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // Transaction data
  const [builtPsbt, setBuiltPsbt] = useState<BuiltOpReturnPSDT | null>(null);
  const [signedTxHex, setSignedTxHex] = useState<string | null>(null);
  const [finalizedTx, setFinalizedTx] = useState<any>(null);

  // Inscription (Dogetag) state
  const [inscriptionPlan, setInscriptionPlan] = useState<SignedInscriptionPair | null>(null);
  const [broadcastProgress, setBroadcastProgress] = useState<string | null>(null);

  // Step-by-step inscription broadcast state (witness mode)
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [commitAttempts, setCommitAttempts] = useState<BroadcastAttemptUpdate[]>([]);
  const [revealAttempts, setRevealAttempts] = useState<BroadcastAttemptUpdate[]>([]);
  const [commitConfirmations, setCommitConfirmations] = useState<number>(0);
  const [commitPollSchedule, setCommitPollSchedule] = useState<{ until: number; intervalMs: number } | null>(null);
  const [commitPollClock, setCommitPollClock] = useState(0);
  const [pollingController, setPollingController] = useState<AbortController | null>(null);
  const [copiedHex, setCopiedHex] = useState<'commit' | 'reveal' | null>(null);
  // UTXOs to skip on next build (populated when a mempool-conflict is detected)
  const [stickyExcludedOutpoints, setStickyExcludedOutpoints] = useState<string[]>([]);

  const [mydogeIndexerCheck, setMydogeIndexerCheck] = useState<MyDogeIndexerCheck>('idle');
  const [mydogeIndexerDetail, setMydogeIndexerDetail] = useState<string | null>(null);

  // Tip (OP_RETURN only)
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipAddress, setTipAddress] = useState('');
  const [tipAmountDoge, setTipAmountDoge] = useState('');

  const explorerPref = useDogeTxExplorerPreference();
  const explorerLabel = dogeTxExplorerDisplayName(explorerPref);

  const protectedOutpointSet = new Set(
    (Array.isArray(wallet?.protectedOutpoints) ? wallet.protectedOutpoints : [])
      .map((o: string) => o.trim().toLowerCase())
      .filter((o: string) => !!o),
  );

  const selectedUtxoReview = builtPsbt
    ? builtPsbt.selectedUtxos.map((u) => {
        const outpoint = `${u.txid.toLowerCase()}:${u.vout}`;
        return {
          ...u,
          outpoint,
          isProtected: protectedOutpointSet.has(outpoint),
        };
      })
    : [];

  const hasProtectedInputMatch = selectedUtxoReview.some((u) => u.isProtected);
  const dogetagKindLabel = inscriptionMode === 'op_return' ? 'DogeTag:tx' : 'DogeTag:inscription';

  // Auto-update fee rate on component mount and check for first-time tutorial
  useEffect(() => {
    const updateFeeRate = async () => {
      try {
        const estimatedFee = await getFeeEstimate();
        setFeeRate(estimatedFee);
      } catch (error) {
        console.warn('Could not fetch fee estimate, using default');
      }
    };
    updateFeeRate();

    // Check if user has seen the tutorial before
    const hasSeenTutorial = localStorage.getItem('dojakweb-dogetag-tutorial-seen');
    if (!hasSeenTutorial) {
      setShowTutorialModal(true);
    }
  }, []);

  useEffect(() => {
    setInscriptionMode(initialInscriptionMode);
  }, [initialInscriptionMode]);

  // Close tooltips when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-tooltip]')) {
        setShowTooltip(null);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  useEffect(() => {
    if (currentStep !== 'inscription_confirming') {
      setCommitPollSchedule(null);
      return;
    }
    const id = window.setInterval(() => setCommitPollClock((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [currentStep, commitPollSchedule]);

  // Calculate UTF-8 byte length
  const getByteLength = (text: string): number => {
    // Use TextEncoder for browser compatibility instead of Node.js Buffer
    const encoder = new TextEncoder();
    return encoder.encode(text).length;
  };

  // Get limits based on mode
  const getLimits = () => {
    return inscriptionMode === 'op_return'
      ? { maxBytes: 80, label: 'OP_RETURN (80 bytes max)' }
      : { maxBytes: INSCRIPTION_MAX_CONTENT_BYTES, label: `DogeTag:inscription (${INSCRIPTION_MAX_CONTENT_BYTES} bytes max • 2 txs)` };
  };

  const handleMessageChange = (value: string) => {
    const byteLength = getByteLength(value);
    const limits = getLimits();

    // Auto-suggest switching to Witness mode if OP_RETURN limit is exceeded
    if (inscriptionMode === 'op_return' && byteLength > 80) {
      setShowModeSuggestion(true);
    } else {
      setShowModeSuggestion(false);
    }

    // Hard stop input for OP_RETURN mode at 80 bytes
    if (inscriptionMode === 'op_return' && byteLength > 80) {
      // Truncate to fit within limit
      let truncated = value;
      while (getByteLength(truncated) > 80) {
        truncated = truncated.slice(0, -1);
      }
      setMessage(truncated);
      setError('OP_RETURN byte limit reached (80 bytes)');
      return;
    }

    // Hard stop for Dogetag mode at the canonical single-partial ceiling
    if (inscriptionMode === 'witness' && byteLength > limits.maxBytes) {
      setError(`DogeTag:inscription limit reached (${limits.maxBytes} bytes — use DogeTag:tx (OP_RETURN) mode)`);
      return;
    }

    setMessage(value);
    setError(null); // Clear any previous errors
  };

  const switchToWitnessMode = () => {
    setInscriptionMode('witness');
    setShowModeSuggestion(false);
    setError(null);
    onInscriptionModeChange?.('witness');
    toast.info('Switched to DogeTag:inscription mode for longer messages');
  };

  const toggleTooltip = (mode: 'op_return' | 'witness' | 'bytes' | null) => {
    setShowTooltip(showTooltip === mode || mode === null ? null : mode);
  };

  const getPhilosophicalLabel = () => {
    return inscriptionMode === 'op_return'
      ? 'DogeTag:tx stays with the transaction.'
      : 'DogeTag:inscription moves with the coin.';
  };

  const getTooltipContent = (mode: 'op_return' | 'witness') => {
    if (mode === 'op_return') {
      return {
        title: 'DogeTag:tx',
        content: `Short messages stored in an OP_RETURN output.

They stay with the transaction and do not move with coins.

Good for: signatures, timestamps, short announcements, and tiny notes.

Max size: 80 bytes.`
      };
    } else {
      return {
        title: 'DogeTag:inscription',
        content: `Canonical Doginals inscription (P2SH commit-reveal).

This is always 2 transactions: commit first, then reveal.

Good for: longer text, provenance notes, and collectible-style inscriptions.

Max size: ${INSCRIPTION_MAX_CONTENT_BYTES} bytes in this UI (single-partial, indexer-friendly).`
      };
    }
  };

  const validateAndPreview = () => {
    const validation = validateDogetagMessage(message, inscriptionMode);
    if (!validation.valid) {
      setError(validation.error || 'Invalid message');
      return false;
    }

    setCurrentStep('preview');
    return true;
  };

  const validateMessage = () => {
    const validation = validateDogetagMessage(message, inscriptionMode);
    if (!validation.valid) {
      setError(validation.error || 'Invalid message');
      return false;
    }
    return true;
  };

  const buildTransaction = async () => {
    if (!validateMessage()) return;

    setIsLoading(true);
    setError(null);

    try {
      const address = await wallet.getAddress();

      if (inscriptionMode === 'op_return') {
        const tip =
          tipEnabled && tipAddress.trim() && tipAmountDoge.trim()
            ? { address: tipAddress.trim(), satoshis: Math.round(parseFloat(tipAmountDoge) * 1e8) }
            : undefined;

        if (wallet?.walletType === 'browser' && typeof wallet?.signOpReturn === 'function') {
          // Browser wallet: sign + broadcast in one shot — no PSBT or sign-step needed.
          const signedResult = await wallet.signOpReturn({
            message,
            fromAddress: address,
            feeRate,
            tip,
            excludedOutpoints: [
              ...(Array.isArray(wallet?.protectedOutpoints) ? wallet.protectedOutpoints : []),
              ...stickyExcludedOutpoints,
            ],
          });
          const txid = await broadcastSignedTransaction(signedResult.rawHex);
          setFinalizedTx({ txid, rawTxHex: signedResult.rawHex });
          setCurrentStep('success');
          onDogetagCreated?.(txid, message);
          toast.success('DogeTag:tx broadcast successfully!');
          return;
        }

        // Extension wallet: build PSBT so the wallet can sign it.
        const psbt = await buildOpReturnPSDT(
          message,
          address,
          feeRate,
          tip,
          Array.isArray(wallet?.protectedOutpoints) ? wallet.protectedOutpoints : undefined,
        );
        setBuiltPsbt(psbt);
        setInscriptionPlan(null);
        setSignedTxHex(null);
        setCurrentStep('sign');
        toast.success('Transaction ready — review fee and sign below.');
      } else {
        // Dogetag inscription path: canonical Doginals P2SH commit-reveal
        if (wallet?.walletType !== 'browser') {
          throw new Error(
            'Doginal inscriptions require the local Dojakweb browser wallet (needs direct key access). ' +
            'Connect your local wallet or switch to DogeTag:tx (OP_RETURN) mode.',
          );
        }
        if (typeof wallet?.getPrivateKeyWIF !== 'function') {
          throw new Error('Unlock your Dojakweb browser wallet before building an inscription.');
        }
        const privateKeyWIF = await wallet.getPrivateKeyWIF();
        if (!privateKeyWIF) {
          throw new Error('Unlock your Dojakweb browser wallet before building an inscription.');
        }

        const plan = await signInscriptionTxs({
          text: message,
          fromAddress: address,
          privateKeyWIF,
          feeRate,
          excludedOutpoints: [
            ...(Array.isArray(wallet?.protectedOutpoints) ? wallet.protectedOutpoints : []),
            ...stickyExcludedOutpoints,
          ],
        });

        setInscriptionPlan(plan);
        setBuiltPsbt(null);
        setSignedTxHex(null);
        setCommitAttempts([]);
        setRevealAttempts([]);
        setCommitConfirmations(0);
        setCurrentStep('inscription_commit');
        toast.success('DogeTag:inscription signed! Broadcast the commit transaction below.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to build transaction';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  const signTransaction = async () => {
    if (!builtPsbt) return;

    setIsLoading(true);
    setError(null);

    try {
      if (hasProtectedInputMatch) {
        throw new Error('Safety check failed: selected inputs include protected inscription UTXOs. Refresh and rebuild the transaction.');
      }

      const address = await wallet.getAddress();
      const tip =
        tipEnabled && tipAddress.trim() && tipAmountDoge.trim()
          ? { address: tipAddress.trim(), satoshis: Math.round(parseFloat(tipAmountDoge) * 1e8) }
          : undefined;

      let rawTxHex: string;

      if (wallet?.walletType === 'browser' && typeof wallet?.signOpReturn === 'function') {
        const signedResult = await wallet.signOpReturn({
          message,
          fromAddress: address,
          feeRate,
          tip,
          excludedOutpoints: [
            ...(Array.isArray(wallet?.protectedOutpoints) ? wallet.protectedOutpoints : []),
            ...stickyExcludedOutpoints,
          ],
        });
        rawTxHex = signedResult.rawHex;
      } else {
        if (typeof wallet?.signPsbt !== 'function') {
          throw new Error('Your wallet does not support PSBT signing. Please connect MyDoge, SpookyDoge, Dojak, or another extension wallet.');
        }
        const signedPsbt = await wallet.signPsbt(builtPsbt.psbtBase64);

        const bitcoin = await import('bitcoinjs-lib');
        const DOGE_NETWORK = {
          messagePrefix: '\x19Dogecoin Signed Message:\n',
          bech32: 'dc',
          bip32: { public: 0x02facafd, private: 0x02fac398 },
          pubKeyHash: 0x1e,
          scriptHash: 0x16,
          wif: 0x9e,
        };
        rawTxHex = signedPsbt;
        try {
          rawTxHex = bitcoin.Psbt.fromHex(signedPsbt, { network: DOGE_NETWORK }).extractTransaction().toHex();
        } catch {
          try {
            rawTxHex = bitcoin.Psbt.fromBase64(signedPsbt, { network: DOGE_NETWORK }).extractTransaction().toHex();
          } catch {
            // already a raw tx hex
          }
        }
      }

       setSignedTxHex(rawTxHex);
       setCurrentStep('broadcast');
       toast.success('Signed — review the transaction details, then confirm and broadcast.');

      const tryBroadcast = async (hex: string): Promise<string> => broadcastSignedTransaction(hex);
      let txid: string;
      try {
        txid = await tryBroadcast(rawTxHex);
      } catch (broadcastErr) {
        const msg = broadcastErr instanceof Error ? broadcastErr.message : '';
        const isStaleUtxo = msg.includes('bad-txns-inputs-spent') || msg.includes('has already been spent');

        if (isStaleUtxo && wallet?.walletType === 'browser' && typeof wallet?.signOpReturn === 'function') {
          const staleOutpoints: string[] = [];
          try {
            const bitcoin = await import('bitcoinjs-lib');
            const failedTx = bitcoin.Transaction.fromHex(rawTxHex);
            for (const inp of failedTx.ins) {
              const txidHex = Array.from(inp.hash).reverse().map(b => b.toString(16).padStart(2, '0')).join('');
              staleOutpoints.push(`${txidHex}:${inp.index}`);
            }
          } catch { /* ignore parse failure */ }

          const freshExcludes = [
            ...(Array.isArray(wallet?.protectedOutpoints) ? wallet.protectedOutpoints : []),
            ...stickyExcludedOutpoints,
            ...staleOutpoints,
          ];
          if (staleOutpoints.length > 0) {
            setStickyExcludedOutpoints(prev => [...new Set([...prev, ...staleOutpoints])]);
          }

          const retryResult = await wallet.signOpReturn({
            message,
            fromAddress: address,
            feeRate,
            tip,
            excludedOutpoints: freshExcludes,
          });
          txid = await tryBroadcast(retryResult.rawHex);
          rawTxHex = retryResult.rawHex;
          setSignedTxHex(rawTxHex);
        } else if (isStaleUtxo) {
          const staleOutpoints: string[] = [];
          try {
            const bitcoin = await import('bitcoinjs-lib');
            const failedTx = bitcoin.Transaction.fromHex(rawTxHex);
            for (const inp of failedTx.ins) {
              const txidHex = Array.from(inp.hash).reverse().map(b => b.toString(16).padStart(2, '0')).join('');
              staleOutpoints.push(`${txidHex}:${inp.index}`);
            }
          } catch { /* ignore */ }
          if (staleOutpoints.length > 0) {
            setStickyExcludedOutpoints(prev => [...new Set([...prev, ...staleOutpoints])]);
          }
          throw new Error('A selected UTXO was already spent on-chain. Click Sign & Broadcast again — the stale input has been excluded automatically.');
        } else {
          throw broadcastErr;
        }
      }

      setFinalizedTx({ txid, rawTxHex });
      setCurrentStep('success');
      onDogetagCreated?.(txid, message);
      toast.success('DogeTag:tx broadcast successfully!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sign and broadcast transaction';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  // OP_RETURN (DogeTag:tx) broadcast — witness path uses handleBroadcastCommit/Reveal instead.
  const broadcastTransaction = async () => {
    if (!signedTxHex) return;

    setIsLoading(true);
    setError(null);
    setBroadcastProgress(null);

    try {
      const bitcoin = await import('bitcoinjs-lib');
      const DOGE_NETWORK = {
        messagePrefix: '\x19Dogecoin Signed Message:\n',
        bech32: 'dc',
        bip32: { public: 0x02facafd, private: 0x02fac398 },
        pubKeyHash: 0x1e,
        scriptHash: 0x16,
        wif: 0x9e,
      };

      let rawTxHex = signedTxHex!;
      if (builtPsbt) {
        // Extract raw tx from signed PSBT (MyDoge may return hex PSBT, base64 PSBT, or raw tx)
        try {
          rawTxHex = bitcoin.Psbt.fromHex(signedTxHex!, { network: DOGE_NETWORK }).extractTransaction().toHex();
        } catch {
          try {
            rawTxHex = bitcoin.Psbt.fromBase64(signedTxHex!, { network: DOGE_NETWORK }).extractTransaction().toHex();
          } catch {
            // signedTxHex is already a raw tx hex - use as-is
          }
        }
      }

      const tryBroadcast = async (hex: string): Promise<string> => broadcastSignedTransaction(hex);

      let txid: string;
      try {
        txid = await tryBroadcast(rawTxHex);
      } catch (broadcastErr) {
        const msg = broadcastErr instanceof Error ? broadcastErr.message : '';
        const isStaleUtxo = msg.includes('bad-txns-inputs-spent') || msg.includes('has already been spent');

        if (isStaleUtxo && wallet?.walletType === 'browser' && typeof wallet?.signOpReturn === 'function') {
          // Extract all input outpoints from the failed tx and add to sticky excludes.
          const staleOutpoints: string[] = [];
          try {
            const failedTx = bitcoin.Transaction.fromHex(rawTxHex);
            for (const inp of failedTx.ins) {
              const txidHex = Array.from(inp.hash).reverse().map(b => b.toString(16).padStart(2, '0')).join('');
              staleOutpoints.push(`${txidHex}:${inp.index}`);
            }
          } catch { /* parse failure — proceed without excludes */ }

          const freshExcludes = [
            ...(Array.isArray(wallet?.protectedOutpoints) ? wallet.protectedOutpoints : []),
            ...stickyExcludedOutpoints,
            ...staleOutpoints,
          ];
          if (staleOutpoints.length > 0) {
            setStickyExcludedOutpoints(prev => [...new Set([...prev, ...staleOutpoints])]);
          }

          // Auto-rebuild and retry with the stale UTXO excluded.
          const address = await wallet.getAddress();
          const tip =
            tipEnabled && tipAddress.trim() && tipAmountDoge.trim()
              ? { address: tipAddress.trim(), satoshis: Math.round(parseFloat(tipAmountDoge) * 1e8) }
              : undefined;
          const retryResult = await wallet.signOpReturn({
            message,
            fromAddress: address,
            feeRate,
            tip,
            excludedOutpoints: freshExcludes,
          });
          txid = await tryBroadcast(retryResult.rawHex);
          setSignedTxHex(retryResult.rawHex);
        } else if (isStaleUtxo) {
          // Extension wallet: can't auto-rebuild — reset to sign step so user re-signs with fresh UTXOs.
          const staleOutpoints: string[] = [];
          try {
            const failedTx = bitcoin.Transaction.fromHex(rawTxHex);
            for (const inp of failedTx.ins) {
              const txidHex = Array.from(inp.hash).reverse().map(b => b.toString(16).padStart(2, '0')).join('');
              staleOutpoints.push(`${txidHex}:${inp.index}`);
            }
          } catch { /* ignore */ }
          if (staleOutpoints.length > 0) {
            setStickyExcludedOutpoints(prev => [...new Set([...prev, ...staleOutpoints])]);
          }
          setCurrentStep('sign');
          throw new Error('A selected UTXO was already spent on-chain. Please sign again — the stale input has been excluded automatically.');
        } else {
          throw broadcastErr;
        }
      }

      setFinalizedTx({ txid, rawTxHex });
      setCurrentStep('success');
      onDogetagCreated?.(txid, message);
      toast.success('DogeTag:tx broadcast successfully!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to broadcast transaction';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  // ── Inscription step handlers ──────────────────────────────────────────────

  /** Upsert a provider attempt into an attempt list. */
  const upsertAttempt = (
    prev: BroadcastAttemptUpdate[],
    update: BroadcastAttemptUpdate,
  ): BroadcastAttemptUpdate[] => {
    const idx = prev.findIndex((a) => a.provider === update.provider);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = update;
      return next;
    }
    return [...prev, update];
  };

  const handleBroadcastCommit = async () => {
    if (!inscriptionPlan) return;
    setIsBroadcasting(true);
    setError(null);
    setCommitAttempts([]);

    try {
      let alreadyInMempool = false;
      const txid = await broadcastTxWithStatus(inscriptionPlan.commitTxHex, (upd) => {
        if (upd.status === 'already_exists') alreadyInMempool = true;
        setCommitAttempts((prev) => upsertAttempt(prev, upd));
      });

      if (alreadyInMempool) {
        // A previous broadcast of this exact tx is already in the network mempool.
        // This tx was built with the old fee floor — it may not have enough fee to
        // be mined.  Extract its inputs so the user can rebuild with fresh UTXOs.
        try {
          const { Transaction } = await import('bitcoinjs-lib');
          const tx = Transaction.fromHex(inscriptionPlan.commitTxHex);
          const stuckOutpoints = tx.ins.map(
            (inp) => `${Buffer.from(inp.hash).reverse().toString('hex')}:${inp.index}`,
          );
          setStickyExcludedOutpoints((prev) => [...new Set([...prev, ...stuckOutpoints])]);
        } catch {
          // If decode fails, we still proceed to polling — user can rebuild manually.
        }
      }

      // Abort any previous polling session (safety).
      pollingController?.abort();
      const controller = new AbortController();
      setPollingController(controller);
      setCurrentStep('inscription_confirming');
      setCommitPollSchedule(null);

      pollTxForConfirmation(txid, setCommitConfirmations, {
        signal: controller.signal,
        onBeforeSleep: ({ ms }) => {
          setCommitPollSchedule({ until: Date.now() + ms, intervalMs: ms });
        },
      })
        .then(() => setCurrentStep('inscription_reveal'))
        .catch((err) => {
          if (err?.name !== 'AbortError') {
            setError('Confirmation polling failed: ' + (err?.message ?? String(err)));
          }
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Broadcast failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsBroadcasting(false);
    }
  };

  /**
   * Rebuild the inscription plan excluding the UTXOs from the current stuck
   * commit tx.  Called when already_in_mempool is detected.
   */
  const handleRebuildWithFreshUtxos = async () => {
    if (!inscriptionPlan) return;
    // stickyExcludedOutpoints was already populated in handleBroadcastCommit.
    // Just reset inscription state and re-run the build step.
    pollingController?.abort();
    setPollingController(null);
    setInscriptionPlan(null);
    setCommitAttempts([]);
    setRevealAttempts([]);
    setCommitConfirmations(0);
    setError(null);
    setCurrentStep('build' as any); // triggers buildTransaction below
    // Programmatically re-run build (wallet should still be unlocked).
    await buildTransaction();
  };

  const handleBroadcastReveal = async () => {
    if (!inscriptionPlan) return;
    setIsBroadcasting(true);
    setError(null);
    setRevealAttempts([]);

    try {
      const txid = await broadcastTxWithStatus(inscriptionPlan.revealTxHex, (upd) =>
        setRevealAttempts((prev) => upsertAttempt(prev, upd)),
      );

      setFinalizedTx({
        txid,
        inscriptionId: inscriptionPlan.inscriptionId,
        commitTxid: inscriptionPlan.commitTxid,
        revealTxid: inscriptionPlan.revealTxid,
      });
      setCurrentStep('success');
      onDogetagCreated?.(txid, message);
      toast.success('Doginal inscription broadcast successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Broadcast failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // CPFP: re-broadcast commit to refresh it in mempools, then immediately broadcast reveal.
  // Necessary when the commit has drifted out of relay nodes' mempools (evicted due to age).
  const handleCpfpBroadcast = async () => {
    if (!inscriptionPlan) return;
    setIsBroadcasting(true);
    setError(null);
    setCommitAttempts([]);
    setRevealAttempts([]);

    try {
      // Step 1: re-broadcast commit so relay nodes have it fresh
      await broadcastTxWithStatus(inscriptionPlan.commitTxHex, (upd) =>
        setCommitAttempts((prev) => upsertAttempt(prev, upd)),
      );

      // Step 2: broadcast reveal immediately while commit is in node mempools
      const txid = await broadcastTxWithStatus(inscriptionPlan.revealTxHex, (upd) =>
        setRevealAttempts((prev) => upsertAttempt(prev, upd)),
      );

      setFinalizedTx({
        txid,
        inscriptionId: inscriptionPlan.inscriptionId,
        commitTxid: inscriptionPlan.commitTxid,
        revealTxid: inscriptionPlan.revealTxid,
      });
      setCurrentStep('success');
      onDogetagCreated?.(txid, message);
      toast.success('Doginal inscription broadcast successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Broadcast failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const copyHex = (which: 'commit' | 'reveal') => {
    const hex =
      which === 'commit' ? inscriptionPlan?.commitTxHex : inscriptionPlan?.revealTxHex;
    if (!hex) return;
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopiedHex(which);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const resetCreator = () => {
    pollingController?.abort();
    setPollingController(null);
    setMessage('');
    setCurrentStep('compose');
    setBuiltPsbt(null);
    setInscriptionPlan(null);
    setBroadcastProgress(null);
    setSignedTxHex(null);
    setFinalizedTx(null);
    setError(null);
    setInscriptionMode('op_return');
    setShowModeSuggestion(false);
    setTipEnabled(false);
    setTipAddress('');
    setTipAmountDoge('');
    setIsBroadcasting(false);
    setCommitAttempts([]);
    setRevealAttempts([]);
    setCommitConfirmations(0);
    setCopiedHex(null);
    setStickyExcludedOutpoints([]);
    setMydogeIndexerCheck('idle');
    setMydogeIndexerDetail(null);
  };

  const verifyMyDogeIndexer = useCallback(async () => {
    const id = finalizedTx?.inscriptionId as string | undefined;
    if (!id) return;
    setMydogeIndexerCheck('checking');
    setMydogeIndexerDetail(null);
    try {
      const url = myDogeInscriptionApiUrl(id);
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (res.ok) {
        await res.json().catch(() => ({}));
        setMydogeIndexerCheck('found');
        return;
      }
      if (res.status === 404) {
        setMydogeIndexerCheck('not_yet');
        setMydogeIndexerDetail('Not indexed yet — allow confirmations, then try again.');
        return;
      }
      setMydogeIndexerCheck('error');
      setMydogeIndexerDetail(`HTTP ${res.status}`);
    } catch (e) {
      setMydogeIndexerCheck('error');
      const msg = e instanceof Error ? e.message : String(e);
      setMydogeIndexerDetail(`${msg} Open the API link in a new tab if the browser blocked the check.`);
    }
  }, [finalizedTx?.inscriptionId]);

  const commitConfirmationPollProgress = useMemo(() => {
    if (currentStep !== 'inscription_confirming') return null;
    void commitPollClock;
    const nextCheckSec =
      commitPollSchedule && commitPollSchedule.until > Date.now()
        ? Math.max(0, Math.ceil((commitPollSchedule.until - Date.now()) / 1000))
        : null;
    const pollIntervalSec = commitPollSchedule
      ? Math.round(commitPollSchedule.intervalMs / 1000)
      : null;
    return (
      <TxConfirmationPollProgress
        active
        nextCheckSec={nextCheckSec}
        intervalSec={pollIntervalSec}
        variant="default"
        className="text-left"
      />
    );
  }, [commitPollClock, commitPollSchedule, currentStep]);

  const getStepIndicator = (step: CreationStep) => {
    const steps = ['compose', 'preview', 'sign', 'success'];
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(step);

    if (stepIndex < currentIndex) return '✅';
    if (stepIndex === currentIndex) return '🔄';
    return '⭕';
  };

  return (
    <>
      {/* First-Time Tutorial Modal */}
      {showTutorialModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-6xl mb-4">🏷️</div>
                  <h2 className="text-2xl font-bold text-text-primary mb-2">Two ways to put text on Dogecoin</h2>
                  <p className="text-text-secondary mb-6">
                    Dojakweb supports two message formats: short OP_RETURN notes and longer witness-carried messages.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-600/30">
                    <h3 className="font-semibold text-blue-300 mb-2 flex items-center">
                      <span className="text-lg mr-2">🐾</span>
                      DogeTag:tx
                    </h3>
                    <p className="text-sm text-text-secondary mb-2">
                      Short OP_RETURN messages. They stay with the transaction and do not move with coins.
                    </p>
                    <p className="text-xs text-blue-200">
                      Best for small public notes, signatures, and timestamps.
                    </p>
                  </div>

                  <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-600/30">
                    <h3 className="font-semibold text-purple-300 mb-2 flex items-center">
                      <span className="text-lg mr-2">🐕</span>
                      DogeTag:inscription
                    </h3>
                    <p className="text-sm text-text-secondary mb-2">
                      Longer witness-carried messages. They move with the coin when it is spent.
                    </p>
                    <p className="text-xs text-purple-200">
                      Best for longer text, provenance notes, and collectible-style inscriptions.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-900/20 rounded-lg p-3 border border-emerald-600/30">
                  <p className="text-sm text-emerald-200 text-center">
                    <strong>The key difference:</strong> DogeTag:tx stays with the transaction.
                    DogeTag:inscription moves with the coin.
                  </p>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => {
                    setShowTutorialModal(false);
                    localStorage.setItem('dojakweb-dogetag-tutorial-seen', 'true');
                  }}
                  className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors"
                >
                  Got it - Start
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <PencilSquareIcon className="w-8 h-8 text-primary mr-3" />
            <h1 className="text-3xl font-bold text-text-primary">Create a DogeTag</h1>
          </div>
          <p className="text-text-secondary">
            Create DogeTag:tx or DogeTag:inscription messages and see how Dogecoin text on-chain works.
          </p>
        </div>

      {/* Progress Indicator */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4 text-sm">
          <span className={`flex items-center ${currentStep === 'compose' ? 'text-primary' : 'text-text-secondary'}`}>
            {getStepIndicator('compose')} Compose
          </span>
          <span>→</span>
          <span className={`flex items-center ${currentStep === 'preview' ? 'text-primary' : 'text-text-secondary'}`}>
            {getStepIndicator('preview')} Preview
          </span>
          <span>→</span>
          <span className={`flex items-center ${currentStep === 'sign' ? 'text-primary' : 'text-text-secondary'}`}>
            {getStepIndicator('sign')} Sign TX
          </span>
          <span>→</span>
          <span className={`flex items-center ${currentStep === 'broadcast' ? 'text-primary' : 'text-text-secondary'}`}>
            {getStepIndicator('broadcast')} Broadcast
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
        {currentStep === 'compose' && (
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Inscription Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                <button
                  onClick={() => {
                    setInscriptionMode('op_return');
                    setShowModeSuggestion(false);
                    setError(null);
                    onInscriptionModeChange?.('op_return');
                  }}
                  className={`p-3 rounded-lg border-2 transition-all w-full ${
                    inscriptionMode === 'op_return'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-primary hover:border-primary text-text-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <RadioIcon className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">DogeTag:tx</div>
                        <div className="text-xs opacity-75">Short note • 80 bytes max • Stays with the transaction</div>
                      </div>
                    </div>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTooltip('op_return');
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleTooltip('op_return');
                          }
                        }}
                        className="p-1 rounded-full hover:bg-bg-secondary transition-colors inline-flex"
                      >
                        <QuestionMarkCircleIcon className="w-4 h-4 opacity-60 hover:opacity-100" />
                      </span>
                    </div>
                  </button>

                  {/* OP_RETURN Tooltip */}
                  {showTooltip === 'op_return' && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-10" data-tooltip>
                      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 shadow-lg">
                        <div className="flex items-start space-x-2">
                          <InformationCircleIcon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-text-primary mb-2">
                              DogeTag:tx
                            </div>
                            <div className="text-sm text-text-secondary space-y-2">
                              <p>
                                This mode writes a short public note into an OP_RETURN output. It stays with the transaction and does not move with coins.
                              </p>
                              <p>
                                <strong>Good for:</strong> signatures, timestamps, short announcements, and tiny notes.
                              </p>
                              <div className="text-xs text-text-tertiary mt-2">
                                Max size: 80 bytes.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      setInscriptionMode('witness');
                      setShowModeSuggestion(false);
                      setError(null);
                      onInscriptionModeChange?.('witness');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all w-full ${
                      inscriptionMode === 'witness'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border-primary hover:border-primary text-text-secondary'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CpuChipIcon className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">DogeTag:inscription</div>
                          <div className="text-xs opacity-75">Doginal • 1390 bytes • 2 txs • local wallet</div>
                        </div>
                      </div>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTooltip('witness');
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleTooltip('witness');
                          }
                        }}
                        className="p-1 rounded-full hover:bg-bg-secondary transition-colors inline-flex"
                      >
                        <QuestionMarkCircleIcon className="w-4 h-4 opacity-60 hover:opacity-100" />
                      </span>
                    </div>
                  </button>

                  {/* Witness Tooltip */}
                  {showTooltip === 'witness' && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-10" data-tooltip>
                      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 shadow-lg">
                        <div className="flex items-start space-x-2">
                          <InformationCircleIcon className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-text-primary mb-2">
                              DogeTag:inscription
                            </div>
                            <div className="text-sm text-text-secondary space-y-2">
                              <p>
                                This mode creates a canonical Doginals inscription using commit-reveal (2 transactions).
                              </p>
                              <p>
                                <strong>Good for:</strong> longer text, provenance notes, and collectible-style inscriptions picked up by compatible Doginals indexers.
                              </p>
                              <div className="text-xs text-text-tertiary mt-2">
                                Max size: {INSCRIPTION_MAX_CONTENT_BYTES} bytes (single-partial profile).
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Philosophical Label */}
              <div className="mt-3 text-center">
                <div className="text-sm italic text-text-secondary border-t border-border-primary pt-3">
                  {getPhilosophicalLabel()}
                </div>
              </div>
            </div>

            {/* Auto-suggest switching */}
            {showModeSuggestion && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <ExclamationCircleIcon className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                      <div className="text-sm text-yellow-200">
                      <div className="font-medium mb-1">This message is too large for DogeTag:tx mode.</div>
                      <div className="text-xs opacity-90 mb-2">
                        <strong>DogeTag:tx</strong> — short notes that stay with the transaction<br/>
                        <strong>DogeTag:inscription</strong> — longer notes that move with the coin
                      </div>
                    </div>
                    <button
                      onClick={switchToWitnessMode}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-yellow-100 text-sm rounded transition-colors"
                    >
                      Switch to DogeTag:inscription
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Message Input */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Your message
              </label>
              <Textarea
                value={message}
                onChange={(e) => handleMessageChange(e.target.value)}
                placeholder={
                  inscriptionMode === 'op_return'
                    ? "Write your message here... (max 80 bytes)"
                    : `Write your message here... (max ${INSCRIPTION_MAX_CONTENT_BYTES} bytes)`
                }
                className="h-32 resize-none"
                maxLength={inscriptionMode === 'op_return' ? 80 : INSCRIPTION_MAX_CONTENT_BYTES}
              />
              <div className="flex justify-between items-center text-xs text-text-tertiary mt-1">
                <div>
                  {message.length} characters
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`${getByteLength(message) > getLimits().maxBytes * 0.8 ? 'text-yellow-400' : ''}`}>
                    {getByteLength(message)} / {getLimits().maxBytes.toLocaleString()} bytes
                  </span>
                  {inscriptionMode === 'op_return' && getByteLength(message) > 60 && (
                    <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />
                  )}
                  <button
                    onClick={() => toggleTooltip(showTooltip === 'bytes' ? null : 'bytes')}
                    className="p-0.5 rounded hover:bg-bg-secondary transition-colors opacity-60 hover:opacity-100"
                  >
                    <QuestionMarkCircleIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Bytes Tooltip */}
              {showTooltip === 'bytes' && (
                <div className="mt-2 p-3 bg-bg-secondary border border-border-primary rounded-lg text-xs text-text-secondary" data-tooltip>
                  <div className="font-medium text-text-primary mb-1">Why bytes matter</div>
                  <p>
                    DogeTag size is measured in UTF-8 bytes, not characters. Emojis and non-English characters take more space.
                  </p>
                  <p className="mt-1">
                    DogeTag:tx (OP_RETURN) = 80 bytes max. DogeTag:inscription = {INSCRIPTION_MAX_CONTENT_BYTES} bytes (2 txs).
                  </p>
                  <p className="mt-1">
                    The counter updates live so you can sculpt your message precisely.
                  </p>
                </div>
              )}
            </div>

            {/* Optional tip (OP_RETURN only) */}
            {inscriptionMode === 'op_return' && (
              <div className="bg-bg-primary border border-border-primary rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-secondary">Include a tip with this message?</span>
                  <Switch
                    checked={tipEnabled}
                    onCheckedChange={setTipEnabled}
                  />
                </div>
                <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-tertiary">
                  <span>Send</span>
                  <DogeCurrencyIcon size="sm" className="opacity-90" />
                  <span>
                    to any address in the same transaction as your message. Great for tips, donations, or &quot;you&apos;re
                    awesome!&quot; notes.
                  </span>
                </p>
                {tipEnabled && (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={tipAddress}
                      onChange={(e) => setTipAddress(e.target.value)}
                      placeholder="Recipient Dogecoin address (D...)"
                      className="w-full"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={tipAmountDoge}
                        onChange={(e) => setTipAmountDoge(e.target.value)}
                        placeholder="Amount (min 0.001 Ð)"
                        className="flex-1"
                      />
                      <DogeCurrencyIcon size="md" className="opacity-90" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              {inscriptionMode === 'op_return' ? (
                <button
                  type="button"
                  onClick={buildTransaction}
                  disabled={!message.trim() || isLoading}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-md transition-colors"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      <span>Building...</span>
                    </div>
                  ) : (
                    'Sign & Broadcast →'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={validateAndPreview}
                  disabled={!message.trim() || isLoading}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-md transition-colors"
                >
                  Preview →
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 'preview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-2">Preview your DogeTag</h3>
              <div className="bg-bg-primary border border-border-primary rounded-md p-4">
                <div className="flex items-start space-x-3">
                  {inscriptionMode === 'witness' ? (
                    <DocumentTextIcon className="w-5 h-5 text-primary mt-0.5" />
                  ) : (
                    <RadioIcon className="w-5 h-5 text-blue-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm text-text-secondary mb-1">
                      {inscriptionMode === 'witness'
                        ? 'Content Type: witness message'
                        : 'Content Type: OP_RETURN note'}
                    </div>
                    <div className="text-text-primary whitespace-pre-wrap break-words">{message}</div>
                    <div className="text-xs text-text-tertiary mt-2">
                      {getByteLength(message)} bytes • {inscriptionMode === 'witness' ? 'Moves with the coin' : 'Stays with the transaction'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('compose')}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Back to Edit
              </button>
              <button
                onClick={buildTransaction}
                disabled={isLoading}
                className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-md transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>Building...</span>
                  </div>
                ) : (
                  'Build Transaction'
                )}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'sign' && builtPsbt && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-2">Transaction Ready</h3>
              <div className="bg-bg-primary border border-border-primary rounded-md p-4 space-y-2">
                {builtPsbt ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Network fee:</span>
                      <DogeAmount sats={builtPsbt.feeSatoshis} />
                    </div>
                    {builtPsbt.tip && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Tip to {builtPsbt.tip.address.slice(0, 10)}…:</span>
                        <DogeAmount sats={builtPsbt.tip.satoshis} />
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Change back to you:</span>
                      <DogeAmount sats={builtPsbt.changeSatoshis} />
                    </div>
                    <div className="border-t border-border-primary pt-2 mt-2">
                      <div className="text-xs text-text-tertiary mb-1">UTXOs being spent ({builtPsbt.selectedUtxos.length}):</div>
                      {selectedUtxoReview.map((u, i) => (
                        <div key={i} className="flex justify-between text-xs text-text-secondary font-mono">
                          <span className="truncate mr-2 flex items-center gap-2">
                            {u.txid.slice(0, 16)}…:{u.vout}
                            {u.isProtected ? (
                              <span className="text-red-300 bg-red-500/20 border border-red-500/40 rounded px-1.5 py-0.5 text-[10px] font-sans">
                                PROTECTED
                              </span>
                            ) : null}
                          </span>
                          <DogeAmount sats={u.value} />
                        </div>
                      ))}
                    </div>

                    <div
                      className={`border rounded-md p-3 mt-2 ${
                        hasProtectedInputMatch
                          ? 'border-red-500/40 bg-red-500/10'
                          : 'border-emerald-500/30 bg-emerald-500/10'
                      }`}
                    >
                      <div className="text-xs font-medium mb-1">
                        {hasProtectedInputMatch
                          ? 'Safety warning: protected inscription outpoint selected.'
                          : 'Safety check passed: no protected inscription outpoints in selected inputs.'}
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        Protected outpoints are derived from your indexed inscriptions and are excluded from spending.
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <p className="text-sm text-text-secondary mt-2">
                Review the fee and inputs above, then click <strong className="text-text-primary">Sign &amp; Broadcast</strong> — your wallet will sign and the transaction goes live in one step.
              </p>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(inscriptionMode === 'op_return' ? 'compose' : 'preview')}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                {inscriptionMode === 'op_return' ? '← Back' : '← Back to Preview'}
              </button>
              <button
                type="button"
                onClick={signTransaction}
                disabled={isLoading || hasProtectedInputMatch}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>Signing & Broadcasting...</span>
                  </div>
                ) : (
                  'Sign & Broadcast'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Inscription step 1: broadcast commit tx ──────────────────────── */}
        {currentStep === 'inscription_commit' && inscriptionPlan && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-text-primary">Step 1 of 2 — Broadcast Commit</h3>
              <p className="text-sm text-text-secondary mt-1">
                Sends your inscription data to a P2SH address on Dogecoin.
              </p>
            </div>

            {/* Tx detail box — no explorer link until confirmed on-chain */}
            <div className="bg-bg-primary border border-border-primary rounded-md p-3 space-y-2">
              <div>
                <div className="text-xs text-text-secondary mb-1">Commit TXID</div>
                <div className="font-mono text-xs text-text-primary break-all">{inscriptionPlan.commitTxid}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">Raw Hex</span>
                  <button
                    onClick={() => copyHex('commit')}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {copiedHex === 'commit' ? '✅ Copied' : '📋 Copy hex'}
                  </button>
                </div>
                <div className="font-mono text-xs text-text-primary break-all opacity-60 max-h-16 overflow-hidden">
                  {inscriptionPlan.commitTxHex.slice(0, 120)}…
                </div>
              </div>
            </div>

            {commitAttempts.length > 0 ? (
              <BroadcastRelayAttempts attempts={commitAttempts} title="Relay attempts" variant="default" />
            ) : null}

            {/* Already-in-mempool warning with rebuild offer */}
            {commitAttempts.some((a) => a.status === 'already_exists') && (
              <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-md p-3 text-sm space-y-2">
                <p className="text-yellow-300">
                  ⚠️ A previous broadcast of this transaction is already in the mempool and may have
                  had insufficient fees. To avoid competing with it, rebuild the inscription using
                  different funds.
                </p>
                <button
                  onClick={handleRebuildWithFreshUtxos}
                  disabled={isBroadcasting}
                  className="text-xs px-3 py-1 bg-yellow-700/60 hover:bg-yellow-600/60 text-yellow-200 rounded transition-colors"
                >
                  🔄 Rebuild with Fresh UTXOs
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/40 rounded-md p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentStep('preview')}
                className="px-3 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
              >
                ← Back
              </button>
              <button
                onClick={handleBroadcastCommit}
                disabled={isBroadcasting}
                className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-md transition-colors flex items-center gap-2"
              >
                {isBroadcasting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                {isBroadcasting ? 'Broadcasting…' : 'Broadcast Commit Transaction'}
              </button>
            </div>
          </div>
        )}

        {/* ── Inscription step 1b: waiting for commit confirmation ─────────── */}
        {currentStep === 'inscription_confirming' && inscriptionPlan && (
          <div className="space-y-4">
            <div className="text-center">
              <ArrowPathIcon className="w-12 h-12 text-yellow-400 mx-auto mb-3 animate-spin" />
              <h3 className="text-lg font-semibold text-text-primary">Waiting for Confirmation</h3>
              <p className="text-sm text-text-secondary mt-1">
                The reveal cannot be broadcast until the commit transaction has at least 1 confirmation.
              </p>
            </div>

            <div className="text-center py-2">
              <span className="text-3xl font-bold text-text-primary">{commitConfirmations}</span>
              <span className="text-lg text-text-secondary"> / 1 confirmation</span>
              <div className="text-xs text-text-secondary mt-1">
                Reads about every {Math.round(getConfirmationPollIntervalMs() / 1000)}s (faster when Wallet → RPC +
                proxy is configured).
              </div>
            </div>
            {commitConfirmationPollProgress}

            <div className="bg-bg-primary border border-border-primary rounded-md p-3 space-y-1">
              <div className="text-xs text-text-secondary">Commit TXID</div>
              <div className="font-mono text-xs text-text-primary break-all">{inscriptionPlan.commitTxid}</div>
              <p className="text-xs text-text-secondary pt-1 leading-relaxed">
                <a
                  href={dogeTxExplorerUrl(inscriptionPlan.commitTxid, explorerPref)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Open commit transaction on {explorerLabel}
                </a>
                <span className="text-text-tertiary"> — set explorer in Wallet → Settings.</span>
              </p>
            </div>

            <p className="text-xs text-text-secondary text-center">
              Dogecoin blocks are ~1 minute. This page will advance automatically
              {commitConfirmations >= 1 ? ' (commit is confirmed).' : '.'}
            </p>

            {/* CPFP escape hatch */}
            <details className="border border-border-primary rounded-md text-sm">
              <summary className="cursor-pointer px-3 py-2 text-text-secondary hover:text-text-primary select-none">
                Stuck for more than 5 minutes? Use CPFP to speed up
              </summary>
              <div className="px-3 pb-3 pt-2 space-y-3 border-t border-border-primary">
                <p className="text-xs text-text-secondary">
                  Re-broadcasts the commit to refresh it in relay nodes, then immediately broadcasts the reveal.
                  Miners will include both in the same block (CPFP). Safe to retry if it fails the first time.
                </p>
                {(commitAttempts.length > 0 || revealAttempts.length > 0) && (
                  <div className="space-y-3">
                    {commitAttempts.length > 0 ? (
                      <BroadcastRelayAttempts
                        attempts={commitAttempts}
                        title="Commit relays"
                        variant="default"
                        dense
                        embedded
                      />
                    ) : null}
                    {revealAttempts.length > 0 ? (
                      <BroadcastRelayAttempts
                        attempts={revealAttempts}
                        title="Reveal relays"
                        variant="default"
                        dense
                        embedded
                      />
                    ) : null}
                  </div>
                )}
                <button
                  onClick={handleCpfpBroadcast}
                  disabled={isBroadcasting}
                  className="w-full px-4 py-2 bg-yellow-700/60 hover:bg-yellow-600/60 disabled:opacity-50 disabled:cursor-not-allowed text-yellow-200 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {isBroadcasting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                  {isBroadcasting ? 'Broadcasting…' : 'Re-broadcast Commit + Reveal (CPFP)'}
                </button>
              </div>
            </details>
          </div>
        )}

        {/* ── Inscription step 2: broadcast reveal tx ───────────────────────── */}
        {currentStep === 'inscription_reveal' && inscriptionPlan && (
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-500/30 rounded-md p-2 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-sm text-green-400">
                Commit confirmed ({commitConfirmations} confirmation{commitConfirmations !== 1 ? 's' : ''})
              </span>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold text-text-primary">Step 2 of 2 — Broadcast Reveal</h3>
              <p className="text-sm text-text-secondary mt-1">
                Reveals the inscription data and completes the DogeTag:inscription.
              </p>
            </div>

            {/* Tx detail box — no explorer link until confirmed on-chain */}
            <div className="bg-bg-primary border border-border-primary rounded-md p-3 space-y-2">
              <div>
                <div className="text-xs text-text-secondary mb-1">Reveal TXID</div>
                <div className="font-mono text-xs text-text-primary break-all">{inscriptionPlan.revealTxid}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">Raw Hex</span>
                  <button
                    onClick={() => copyHex('reveal')}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {copiedHex === 'reveal' ? '✅ Copied' : '📋 Copy hex'}
                  </button>
                </div>
                <div className="font-mono text-xs text-text-primary break-all opacity-60 max-h-16 overflow-hidden">
                  {inscriptionPlan.revealTxHex.slice(0, 120)}…
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Commit (for reference):{' '}
                <a
                  href={dogeTxExplorerUrl(inscriptionPlan.commitTxid, explorerPref)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  view on {explorerLabel}
                </a>
                . After you broadcast the reveal, open its transaction from the success screen.
              </p>
            </div>

            {revealAttempts.length > 0 ? (
              <BroadcastRelayAttempts attempts={revealAttempts} title="Relay attempts" variant="default" />
            ) : null}

            {error && (
              <div className="bg-red-900/20 border border-red-500/40 rounded-md p-3 text-sm text-red-400">
                {error}
                <button
                  onClick={() => { setError(null); setRevealAttempts([]); }}
                  className="ml-3 text-red-300 hover:text-red-200 underline text-xs"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={handleBroadcastReveal}
                disabled={isBroadcasting}
                className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-md transition-colors flex items-center gap-2"
              >
                {isBroadcasting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                {isBroadcasting ? 'Broadcasting…' : 'Broadcast Reveal Transaction'}
              </button>
            </div>
          </div>
        )}

        {/* ── OP_RETURN broadcast step (unchanged) ─────────────────────────── */}
        {currentStep === 'broadcast' && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">Transaction Signed!</h3>
              <p className="text-text-secondary">
                Your {dogetagKindLabel} is ready to be broadcast to the Dogecoin network.
              </p>
              {broadcastProgress && (
                <p className="text-sm text-emerald-300 mt-2">{broadcastProgress}</p>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('sign')}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Back to Sign
              </button>
              <button
                onClick={broadcastTransaction}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>Broadcasting...</span>
                  </div>
                ) : (
                  `Broadcast ${dogetagKindLabel}`
                )}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'success' && finalizedTx && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-text-primary mb-2">
                {inscriptionMode === 'witness' && finalizedTx?.commitTxid
                  ? `${dogetagKindLabel} broadcast complete`
                  : `${dogetagKindLabel} broadcast sent`}
                {' '}
                🎉
              </h3>
              <p className="text-text-secondary mb-3 text-sm leading-relaxed max-w-xl mx-auto">
                {inscriptionMode === 'witness' && finalizedTx?.commitTxid ? (
                  <>
                    Your commit and reveal transactions were <strong className="text-text-primary">accepted by the relay</strong>
                    — they entered the network pipeline, but that is not a guarantee they will confirm or stay valid. The
                    reveal still needs <strong className="text-text-primary">on-chain confirmations</strong>, and{' '}
                    <strong className="text-text-primary">indexers must ingest the chain</strong> before the inscription shows
                    up like a live one in wallets and APIs.
                  </>
                ) : (
                  <>
                    Your transaction was <strong className="text-text-primary">accepted by the relay</strong>. It still has to
                    confirm on-chain before it is final.
                  </>
                )}
              </p>

              {inscriptionMode === 'witness' && finalizedTx?.commitTxid ? (
                <>
                  <div className="bg-bg-primary border border-border-primary rounded-md p-4 mb-2 text-left">
                    <div className="text-sm text-text-secondary mb-1">Commit Transaction:</div>
                    <div className="font-mono text-xs text-text-primary break-all">
                      {finalizedTx.commitTxid}
                    </div>
                  </div>
                  <div className="bg-bg-primary border border-border-primary rounded-md p-4 mb-2 text-left">
                    <div className="text-sm text-text-secondary mb-1">Reveal Transaction:</div>
                    <div className="font-mono text-xs text-text-primary break-all">
                      {finalizedTx.revealTxid}
                    </div>
                  </div>
                  <div className="bg-bg-primary border border-border-primary rounded-md p-4 mb-3 text-left">
                    <div className="text-sm text-text-secondary mb-1">Inscription ID (expected):</div>
                    <div className="font-mono text-xs text-text-primary break-all">
                      {finalizedTx.inscriptionId}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 mb-4 text-left text-xs text-amber-100/95 leading-relaxed">
                    <p className="font-semibold text-amber-200 mb-1">Verify before you trust it</p>
                    <p className="mb-3">
                      Treat the inscription as <strong className="text-amber-100">provisional</strong> until an indexer serves
                      it. The MyDoge public API is a concrete check: when{' '}
                      <code className="rounded bg-black/30 px-1 py-0.5 text-[0.7rem] text-amber-50/90">
                        https://api.mydoge.com/inscription/&lt;your-id&gt;
                      </code>{' '}
                      returns JSON (fields like <code className="rounded bg-black/30 px-1 py-0.5 text-[0.7rem]">contentType</code>
                      , <code className="rounded bg-black/30 px-1 py-0.5 text-[0.7rem]">preview</code>), that endpoint can load your
                      inscription the same way wallets do.
                    </p>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                      <button
                        type="button"
                        onClick={() => void verifyMyDogeIndexer()}
                        disabled={mydogeIndexerCheck === 'checking'}
                        className="px-3 py-2 rounded-md bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/40 text-amber-50 text-xs font-semibold disabled:opacity-50"
                      >
                        {mydogeIndexerCheck === 'checking' ? 'Checking…' : 'Check MyDoge indexer'}
                      </button>
                      <a
                        href={myDogeInscriptionApiUrl(String(finalizedTx.inscriptionId))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-md border border-amber-400/30 text-amber-100/90 text-xs font-medium hover:bg-amber-500/15 inline-flex items-center justify-center"
                      >
                        Open API URL (JSON)
                      </a>
                    </div>
                    {mydogeIndexerCheck === 'found' && (
                      <p className="mt-2 text-emerald-300 font-medium">
                        Indexer returned data — this inscription is visible to that API.
                      </p>
                    )}
                    {mydogeIndexerCheck === 'not_yet' && (
                      <p className="mt-2 text-amber-200/90">{mydogeIndexerDetail}</p>
                    )}
                    {mydogeIndexerCheck === 'error' && mydogeIndexerDetail && (
                      <p className="mt-2 text-amber-200/90">{mydogeIndexerDetail}</p>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mb-4">
                    Public indexers can lag. Use your chosen transaction explorer (Wallet → Settings) to watch confirmations,
                    then run the indexer check again after a few minutes.
                  </p>
                </>
              ) : (
                <div className="bg-bg-primary border border-border-primary rounded-md p-4 mb-4 text-left">
                  <div className="text-sm text-text-secondary mb-2">Transaction ID:</div>
                  <div className="font-mono text-sm text-text-primary break-all">
                    {finalizedTx.txid}
                  </div>
                </div>
              )}

              <p className="text-xs text-text-secondary text-center max-w-xl mx-auto leading-relaxed">
                {inscriptionMode === 'witness' && finalizedTx?.commitTxid ? (
                  <>
                    View on {explorerLabel}:{' '}
                    <a
                      href={dogeTxExplorerUrl(finalizedTx.commitTxid, explorerPref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      commit transaction
                    </a>
                    {' · '}
                    <a
                      href={dogeTxExplorerUrl(finalizedTx.revealTxid, explorerPref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      reveal transaction
                    </a>
                    . Change explorer under Wallet → Settings → Dogecoin Transaction Explorer.
                  </>
                ) : (
                  <>
                    <a
                      href={dogeTxExplorerUrl(finalizedTx.txid, explorerPref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View transaction on {explorerLabel}
                    </a>
                    . Change explorer under Wallet → Settings → Dogecoin Transaction Explorer.
                  </>
                )}
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={resetCreator}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors"
              >
                Create another DogeTag
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Single format guide — DogeTag:tx vs DogeTag:inscription (collapsible, neutral styling) */}
        <div className="rounded-lg border border-border-primary bg-bg-secondary/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFormatGuide(!showFormatGuide)}
            className="w-full flex items-center justify-between p-4 hover:bg-bg-secondary/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <InformationCircleIcon className="w-5 h-5 shrink-0 text-text-secondary" />
              <span className="font-medium text-text-primary">Format guide</span>
            </div>
            {showFormatGuide ? (
              <ChevronUpIcon className="w-4 h-4 shrink-0 text-text-secondary" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 shrink-0 text-text-secondary" />
            )}
          </button>

          {showFormatGuide && (
            <div className="px-4 pb-4 border-t border-border-primary">
              <div className="text-sm text-text-secondary space-y-3 pt-3 leading-relaxed">
                <p>
                  <span className="font-medium text-text-primary">DogeTag:tx</span>
                  {' — '}
                  Short notes in OP_RETURN (80 bytes max). They stay with the transaction and never move.
                </p>
                <p>
                  <span className="font-medium text-text-primary">DogeTag:inscription</span>
                  {' — '}
                  Canonical Doginals commit–reveal inscriptions (2 transactions, signed in this wallet). Up to{' '}
                  {INSCRIPTION_MAX_CONTENT_BYTES} bytes in this UI.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};




