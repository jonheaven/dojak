/**
 * Charms Token Transfer Modal
 * 
 * Allows users to transfer Charms tokens to another address.
 */

import React, { useState } from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { charmsService } from '../lib/charms';
import type { CharmsToken } from '../lib/charms/types';

interface Props {
  isOpen: boolean;
  token?: CharmsToken;
  onClose: () => void;
  onSuccess?: (txid: string) => void;
}

type Step = 'form' | 'confirm' | 'broadcasting' | 'done';

export const CharmsTransferModal: React.FC<Props> = ({
  isOpen,
  token,
  onClose,
  onSuccess,
}) => {
  const { connected, signPSBT } = useUnifiedWallet();

  // Form state
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');

  // UI state
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
    if (validateForm()) {
      setStep('confirm');
    }
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
      // Prepare transfer transaction
      const amountBig = BigInt(Number(amount) * 10 ** token.decimals);
      const txid = await charmsService.transferToken({
        ticker: token.ticker,
        fromAddress: token.address,
        fromUtxo: `${token.txid}:${token.vout}`,
        toAddress: toAddress.trim(),
        amount: amountBig,
        chainId: token.chainId,
        signer: { signPsdt: signPSBT },
      });

      setTxid(txid);
      setStep('done');

      if (onSuccess) {
        onSuccess(txid);
      }
      toast?.success(`Transferred ${amount} ${token.ticker}`);
    } catch (err: any) {
      console.error('Failed to transfer token:', err);
      setError(err.message || 'Failed to transfer token');
      setStep('form');
      toast?.error(`Transfer failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !token) return null;

  const maxAmount = (token.balance / BigInt(10 ** token.decimals)).toString();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-primary border border-border-primary rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">
            Transfer {token.ticker}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-bg-secondary rounded transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'form' && (
            <div className="space-y-4">
              <div className="p-3 bg-bg-secondary border border-border-primary rounded">
                <p className="text-xs text-text-secondary mb-1">Available Balance</p>
                <p className="text-lg font-semibold text-text-primary">
                  {maxAmount} {token.ticker}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder="Enter recipient address"
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Amount
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    step="0.00000001"
                    className="flex-1 px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary-500"
                  />
                  <button
                    onClick={() => setAmount(maxAmount)}
                    className="px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-sm hover:border-primary-500 transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
                  <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
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
                  disabled={!toAddress.trim() || !amount.trim()}
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
                  <span className="text-text-secondary">From:</span>
                  <span className="text-text-primary font-mono text-xs break-all">
                    {token.address}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">To:</span>
                  <span className="text-text-primary font-mono text-xs break-all">
                    {toAddress}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Amount:</span>
                  <span className="text-text-primary font-medium">
                    {amount} {token.ticker}
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
                  {isLoading ? 'Sending...' : 'Send'}
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
              <p className="text-text-secondary text-sm">Sending transaction...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
                <p className="text-green-500 text-sm">
                  ✓ Transfer successful!
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
      </div>
    </div>
  );
};
