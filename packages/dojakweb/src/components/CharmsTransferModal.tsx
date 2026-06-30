/**
 * Charms Token Transfer Modal
 *
 * Allows users to transfer Charms tokens to another address.
 */

import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { charmsService } from '../lib/charms';
import type { CharmsToken } from '../lib/charms/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  charmsModalCardClass,
  charmsModalPrimaryBtnClass,
  charmsModalSecondaryBtnClass,
} from './charms/charms-ui-classes';

interface Props {
  isOpen: boolean;
  token?: CharmsToken;
  onClose: () => void;
  onSuccess?: (txid: string) => void;
}

type Step = 'form' | 'confirm' | 'broadcasting' | 'done';

export const CharmsTransferModal: React.FC<Props> = ({ isOpen, token, onClose, onSuccess }) => {
  const { connected, signPSBT } = useUnifiedWallet();

  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = () => {
    setToAddress('');
    setAmount('');
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
    if (!toAddress.trim()) {
      setError('Recipient address is required');
      return false;
    }
    if (!amount.trim() || isNaN(Number(amount))) {
      setError('Amount must be a valid number');
      return false;
    }
    const amountBig = BigInt(Number(amount) * 10 ** (token?.decimals || 8));
    if (token && amountBig > token.balance) {
      setError('Insufficient balance');
      return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (validateForm()) setStep('confirm');
  };

  const handleBroadcast = async () => {
    if (!token) return;
    if (!connected) {
      setError('Connect a Dogecoin wallet before transferring Charms');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('broadcasting');
    try {
      const amountBig = BigInt(Number(amount) * 10 ** token.decimals);
      const resultTxid = await charmsService.transferToken({
        ticker: token.ticker,
        fromAddress: token.address,
        fromUtxo: `${token.txid}:${token.vout}`,
        toAddress: toAddress.trim(),
        amount: amountBig,
        chainId: token.chainId,
        signer: { signPsdt: signPSBT },
      });

      setTxid(resultTxid);
      setStep('done');
      onSuccess?.(resultTxid);
      toast?.success(`Transferred ${amount} ${token.ticker}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to transfer token';
      console.error('Failed to transfer token:', err);
      setError(message);
      setStep('form');
      toast?.error(`Transfer failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) return null;

  const maxAmount = (token.balance / BigInt(10 ** token.decimals)).toString();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md border-[var(--ds-border-strong)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--ds-text)]">Transfer {token.ticker}</DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className={`${charmsModalCardClass} p-3`}>
              <p className="mb-1 text-xs text-[var(--ds-text-muted)]">Available Balance</p>
              <p className="text-lg font-semibold text-[var(--ds-text)]">
                {maxAmount} {token.ticker}
              </p>
            </div>

            <div>
              <Label className="mb-1 block text-[var(--ds-text)]">Recipient Address</Label>
              <Input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="Enter recipient address"
              />
            </div>

            <div>
              <Label className="mb-1 block text-[var(--ds-text)]">Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  step="0.00000001"
                  className="flex-1"
                />
                <button type="button" onClick={() => setAmount(maxAmount)} className={charmsModalSecondaryBtnClass}>
                  Max
                </button>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
                <InformationCircleIcon className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={handleClose} className={charmsModalSecondaryBtnClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!toAddress.trim() || !amount.trim()}
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
                <span className="text-[var(--ds-text-muted)]">From:</span>
                <span className="break-all font-mono text-xs text-[var(--ds-text)]">{token.address}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--ds-text-muted)]">To:</span>
                <span className="break-all font-mono text-xs text-[var(--ds-text)]">{toAddress}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--ds-text-muted)]">Amount:</span>
                <span className="font-medium text-[var(--ds-text)]">
                  {amount} {token.ticker}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('form')} className={charmsModalSecondaryBtnClass}>
                Back
              </button>
              <button type="button" onClick={handleBroadcast} disabled={isLoading} className={charmsModalPrimaryBtnClass}>
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {step === 'broadcasting' && (
          <div className="space-y-4 text-center">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 rounded-full border-4 border-[var(--ds-accent-ring)] border-t-[var(--ds-accent-solid)]" />
            </div>
            <p className="text-sm text-[var(--ds-text-muted)]">Sending transaction...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-600 dark:text-green-500">✓ Transfer successful!</p>
            </div>
            {txid && (
              <div className={charmsModalCardClass}>
                <p className="mb-1 text-xs text-[var(--ds-text-muted)]">Transaction ID:</p>
                <p className="break-all font-mono text-sm text-[var(--ds-text)]">{txid}</p>
              </div>
            )}
            <button type="button" onClick={handleClose} className={`w-full ${charmsModalPrimaryBtnClass}`}>
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
