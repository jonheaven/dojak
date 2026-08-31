import React, { useEffect, useMemo, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { etchDune } from '../services/duneService';
import { parseSpacedDune } from '../lib/dunestone';
import type { DuneTerms } from '../lib/dunestone';
import { useDuneTxSigner } from '../hooks/useDuneTxSigner';
import { useDuneWalletConnection } from '../hooks/useDuneWalletConnection';
import { upsertWalletTxJournalEntry } from '../lib/wallet-tx-journal';
import {
  dogeTxExplorerDisplayName,
  dogeTxExplorerUrl,
  loadDogeTxExplorerPreference,
} from '../utils/dogeTxExplorer';
import {
  duneApprovalUserError,
  runDuneTxWithWalletApproval,
} from '../lib/dune-wallet-approval';
import {
  dojakwebFeeRateKoinuPerKbFromPreference,
  formatDojakwebFeeRate,
  koinuPerByteToKoinuPerKb,
} from '../lib/fees/txFeePreference';
import { NetworkFeeControl } from './fees/NetworkFeeControl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/** Runes/Dunes symbol tag is one Unicode code point — not a ticker string. */
function singleCodePointSymbol(raw: string): string {
  if (!raw) return '';
  const cp = raw.codePointAt(0);
  return cp === undefined ? '' : String.fromCodePoint(cp);
}

/**
 * THE•WHITE•DOGE — default **instant market** (full premine, open mint off)
 * so DOGE pool can chart day 1. Classic free-mint numbers kept as alt profile.
 * See dogenals/docs/WHITE_DOGE_INSTANT_MARKET.md
 */
const WHITE_INSTANT_MARKET = {
  premine: '420690180',
  mintAmount: '',
  mintCap: '',
  divisibility: '0',
  symbol: '🤍',
  enablePremine: true,
  enableMint: false,
  turbo: true,
} as const;

/** Historical free-mint race — do not use if you want an instant tradeable chart. */
const WHITE_CLASSIC_MINT = {
  premine: '42069000',
  mintAmount: '420',
  mintCap: '901479',
  divisibility: '0',
  symbol: '🤍',
  enablePremine: true,
  enableMint: true,
  turbo: true,
} as const;

const MANIFESTO_PRESET = {
  premine: '10000000',
  mintAmount: '1000',
  mintCap: '990000',
  divisibility: '0',
  symbol: 'Ð',
} as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (
    txid: string,
    details?: {
      op: 'deploy';
      duneName: string;
      address?: string | null;
    },
  ) => void;
  /** Pre-fill etch name (e.g. DOGENALS•OVER•DOGINALS). */
  initialName?: string;
}

type Step = 'form' | 'confirm' | 'broadcasting' | 'done';

function duneTxExplorerLinks(txid: string) {
  const id = txid.trim();
  const pref = loadDogeTxExplorerPreference();
  return [
    {
      label: dogeTxExplorerDisplayName(pref),
      href: dogeTxExplorerUrl(id, pref),
    },
  ];
}

function rememberDuneEtchReceipt(receipt: { name: string; txid: string; address?: string | null }) {
  if (typeof window === 'undefined') return;
  try {
    upsertWalletTxJournalEntry({
      txid: receipt.txid,
      address: receipt.address || null,
      protocol: 'dunes',
      action: 'dune-etch',
      title: `Dune etch: ${receipt.name}`,
      summary: 'Ðune etch broadcast from Dojakweb (OP_RETURN 0xD0)',
      status: 'broadcasted',
      originLabel: 'dogenals.com',
      metadata: {
        duneName: receipt.name,
        actionLabel: 'Etch',
      },
    });

    const key = 'dojakweb:dunes:etchReceipts:v1';
    const current = JSON.parse(window.localStorage.getItem(key) || '[]') as unknown;
    const rows = Array.isArray(current) ? current : [];
    const next = [
      {
        ...receipt,
        createdAt: new Date().toISOString(),
      },
      ...rows.filter((row) => {
        return !row || typeof row !== 'object' || (row as { txid?: string }).txid !== receipt.txid;
      }),
    ].slice(0, 20);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* best-effort receipt cache */
  }
}

