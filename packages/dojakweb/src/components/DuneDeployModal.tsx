import React, { useEffect, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { toast } from 'sonner';
import { etchDune } from '../services/duneService';
import { parseSpacedDune } from '../lib/dunestone';
import type { DuneTerms } from '../lib/dunestone';
import { useDuneTxSigner } from '../hooks/useDuneTxSigner';
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (txid: string) => void;
  /** Pre-fill etch name (e.g. DOGENALS•OVER•DOGINALS). */
  initialName?: string;
}

type Step = 'form' | 'confirm' | 'broadcasting' | 'done';

export const DuneDeployModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, initialName }) => {
  const { address, connected } = useUnifiedWallet();
  const resolveSigner = useDuneTxSigner();

  // Form state — flagship THE•BLACK•DOGE defaults when prefilled (see dogenals/docs/THE_BLACK_DOGE.md)
  const isFlagship =
    (initialName ?? '').replace(/[•.\s]/g, '').toUpperCase() === 'THEBLACKDOGE';
  const [name, setName]               = useState(initialName ?? '');
  const [supply, setSupply]           = useState(isFlagship ? '50000000' : '1000000');
  const [divisibility, setDivisibility] = useState('0');
  const [symbol, setSymbol]           = useState(isFlagship ? '🐕' : '');
  const [feeRate, setFeeRate]         = useState('1000');
  const [enableMint, setEnableMint]   = useState(isFlagship);
  const [mintAmount, setMintAmount]   = useState(isFlagship ? '1000' : '');
  const [mintCap, setMintCap]         = useState(isFlagship ? '950000' : '');
  const [turbo, setTurbo]             = useState(false);

  // UI state
  const [step, setStep]               = useState<Step>('form');
  const [error, setError]             = useState<string | null>(null);
  const [txid, setTxid]               = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [signingAddress, setSigningAddress] = useState<string | null>(null);

  const reset = () => {
    const flagship =
      (initialName ?? '').replace(/[•.\s]/g, '').toUpperCase() === 'THEBLACKDOGE';
    setName(initialName ?? '');
    setSupply(flagship ? '50000000' : '1000000');
    setDivisibility('0');
    setSymbol(flagship ? '🐕' : '');
    setFeeRate('1000');
    setEnableMint(flagship);
    setMintAmount(flagship ? '1000' : '');
    setMintCap(flagship ? '950000' : '');
    setTurbo(false);
    setStep('form');
    setError(null);
    setTxid(null);
  };

  const handleClose = () => { reset(); onClose(); };

  useEffect(() => {
    if (isOpen && initialName?.trim()) {
      const n = initialName.trim().toUpperCase();
      setName(n);
      if (n.replace(/[•.\s]/g, '') === 'THEBLACKDOGE') {
        setSupply('50000000');
        setSymbol('🐕');
        setEnableMint(true);
        setMintAmount('1000');
        setMintCap('950000');
        setDivisibility('0');
      }
    }
  }, [isOpen, initialName]);

  const nameError = (() => {
    if (!name.trim()) return null;
    try { parseSpacedDune(name.trim()); return null; }
    catch (e: any) { return e.message as string; }
  })();

  const handleConfirm = async () => {
    setError(null);
    if (!name.trim()) return setError('Ðune name is required');
    if (nameError) return setError(nameError);
    if (!enableMint && (!supply.trim() || isNaN(Number(supply)))) return setError('Supply must be a valid number');
    if (Number(divisibility) < 0 || Number(divisibility) > 38) return setError('Divisibility must be 0-38');
    if (symbol && singleCodePointSymbol(symbol) !== symbol) {
      return setError('Symbol must be a single Unicode character (e.g. Ð or 🐕, not Ð>Ð)');
    }
    if (enableMint) {
      if (!mintAmount.trim()) return setError('Mint amount per call is required when open-mint is enabled');
      if (!mintCap.trim()) return setError('Mint cap is required when open-mint is enabled');
    }
    if (!connected || !address) {
      return setError('Connect MyDoge, Dojak, SpookyDoge, or your in-browser Dojak wallet first.');
    }

    const resolved = await resolveSigner();
    if (!resolved.ok) return setError(resolved.message);
    setSigningAddress(resolved.signer.fromAddress);
    setStep('confirm');
  };

  const handleBroadcast = async () => {
    setIsLoading(true);
    setError(null);
    setStep('broadcasting');
    try {
      const resolved = await resolveSigner();
      if (!resolved.ok) {
        throw new Error(resolved.message);
      }
      setSigningAddress(resolved.signer.fromAddress);

      const terms: DuneTerms | undefined = enableMint ? {
        amount: BigInt(mintAmount.replace(/,/g, '')),
        cap: BigInt(mintCap.replace(/,/g, '')),
      } : undefined;

      const result = await etchDune({
        name: name.trim(),
        supply: enableMint ? '0' : supply.trim(),
        divisibility: Number(divisibility),
        symbol: symbol.trim() || undefined,
        terms,
        turbo,
        feeRate: Number(feeRate),
        signer: resolved.signer,
      });

      setTxid(result.txid ?? null);
      setStep('done');
      toast.success('Ðune deployed successfully!');
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle>Deploy New Ðune</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'form' && (
            <>
              {/* Name */}
              <div>
                <Label className="block mb-1">
                  Ðune Name <span className="text-yellow-400">*</span>
                </Label>
                <Input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value.toUpperCase())}
                  placeholder="e.g. DOGE•COIN or DOGECOIN"
                  className="font-mono"
                />
                {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
                <p className="text-xs text-text-secondary mt-1">
                  Uppercase A-Z only. Use • or . as spacers (e.g. DOGE•COIN).
                </p>
              </div>

              {/* Divisibility */}
              <div>
                <Label className="block mb-1">
                  Divisibility (0–38)
                </Label>
                <Input
                  type="number"
                  min={0} max={38}
                  value={divisibility}
                  onChange={e => setDivisibility(e.target.value)}
                />
                <p className="text-xs text-text-secondary mt-1">
                  Decimal places. 0 = whole tokens only. 8 = like DOGE.
                </p>
              </div>

              {/* Symbol — protocol allows one code point only (same as Bitcoin Runes) */}
              <div>
                <Label className="block mb-1">
                  Symbol (optional)
                </Label>
                <Input
                  type="text"
                  value={symbol}
                  onChange={e => setSymbol(singleCodePointSymbol(e.target.value))}
                  placeholder="e.g. Ð"
                  className="max-w-[5rem] text-center text-lg font-medium"
                />
                <p className="text-xs text-text-secondary mt-1">
                  One Unicode character only — how wallets display balances (like 🐕 on DOG Runes).
                  Not a ticker; <span className="text-text-primary">Ð&gt;Ð</span> cannot be encoded on-chain.
                </p>
              </div>

              {/* Supply mode — premine vs open mint */}
              <div>
                <Label className="block mb-2">How is supply created?</Label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
                  <button
                    type="button"
                    onClick={() => setEnableMint(false)}
                    className={cn(
                      'rounded-md px-3 py-2.5 text-left transition-colors',
                      !enableMint
                        ? 'bg-amber-500/20 text-zinc-100 ring-1 ring-amber-500/40'
                        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200',
                    )}
                  >
                    <span className="block text-sm font-medium">Premine to wallet</span>
                    <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                      Fixed supply — all tokens to you at etch
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnableMint(true)}
                    className={cn(
                      'rounded-md px-3 py-2.5 text-left transition-colors',
                      enableMint
                        ? 'bg-amber-500/20 text-zinc-100 ring-1 ring-amber-500/40'
                        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200',
                    )}
                  >
                    <span className="block text-sm font-medium">Open mint</span>
                    <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                      Anyone mints until cap is reached
                    </span>
                  </button>
                </div>
              </div>

              {enableMint ? (
                <div className="space-y-3 border border-border-primary rounded p-3 bg-bg-secondary">
                  <p className="text-xs text-text-secondary">
                    With open minting, anyone can call mint to receive tokens. Supply is cap × amount.
                  </p>
                  <div>
                    <Label className="block mb-1 text-xs">
                      Tokens per mint <span className="text-yellow-400">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={mintAmount}
                      onChange={e => setMintAmount(e.target.value)}
                      placeholder="e.g. 1000"
                    />
                  </div>
                  <div>
                    <Label className="block mb-1 text-xs">
                      Max mint count (cap) <span className="text-yellow-400">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={mintCap}
                      onChange={e => setMintCap(e.target.value)}
                      placeholder="e.g. 1000"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="block mb-1">
                    Total Supply <span className="text-yellow-400">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={supply}
                    onChange={e => setSupply(e.target.value)}
                    placeholder="e.g. 1000000"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Human-readable units. All tokens are premined to your wallet.
                  </p>
                </div>
              )}

              {/* Turbo */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary flex items-center gap-1">
                    Turbo mode
                    <InformationCircleIcon className="w-4 h-4 text-text-secondary" title="Enables future protocol features; harmless if unused." />
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Optional Runes-compatible flag for future features
                  </p>
                </div>
                <Switch
                  checked={turbo}
                  onCheckedChange={setTurbo}
                  aria-label="Turbo mode"
                />
              </div>

              {/* Fee rate */}
              <div>
                <Label className="block mb-1">
                  Fee Rate (koinu/kB)
                </Label>
                <Input
                  type="number"
                  value={feeRate}
                  onChange={e => setFeeRate(e.target.value)}
                  min={100}
                />
                <p className="text-xs text-text-secondary mt-1">1000 koinu/kB ≈ 1 sat/byte (recommended minimum)</p>
              </div>

              {!connected && (
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
                <button onClick={handleClose} className="flex-1 py-2 border border-border-primary rounded text-text-secondary hover:text-text-primary hover:border-text-primary text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirm} className="flex-1 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded text-sm font-medium transition-colors">
                  Review
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="bg-bg-secondary rounded-lg p-4 space-y-2 text-sm">
                <h3 className="font-medium text-text-primary mb-3">Confirm Etch Transaction</h3>
                <Row label="Ðune name" value={name.trim()} mono />
                <Row label="Divisibility" value={divisibility} />
                {symbol && <Row label="Symbol" value={symbol} />}
                {enableMint ? (
                  <>
                    <Row label="Distribution" value="Open mint" />
                    <Row label="Tokens per mint" value={mintAmount} />
                    <Row label="Mint cap" value={mintCap} />
                    <Row label="Total supply" value={`${mintAmount} × ${mintCap} = ${(BigInt(mintAmount.replace(/,/g, '')) * BigInt(mintCap.replace(/,/g, ''))).toLocaleString()}`} />
                  </>
                ) : (
                  <>
                    <Row label="Distribution" value="Premine to wallet" />
                    <Row label="Premine supply" value={Number(supply).toLocaleString()} />
                  </>
                )}
                {turbo && <Row label="Turbo" value="enabled" />}
                <Row label="Fee rate" value={`${Number(feeRate).toLocaleString()} koinu/kB`} />
                <Row
                  label="Signing wallet"
                  value={signingAddress ?? address ?? 'Connect wallet'}
                  mono={Boolean(signingAddress ?? address)}
                />
              </div>

              <Alert>
                <AlertDescription className="flex items-start gap-2 text-xs text-yellow-400">
                  <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Extension wallets will prompt you to sign a PSBT. In-browser wallets sign locally.
                    Ðune parameters cannot be changed after etching.
                  </span>
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('form')} className="flex-1 py-2 border border-border-primary rounded text-text-secondary hover:text-text-primary text-sm transition-colors">
                  Back
                </button>
                <button
                  onClick={handleBroadcast}
                  disabled={isLoading}
                  className="flex-1 py-2 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-bg-primary rounded text-sm font-medium transition-colors"
                >
                  {isLoading ? 'Signing…' : 'Confirm & Deploy'}
                </button>
              </div>
            </>
          )}

          {step === 'broadcasting' && (
            <div className="text-center py-8 space-y-3">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-secondary text-sm">Signing and broadcasting transaction…</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Ðune Deployed!</h3>
                <p className="text-sm text-text-secondary mt-1">Your Ðune <strong>{name}</strong> has been submitted to the network.</p>
              </div>
              {txid && (
                <div className="bg-bg-secondary rounded p-3">
                  <p className="text-xs text-text-secondary mb-1">Transaction ID</p>
                  <p className="font-mono text-xs text-text-primary break-all">{txid}</p>
                </div>
              )}
              <button onClick={handleClose} className="w-full py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded text-sm font-medium transition-colors">
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
    <span className={`text-text-primary text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);
