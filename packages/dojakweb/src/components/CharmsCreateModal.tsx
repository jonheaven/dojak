/**
 * Charms Token Creation Modal
 *
 * Allows users to create a new Charms token on the supported blockchain.
 */

import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { charmsService } from '../lib/charms';
import type { CharmsChainId } from '../lib/charms/types';
import { CHARMS_CHAIN_CONFIG, CharmsAppTag } from '../lib/charms/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  charmsModalCardClass,
  charmsModalPrimaryBtnClass,
  charmsModalSecondaryBtnClass,
} from './charms/charms-ui-classes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (txid: string, ticker: string) => void;
}

type Step = 'form' | 'confirm' | 'broadcasting' | 'done';

export const CharmsCreateModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { address, connected, signPSBT } = useUnifiedWallet();

  // Form state
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [supply, setSupply] = useState('1000000');
  const [decimals, setDecimals] = useState('8');
  const [chainId, setChainId] = useState<CharmsChainId>('doge');

  // UI state
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = () => {
    setTicker('');
    setName('');
    setSupply('1000000');
    setDecimals('8');
    setChainId('doge');
    setStep('form');
    setError(null);
    setTxid(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateForm = () => {
    setError(null);
    if (!ticker.trim()) {
      setError('Ticker is required');
      return false;
    }
    if (ticker.length > 10) {
      setError('Ticker must be 10 characters or less');
      return false;
    }
    if (!name.trim()) {
      setError('Token name is required');
      return false;
    }
    if (!supply.trim() || isNaN(Number(supply))) {
      setError('Supply must be a valid number');
      return false;
    }
    if (Number(decimals) < 0 || Number(decimals) > 18) {
      setError('Decimals must be 0-18');
      return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (validateForm()) {
      setStep('confirm');
    }
  };

  const handleBroadcast = async () => {
    if (!connected || !address) {
      setError('Connect a Dogecoin wallet before creating a Charms token');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('broadcasting');
    try {
      const txid = await charmsService.mintToken({
        ticker: ticker.trim(),
        supply: BigInt(supply.replace(/,/g, '')),
        decimals: Number(decimals),
        chainId,
        address,
        metadata: {
          name: name.trim(),
          ticker: ticker.trim(),
          decimals: Number(decimals),
        },
        signer: { signPsdt: signPSBT },
      });

      setTxid(txid);
      setStep('done');

      if (onSuccess) {
        onSuccess(txid, ticker.trim());
      }
      toast?.success(`Token "${ticker}" created successfully!`);
    } catch (err: any) {
      console.error('Failed to create token:', err);
      setError(err.message || 'Failed to create token');
      setStep('form');
      toast?.error(`Failed to create token: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md border-[var(--ds-border-strong)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--ds-text)]">Create Charms Token</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div>
          {step === 'form' && (
            <div className="space-y-4">
              <div>
                <Label className="mb-1 block text-[var(--ds-text)]">
                  Token Ticker
                </Label>
                <Input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="e.g., JAWN"
                  maxLength={10}
                />
              </div>

              <div>
                <Label className="mb-1 block text-[var(--ds-text)]">
                  Token Name
                </Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Jawn Token"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-[var(--ds-text)]">
                    Supply
                  </Label>
                  <Input
                    type="number"
                    value={supply}
                    onChange={(e) => setSupply(e.target.value)}
                    placeholder="1000000"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-[var(--ds-text)]">
                    Decimals
                  </Label>
                  <Input
                    type="number"
                    value={decimals}
                    onChange={(e) => setDecimals(e.target.value)}
                    min="0"
                    max="18"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-[var(--ds-text)]">
                  Blockchain
                </Label>
                <Select value={chainId} onValueChange={(v) => setChainId(v as CharmsChainId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHARMS_CHAIN_CONFIG).map(([chain, config]) => (
                      <SelectItem key={chain} value={chain}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 pt-4">
                <button onClick={handleClose} className={charmsModalSecondaryBtnClass}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!ticker.trim() || !name.trim()}
                  className={charmsModalPrimaryBtnClass}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className={`${charmsModalCardClass} space-y-2`}>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--ds-text-muted)]">Ticker:</span>
                  <span className="font-medium text-[var(--ds-text)]">{ticker}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--ds-text-muted)]">Name:</span>
                  <span className="font-medium text-[var(--ds-text)]">{name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--ds-text-muted)]">Supply:</span>
                  <span className="font-medium text-[var(--ds-text)]">
                    {Number(supply).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--ds-text-muted)]">Decimals:</span>
                  <span className="font-medium text-[var(--ds-text)]">{decimals}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--ds-text-muted)]">Chain:</span>
                  <span className="font-medium text-[var(--ds-text)]">
                    {CHARMS_CHAIN_CONFIG[chainId].name}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('form')} className={charmsModalSecondaryBtnClass}>
                  Back
                </button>
                <button onClick={handleBroadcast} disabled={isLoading} className={charmsModalPrimaryBtnClass}>
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {step === 'broadcasting' && (
            <div className="space-y-4 text-center">
              <div className="inline-block">
                <div className="animate-spin">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--ds-accent-ring)] border-t-[var(--ds-accent-solid)]" />
                </div>
              </div>
              <p className="text-sm text-[var(--ds-text-muted)]">Creating your Charms token...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
                <p className="text-green-500 text-sm">
                  ✓ Token created successfully!
                </p>
              </div>
              {txid && (
                <div className={charmsModalCardClass}>
                  <p className="mb-1 text-xs text-[var(--ds-text-muted)]">Transaction ID:</p>
                  <p className="break-all font-mono text-sm text-[var(--ds-text)]">{txid}</p>
                </div>
              )}
              <button onClick={handleClose} className={`w-full ${charmsModalPrimaryBtnClass}`}>
                Done
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