function emitDuneEtchReceipt(receipt: { name: string; txid: string; address?: string | null }) {
  if (typeof window === 'undefined') return;
  const detail = {
    op: 'deploy',
    duneName: receipt.name,
    txid: receipt.txid,
    address: receipt.address || null,
  };
  window.dispatchEvent(new CustomEvent('dojakweb:dunes:tx', { detail }));
  window.dispatchEvent(new CustomEvent('dojakweb:dunes:deploy', { detail }));
}

export const DuneDeployModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, initialName }) => {
  const { address, connected, isBrowser } = useDuneWalletConnection();
  const resolveSigner = useDuneTxSigner();

  const plainInitial = (initialName ?? '').replace(/[•.\s]/g, '').toUpperCase();
  const isWhiteDune =
    plainInitial === 'THEWHITEDOGE'
  const isManifesto = plainInitial === 'DOGENALSOVERDOGINALS';

  /**
   * Instant market = full/premine float, open mint off (day-1 DOGE pool chart).
   * Classic = optional free-mint race. Applies to any Ðune; white/manifesto are presets.
   */
  const [marketProfile, setMarketProfile] = useState<'instant' | 'classic'>(
    isManifesto ? 'classic' : 'instant',
  );

  const [name, setName] = useState(initialName ?? '');
  const [divisibility, setDivisibility] = useState<string>(
    isWhiteDune
      ? WHITE_INSTANT_MARKET.divisibility
      : isManifesto
        ? MANIFESTO_PRESET.divisibility
        : '0',
  );
  const [symbol, setSymbol] = useState<string>(
    isWhiteDune ? WHITE_INSTANT_MARKET.symbol : isManifesto ? MANIFESTO_PRESET.symbol : 'Ð',
  );
  const [feeRateKoinuPerByte, setFeeRateKoinuPerByte] = useState(() =>
    dojakwebFeeRateKoinuPerKbFromPreference() / 1000,
  );
  const feeRateKoinuPerKb = koinuPerByteToKoinuPerKb(feeRateKoinuPerByte);
  // Premine + open mint are independent — both can be on (classic race only)
  const [enablePremine, setEnablePremine] = useState(true);
  const [premine, setPremine] = useState(
    isWhiteDune
      ? WHITE_INSTANT_MARKET.premine
      : isManifesto
        ? MANIFESTO_PRESET.premine
        : '1000000000',
  );
  const [enableMint, setEnableMint] = useState(isManifesto);
  const [mintAmount, setMintAmount] = useState(
    isWhiteDune ? '' : isManifesto ? MANIFESTO_PRESET.mintAmount : '',
  );
  const [mintCap, setMintCap] = useState(
    isWhiteDune ? '' : isManifesto ? MANIFESTO_PRESET.mintCap : '',
  );
  const [turbo, setTurbo] = useState(true);

  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signingAddress, setSigningAddress] = useState<string | null>(null);

  const applyMarketProfile = (profile: 'instant' | 'classic', plainName?: string) => {
    setMarketProfile(profile);
    const plain = (plainName ?? name).replace(/[•.\s]/g, '').toUpperCase();
    if (plain === 'THEWHITEDOGE') {
      const p = profile === 'instant' ? WHITE_INSTANT_MARKET : WHITE_CLASSIC_MINT;
      setPremine(p.premine);
      setMintAmount(p.mintAmount);
      setMintCap(p.mintCap);
      setDivisibility(p.divisibility);
      setSymbol(p.symbol);
      setEnablePremine(p.enablePremine);
      setEnableMint(p.enableMint);
      setTurbo(p.turbo);
      return;
    }
    if (profile === 'instant') {
      // Keep current premine if user already typed; ensure mint off
      setEnablePremine(true);
      setEnableMint(false);
      setMintAmount('');
      setMintCap('');
      setTurbo(true);
      if (!premine || premine === '0') setPremine('1000000000');
    } else {
      setEnablePremine(true);
      setEnableMint(true);
      if (!mintAmount) setMintAmount('1000');
      if (!mintCap) setMintCap('1000000');
    }
  };

  const applyPreset = (kind: 'white' | 'manifesto' | 'clear') => {
    if (kind === 'white') {
      setName('THE•WHITE•DOGE');
      applyMarketProfile('instant', 'THEWHITEDOGE');
    } else if (kind === 'manifesto') {
      setName('DOGENALS•OVER•DOGINALS');
      setPremine(MANIFESTO_PRESET.premine);
      setMintAmount(MANIFESTO_PRESET.mintAmount);
      setMintCap(MANIFESTO_PRESET.mintCap);
      setDivisibility(MANIFESTO_PRESET.divisibility);
      setSymbol(MANIFESTO_PRESET.symbol);
      setEnablePremine(true);
      setEnableMint(true);
      setMarketProfile('classic');
      setTurbo(true);
    }
  };

  const reset = () => {
    const plain = (initialName ?? '').replace(/[•.\s]/g, '').toUpperCase();
    setName(initialName ?? '');
    setFeeRateKoinuPerByte(dojakwebFeeRateKoinuPerKbFromPreference() / 1000);
    setStep('form');
    setError(null);
    setTxid(null);
    if (plain === 'THEWHITEDOGE') applyPreset('white');
    else if (plain === 'DOGENALSOVERDOGINALS') applyPreset('manifesto');
    else if (plain === 'DOGECOINBITS' || plain === 'BITS') {
      setPremine('0');
      setMintAmount('');
      setMintCap('');
      setDivisibility('0');
      setSymbol('₿');
      setEnablePremine(false);
      setEnableMint(false);
      setMarketProfile('classic');
      setTurbo(true);
    }
    else {
      setPremine('1000000000');
      setMintAmount('');
      setMintCap('');
      setDivisibility('0');
      setSymbol('Ð');
      setEnablePremine(true);
      setEnableMint(false);
      setMarketProfile('instant');
      setTurbo(true);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (isOpen && initialName?.trim()) {
      const n = initialName.trim().toUpperCase();
      setName(n);
      const plain = n.replace(/[•.\s]/g, '');
      if (plain === 'THEWHITEDOGE') applyPreset('white');
      else if (plain === 'DOGENALSOVERDOGINALS') applyPreset('manifesto');
      else if (plain === 'DOGECOINBITS' || plain === 'BITS') {
        setPremine('0');
        setMintAmount('');
        setMintCap('');
        setDivisibility('0');
        setSymbol('₿');
        setEnablePremine(false);
        setEnableMint(false);
        setMarketProfile('classic');
        setTurbo(true);
      }
      else applyMarketProfile('instant', plain);
    }
  }, [isOpen, initialName]);

  const nameError = (() => {
    if (!name.trim()) return null;
    try {
      parseSpacedDune(name.trim());
      return null;
    } catch (e: any) {
      return e.message as string;
    }
  })();

  const openMintSupply = useMemo(() => {
    if (!enableMint || !mintAmount.trim() || !mintCap.trim()) return null;
    try {
      return BigInt(mintAmount.replace(/,/g, '')) * BigInt(mintCap.replace(/,/g, ''));
    } catch {
      return null;
    }
  }, [enableMint, mintAmount, mintCap]);

  const premineBig = useMemo(() => {
    if (!enablePremine || !premine.trim()) return 0n;
    try {
      return BigInt(premine.replace(/,/g, ''));
    } catch {
      return 0n;
    }
  }, [enablePremine, premine]);

  const maxSupplyApprox =
    premineBig + (openMintSupply ?? 0n);
  const explorerLinks = txid ? duneTxExplorerLinks(txid) : [];

  const handleConfirm = async () => {
    setError(null);
    if (!name.trim()) return setError('Ðune name is required');
    if (nameError) return setError(nameError);
    const plainTick = name.trim().replace(/[•.\s]/g, '').toUpperCase();
    const isDmtIssuance = plainTick === 'DOGECOINBITS' || plainTick === 'BITS';
    if (!enablePremine && !enableMint && !isDmtIssuance) {
      return setError('Enable premine and/or open mint — both can be on together');
    }
    if (enablePremine && (!premine.trim() || isNaN(Number(premine.replace(/,/g, ''))))) {
      return setError('Premine amount must be a valid number');
    }
    if (enablePremine && Number(premine.replace(/,/g, '')) <= 0) {
      return setError('Premine must be greater than zero when enabled');
    }
    if (Number(divisibility) < 0 || Number(divisibility) > 38) {
      return setError('Divisibility must be 0-38');
    }
    if (symbol && singleCodePointSymbol(symbol) !== symbol) {
      return setError('Symbol must be a single Unicode character (e.g. Ð or 🐕)');
    }
    if (enableMint) {
      if (!mintAmount.trim()) return setError('Tokens per mint is required when open mint is on');
      if (!mintCap.trim()) return setError('Mint cap is required when open mint is on');
    }
    // Prefer resolveSigner — it knows browser WIF/PSBT even when unified.connected lags
    const resolved = await resolveSigner();
    if (!resolved.ok) {
      return setError(
        resolved.message ||
          'Connect Dojak, Doge Soft, or your in-browser Dojak wallet first.',
      );
    }
    setSigningAddress(resolved.signer.fromAddress);
    setStep('confirm');
  };

  const handleBroadcast = async () => {
    setIsLoading(true);
    setError(null);
    setStep('broadcasting');
    try {
      const resolved = await resolveSigner();
      if (!resolved.ok) throw new Error(resolved.message);
      setSigningAddress(resolved.signer.fromAddress);

      const terms: DuneTerms | undefined = enableMint
        ? {
            amount: BigInt(mintAmount.replace(/,/g, '')),
            cap: BigInt(mintCap.replace(/,/g, '')),
          }
        : undefined;

      const etchParams = {
        name: name.trim(),
        supply: enablePremine ? premine.trim() : '0',
        divisibility: Number(divisibility),
        symbol: symbol.trim() || undefined,
        terms,
        turbo,
        feeRate: feeRateKoinuPerKb,
      };

      const result = await runDuneTxWithWalletApproval({
        resolved,
        preferBrowserApproval: isBrowser,
        title: `Deploy Ðune · ${name.trim()}`,
        description:
          'Approve to sign and broadcast this Ðune etch (OP_RETURN 0xD0) from your Local Browser Wallet — same approval drawer as dogecoin.games.',
        details: [
          { label: 'Ðune', value: name.trim() },
          { label: 'Magic', value: '0xD0 (Ðunes v2)' },
          {
            label: 'Premine',
            value: enablePremine ? premine.trim().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0',
          },
          {
            label: 'Open mint',
            value: enableMint ? `${mintAmount} × ${mintCap}` : 'off',
          },
          { label: 'Network fee', value: formatDojakwebFeeRate(feeRateKoinuPerByte) },
          { label: 'Wallet', value: resolved.signer.fromAddress },
        ],
        approveLabel: 'Approve & deploy',
        runWithLocalWif: (signer) => etchDune({ ...etchParams, signer }),
        runWithResolvedSigner: (signer) => etchDune({ ...etchParams, signer }),
      });

      const nextTxid = result.txid?.trim() || null;
      setTxid(nextTxid);
      if (nextTxid) {
        rememberDuneEtchReceipt({
          name: name.trim(),
          txid: nextTxid,
          address: resolved.signer.fromAddress,
        });
        emitDuneEtchReceipt({
          name: name.trim(),
          txid: nextTxid,
          address: resolved.signer.fromAddress,
        });
      }
      setStep('done');
      if (nextTxid) {
        toast.success('Dune deploy broadcast. Transaction receipt ready.');
        onSuccess?.(nextTxid, {
          op: 'deploy',
          duneName: name.trim(),
          address: resolved.signer.fromAddress,
        });
      } else {
        toast.error('Wallet action finished, but no broadcast txid was returned.');
      }
    } catch (e: unknown) {
      const msg = duneApprovalUserError(e, 'Transaction failed');
      if (msg) setError(msg);
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      {/* Theme tokens — follow light/dark app theme (not forced zinc-950) */}
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-border-primary bg-bg-primary text-text-primary shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Deploy New Ðune (v2 · 0xÐ)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'form' && (
            <>
              <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-text-secondary">
                <p>
                  <strong className="text-text-primary">Any Ðune project.</strong> Instant market = premine float +
                  open mint off → DOGE pool → LP → first swap paints the chart. Flagships are optional presets.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyMarketProfile('instant')}
                    className={cn(
                      'rounded border px-2 py-1 text-[11px] font-medium',
                      marketProfile === 'instant'
                        ? 'border-amber-500/60 bg-amber-500/20 text-text-primary'
                        : 'border-border-primary text-text-secondary hover:text-text-primary',
                    )}
                  >
                    Instant market (recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyMarketProfile('classic')}
                    className={cn(
                      'rounded border px-2 py-1 text-[11px] font-medium',
                      marketProfile === 'classic'
                        ? 'border-amber-500/60 bg-amber-500/20 text-text-primary'
                        : 'border-border-primary text-text-secondary hover:text-text-primary',
                    )}
                  >
                    Classic free mint
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('white')}
                    className="rounded border border-border-primary px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                  >
                    Preset: WHITE
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('manifesto')}
                    className="rounded border border-border-primary px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                  >
                    Preset: manifesto
                  </button>
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-text-primary">
                  Ðune Name <span className="text-amber-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setName(v);
                    const plain = v.replace(/[•.\s]/g, '');
                    if (plain === 'THEWHITEDOGE') applyMarketProfile(marketProfile, plain);
                    else if (plain === 'DOGENALSOVERDOGINALS') applyPreset('manifesto');
                  }}
                  placeholder="e.g. MY•COIN or THE•WHITE•DOGE"
                  className="font-mono"
                />
                {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                <p className="mt-1 text-xs text-text-secondary">
                  A–Z only. Use • or . as spacers. Wire: Ðunes magic <span className="font-mono">0xD0</span>.
                </p>
              </div>

              <div>
                <Label className="mb-1 block text-text-primary">Divisibility (0–38)</Label>
                <Input
                  type="number"
                  min={0}
                  max={38}
                  value={divisibility}
                  onChange={(e) => setDivisibility(e.target.value)}
                />
                <p className="mt-1 text-xs text-text-secondary">
                  0 = whole tokens (recommended for memes). 8 = DOGE-like decimals.
                </p>
              </div>

              <div>
                <Label className="mb-1 block text-text-primary">Symbol (optional)</Label>
                <Input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(singleCodePointSymbol(e.target.value))}
                  placeholder="🐕"
                  className="max-w-[5rem] text-center text-lg font-medium"
                />
                <p className="mt-1 text-xs text-text-secondary">One Unicode character only.</p>
              </div>

              {/* Premine — independent toggle */}
              <div className="space-y-3 rounded-lg border border-border-primary bg-bg-secondary p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Premine to wallet</p>
                    <p className="text-xs text-text-secondary">
                      Tokens you receive at etch (pool seed, rewards, treasury)
                    </p>
                  </div>
                  <Switch
                    checked={enablePremine}
                    onCheckedChange={setEnablePremine}
                    aria-label="Enable premine"
                  />
                </div>
                {enablePremine && (
                  <div>
                    <Label className="mb-1 block text-xs text-text-primary">
                      Premine amount <span className="text-amber-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={premine}
                      onChange={(e) => setPremine(e.target.value)}
                      placeholder="e.g. 42069000"
                      className="font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Open mint — independent toggle */}
              <div className="space-y-3 rounded-lg border border-border-primary bg-bg-secondary p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Open mint</p>
                    <p className="text-xs text-text-secondary">
                      Anyone can mint until mint-count cap is reached
                    </p>
                  </div>
                  <Switch
                    checked={enableMint}
                    onCheckedChange={setEnableMint}
                    aria-label="Enable open mint"
                  />
                </div>
                {enableMint && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1 block text-xs text-text-primary">
                        Tokens per mint <span className="text-amber-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={mintAmount}
                        onChange={(e) => setMintAmount(e.target.value)}
                        placeholder="420"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-text-primary">
                        Max mint count (cap) <span className="text-amber-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={mintCap}
                        onChange={(e) => setMintCap(e.target.value)}
                        placeholder="901479"
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {(enablePremine || enableMint) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-text-secondary">
                  <p className="font-medium text-text-primary">Approx max supply</p>
                  <p className="mt-1 font-mono text-text-primary">
                    {maxSupplyApprox.toLocaleString()}
                    {enablePremine && enableMint
                      ? ` = premine ${premineBig.toLocaleString()} + open ${(openMintSupply ?? 0n).toLocaleString()}`
                      : enablePremine
                        ? ' (premine only)'
                        : ' (open mint only)'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border-primary px-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-medium text-text-primary">
                    Turbo mode
                    <InformationCircleIcon className="h-4 w-4 text-text-secondary" title="Future protocol features" />
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">Optional flag for future Ðunes features</p>
                </div>
                <Switch checked={turbo} onCheckedChange={setTurbo} aria-label="Turbo mode" />
              </div>

              <NetworkFeeControl
                opReturnScriptLen={80}
                inputs={1}
                outputs={enablePremine ? 3 : 2}
                onRateKoinuPerByteChange={setFeeRateKoinuPerByte}
              />

              {connected && address ? (
                <Alert>
                  <AlertDescription className="text-xs text-text-secondary">
                    Ready to sign with{' '}
                    <span className="font-mono text-text-primary">
                      {address.slice(0, 8)}…{address.slice(-6)}
                    </span>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertDescription className="text-xs">
                    Connect Dojak, Doge Soft, or your in-browser Dojak wallet to deploy.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded border border-border-primary py-2 text-sm text-text-secondary transition-colors hover:border-text-primary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 rounded bg-primary-500 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-primary-400"
                >
                  Review
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm">
                <h3 className="mb-3 font-medium text-text-primary">Confirm etch (v2 · 0xÐ)</h3>
                <Row label="Ðune name" value={name.trim()} mono />
                <Row label="Magic" value="0xD0 (Ðunes)" />
                <Row label="Divisibility" value={divisibility} />
                {symbol && <Row label="Symbol" value={symbol} />}
                {enablePremine && (
                  <Row label="Premine" value={Number(premine.replace(/,/g, '')).toLocaleString()} />
                )}
                {enableMint && (
                  <>
                    <Row label="Open mint" value={`${mintAmount} × ${mintCap} mints`} />
                    <Row
                      label="Open mint supply"
                      value={(openMintSupply ?? 0n).toLocaleString()}
                    />
                  </>
                )}
                <Row label="≈ Max supply" value={maxSupplyApprox.toLocaleString()} />
                {turbo && <Row label="Turbo" value="on" />}
                <Row label="Fee rate" value={formatDojakwebFeeRate(feeRateKoinuPerByte)} />
                <Row
                  label="Signing wallet"
                  value={signingAddress ?? address ?? 'Connect wallet'}
                  mono={Boolean(signingAddress ?? address)}
                />
              </div>

              <Alert>
                <AlertDescription className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Direct etch names are claimed on first valid etch and parameters cannot change after. ÐLaunch
                    coins use ÐA identity instead, so duplicate display tickers are allowed there.
                  </span>
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="flex-1 rounded border border-border-primary py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleBroadcast}
                  disabled={isLoading}
                  className="flex-1 rounded bg-primary-500 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-primary-400 disabled:opacity-50"
                >
                  {isLoading ? 'Signing…' : 'Confirm & Deploy'}
                </button>
              </div>
            </>
          )}

          {step === 'broadcasting' && (
            <div className="space-y-3 py-8 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              <p className="text-sm text-text-secondary">Signing and broadcasting…</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {txid ? 'Ðune deploy broadcast (0xÐ)' : 'No broadcast receipt returned'}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {txid ? (
                    <>
                      <strong className="text-text-primary">{name}</strong> submitted. Confirm on dogex after a few
                      blocks.
                    </>
                  ) : (
                    'Check wallet activity before trying again. A deploy is only complete when a txid is returned.'
                  )}
                </p>
              </div>
              {txid ? (
                <div className="rounded border border-border-primary bg-bg-secondary p-3">
                  <p className="mb-1 text-xs text-text-secondary">Transaction ID</p>
                  <p className="break-all font-mono text-xs text-text-primary">{txid}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {explorerLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-border-primary px-3 py-2 text-center text-xs font-medium text-text-primary transition-colors hover:border-primary-500 hover:text-primary-500"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    Broadcast completed without a transaction receipt. Check your wallet activity before trying again.
                  </AlertDescription>
                </Alert>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded bg-primary-500 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-primary-400"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-4">
    <span className="text-text-secondary">{label}</span>
    <span className={cn('text-right text-text-primary break-all', mono && 'font-mono text-xs')}>{value}</span>
  </div>
);
