import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { toast } from 'sonner';
import { etchDune } from '../services/duneService';
import { parseSpacedDune } from '../lib/dunestone';
import type { DuneTerms } from '../lib/dunestone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (txid: string) => void;
}

type Step = 'form' | 'confirm' | 'broadcasting' | 'done';

export const DuneDeployModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { address, walletType } = useUnifiedWallet();
  const browser = useBrowserWallet();

  // Form state
  const [name, setName]               = useState('');
  const [supply, setSupply]           = useState('1000000');
  const [divisibility, setDivisibility] = useState('0');
  const [symbol, setSymbol]           = useState('');
  const [feeRate, setFeeRate]         = useState('1000');
  const [enableMint, setEnableMint]   = useState(false);
  const [mintAmount, setMintAmount]   = useState('');
  const [mintCap, setMintCap]         = useState('');
  const [turbo, setTurbo]             = useState(false);

  // UI state
  const [step, setStep]               = useState<Step>('form');
  const [error, setError]             = useState<string | null>(null);
  const [txid, setTxid]               = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(false);

  const reset = () => {
    setName(''); setSupply('1000000'); setDivisibility('0'); setSymbol('');
    setFeeRate('1000'); setEnableMint(false); setMintAmount(''); setMintCap('');
    setTurbo(false); setStep('form'); setError(null); setTxid(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const nameError = (() => {
    if (!name.trim()) return null;
    try { parseSpacedDune(name.trim()); return null; }
    catch (e: any) { return e.message as string; }
  })();

  const handleConfirm = () => {
    setError(null);
    if (!name.trim()) return setError('Ðune name is required');
    if (nameError) return setError(nameError);
    if (!supply.trim() || isNaN(Number(supply))) return setError('Supply must be a valid number');
    if (Number(divisibility) < 0 || Number(divisibility) > 38) return setError('Divisibility must be 0-38');
    if (symbol && [...symbol].length > 1) return setError('Symbol must be a single character');
    if (enableMint) {
      if (!mintAmount.trim()) return setError('Mint amount per call is required when open-mint is enabled');
      if (!mintCap.trim()) return setError('Mint cap is required when open-mint is enabled');
    }
    setStep('confirm');
  };

  const handleBroadcast = async () => {
    if (walletType !== 'browser') {
      setError('Ðune transactions require the local Dojakweb browser wallet.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setStep('broadcasting');
    try {
      const privateKeyWIF = browser.wallet?.privateKey ?? null;
      if (!privateKeyWIF) {
        throw new Error('Could not retrieve private key. Unlock your wallet and try again.');
      }

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
        fromAddress: address!,
        privateKeyWIF,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

              {/* Symbol */}
              <div>
                <Label className="block mb-1">
                  Symbol (optional)
                </Label>
                <Input
                  type="text"
                  value={symbol}
                  onChange={e => setSymbol([...e.target.value][0] ?? '')}
                  maxLength={2}
                  placeholder="e.g. Ð"
                />
              </div>

              {/* Open-mint toggle */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="enableMint"
                  checked={enableMint}
                  onCheckedChange={(checked) => setEnableMint(checked === true)}
                />
                <label htmlFor="enableMint" className="text-sm text-text-primary">
                  Enable open minting (others can mint tokens)
                </label>
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
              <div className="flex items-center gap-3">
                <Checkbox
                  id="turbo"
                  checked={turbo}
                  onCheckedChange={(checked) => setTurbo(checked === true)}
                />
                <label htmlFor="turbo" className="text-sm text-text-primary flex items-center gap-1">
                  Turbo mode
                  <InformationCircleIcon className="w-4 h-4 text-text-secondary" title="Enables future protocol features; harmless if unused." />
                </label>
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
                    <Row label="Tokens per mint" value={mintAmount} />
                    <Row label="Mint cap" value={mintCap} />
                    <Row label="Total supply" value={`${mintAmount} × ${mintCap} = ${(BigInt(mintAmount.replace(/,/g, '')) * BigInt(mintCap.replace(/,/g, ''))).toLocaleString()}`} />
                  </>
                ) : (
                  <Row label="Premine supply" value={Number(supply).toLocaleString()} />
                )}
                {turbo && <Row label="Turbo" value="enabled" />}
                <Row label="Fee rate" value={`${Number(feeRate).toLocaleString()} koinu/kB`} />
                <Row label="Wallet" value={address ?? ''} mono />
              </div>

              <Alert>
                <AlertDescription className="flex items-start gap-2 text-xs text-yellow-400">
                  <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    This transaction deploys a new Ðune on-chain. Ensure the name is unique and all parameters are correct — Ðune parameters cannot be changed after etching.
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
