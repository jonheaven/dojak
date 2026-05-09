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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Charms Token</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div>
          {step === 'form' && (
            <div className="space-y-4">
              <div>
                <Label className="block mb-1">
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
                <Label className="block mb-1">
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
                  <Label className="block mb-1">
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
                  <Label className="block mb-1">
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
                <Label className="block mb-1">
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
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary hover:border-primary-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!ticker.trim() || !name.trim()}
                  className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-bg-secondary border border-border-primary rounded space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Ticker:</span>
                  <span className="text-text-primary font-medium">{ticker}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Name:</span>
                  <span className="text-text-primary font-medium">{name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Supply:</span>
                  <span className="text-text-primary font-medium">
                    {Number(supply).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Decimals:</span>
                  <span className="text-text-primary font-medium">{decimals}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Chain:</span>
                  <span className="text-text-primary font-medium">
                    {CHARMS_CHAIN_CONFIG[chainId].name}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 px-4 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary hover:border-primary-500 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleBroadcast}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {step === 'broadcasting' && (
            <div className="space-y-4 text-center">
              <div className="inline-block">
                <div className="animate-spin">
                  <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full" />
                </div>
              </div>
              <p className="text-text-secondary text-sm">Creating your Charms token...</p>
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
                <div className="p-3 bg-bg-secondary border border-border-primary rounded">
                  <p className="text-xs text-text-secondary mb-1">Transaction ID:</p>
                  <p className="text-sm font-mono text-text-primary break-all">{txid}</p>
                </div>
              )}
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
