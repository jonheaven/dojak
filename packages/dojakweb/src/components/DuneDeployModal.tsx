import React, { useEffect, useMemo, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { etchDune } from '../services/duneService';
import { parseSpacedDune } from '../lib/dunestone';
import type { DuneTerms } from '../lib/dunestone';
import { useDuneTxSigner } from '../hooks/useDuneTxSigner';
import { useDuneWalletConnection } from '../hooks/useDuneWalletConnection';
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

/** THE•WHITE•DOGE liquidity dune tokenomics (div 0 units = whole tokens). */
const WHITE_PRESET = {
  premine: '42069000',
  mintAmount: '420',
  mintCap: '901479',
  divisibility: '0',
  symbol: '🐕',
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
  onSuccess?: (txid: string) => void;
  /** Pre-fill etch name (e.g. DOGENALS•OVER•DOGINALS). */
  initialName?: string;
}

type Step = 'form' | 'confirm' | 'broadcasting' | 'done';

export const DuneDeployModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, initialName }) => {
  const { address, connected } = useDuneWalletConnection();
  const resolveSigner = useDuneTxSigner();

  const plainInitial = (initialName ?? '').replace(/[•.\s]/g, '').toUpperCase();
  const isWhiteDune =
    plainInitial === 'THEWHITEDOGE'
  const isManifesto = plainInitial === 'DOGENALSOVERDOGINALS';

  const [name, setName] = useState(initialName ?? '');
  const [divisibility, setDivisibility] = useState(
    isWhiteDune ? WHITE_PRESET.divisibility : isManifesto ? MANIFESTO_PRESET.divisibility : '0',
  );
  const [symbol, setSymbol] = useState(
    isWhiteDune ? WHITE_PRESET.symbol : isManifesto ? MANIFESTO_PRESET.symbol : '',
  );
  const [feeRate, setFeeRate] = useState('1000');
  // Premine + open mint are independent — both can be on (hero dune pattern)
  const [enablePremine, setEnablePremine] = useState(true);
  const [premine, setPremine] = useState(
    isWhiteDune ? WHITE_PRESET.premine : isManifesto ? MANIFESTO_PRESET.premine : '1000000',
  );
  const [enableMint, setEnableMint] = useState(isWhiteDune || isManifesto);
  const [mintAmount, setMintAmount] = useState(
    isWhiteDune ? WHITE_PRESET.mintAmount : isManifesto ? MANIFESTO_PRESET.mintAmount : '',
  );
  const [mintCap, setMintCap] = useState(
    isWhiteDune ? WHITE_PRESET.mintCap : isManifesto ? MANIFESTO_PRESET.mintCap : '',
  );
  const [turbo, setTurbo] = useState(true);

  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signingAddress, setSigningAddress] = useState<string | null>(null);

  const applyPreset = (kind: 'white' | 'manifesto' | 'clear') => {
    if (kind === 'white') {
      setPremine(WHITE_PRESET.premine);
      setMintAmount(WHITE_PRESET.mintAmount);
      setMintCap(WHITE_PRESET.mintCap);
      setDivisibility(WHITE_PRESET.divisibility);
      setSymbol(WHITE_PRESET.symbol);
      setEnablePremine(true);
      setEnableMint(true);
      setTurbo(true);
    } else if (kind === 'manifesto') {
      setPremine(MANIFESTO_PRESET.premine);
      setMintAmount(MANIFESTO_PRESET.mintAmount);
      setMintCap(MANIFESTO_PRESET.mintCap);
      setDivisibility(MANIFESTO_PRESET.divisibility);
      setSymbol(MANIFESTO_PRESET.symbol);
      setEnablePremine(true);
      setEnableMint(true);
      setTurbo(true);
    }
  };

  const reset = () => {
    const plain = (initialName ?? '').replace(/[•.\s]/g, '').toUpperCase();
    setName(initialName ?? '');
    setFeeRate('1000');
    setStep('form');
    setError(null);
    setTxid(null);
    if (plain === 'THEWHITEDOGE') applyPreset('white');
    else if (plain === 'DOGENALSOVERDOGINALS') applyPreset('manifesto');
    else {
      setPremine('1000000');
      setMintAmount('');
      setMintCap('');
      setDivisibility('0');
      setSymbol('');
      setEnablePremine(true);
      setEnableMint(false);
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

  const handleConfirm = async () => {
    setError(null);
    if (!name.trim()) return setError('Ðune name is required');
    if (nameError) return setError(nameError);
    if (!enablePremine && !enableMint) {
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
          'Connect MyDoge, Dojak, SpookyDoge, or your in-browser Dojak wallet first.',
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

      const result = await etchDune({
        name: name.trim(),
        // Premine amount (0 when premine off)
        supply: enablePremine ? premine.trim() : '0',
        divisibility: Number(divisibility),
        symbol: symbol.trim() || undefined,
        terms,
        turbo,
        feeRate: Number(feeRate),
        signer: resolved.signer,
      });

      setTxid(result.txid ?? null);
      setStep('done');
      toast.success('Ðune deployed (v2 / 0xÐ)!');
      onSuccess?.(result.txid ?? '');
    } catch (e: any) {
      setError(e.message ?? 'Transaction failed');
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
              <p className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-xs text-text-secondary">
                <strong className="text-text-primary">Premine + open mint are independent.</strong> Turn both on for
                hero launches (treasury LP + community mint). Max supply ≈ premine + (tokens per mint × cap).
              </p>

              <div>
                <Label className="mb-1 block text-text-primary">
                  Ðune Name <span className="text-amber-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  placeholder="e.g. THE•WHITE•DOGE"
                  className="font-mono"
                />
                {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                <p className="mt-1 text-xs text-text-secondary">
                  A–Z only. Use • or . as spacers. Wire: Ðunes v2 magic <span className="font-mono">0xD0</span>.
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

              <div>
                <Label className="mb-1 block text-text-primary">Fee rate (koinu/kB)</Label>
                <Input
                  type="number"
                  value={feeRate}
                  onChange={(e) => setFeeRate(e.target.value)}
                  min={100}
                />
                <p className="mt-1 text-xs text-text-secondary">1000 koinu/kB recommended minimum</p>
              </div>

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
                    Connect MyDoge, Dojak, SpookyDoge, or your in-browser Dojak wallet to deploy.
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
                <Row label="Magic" value="0xD0 (Ðunes v2)" />
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
                <Row label="Fee rate" value={`${Number(feeRate).toLocaleString()} koinu/kB`} />
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
                    Name is claimed on first valid etch. Parameters cannot change after. Prefer etching before any
                    public DLaunch marketing so no one snipes the name.
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
                <h3 className="text-lg font-semibold text-text-primary">Ðune deployed (0xÐ)</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  <strong className="text-text-primary">{name}</strong> submitted. Confirm on dogex after a few
                  blocks.
                </p>
              </div>
              {txid && (
                <div className="rounded border border-border-primary bg-bg-secondary p-3">
                  <p className="mb-1 text-xs text-text-secondary">Transaction ID</p>
                  <p className="break-all font-mono text-xs text-text-primary">{txid}</p>
                </div>
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
