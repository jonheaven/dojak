import React, { useEffect, useState } from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { sendDune, smallestUnitsToHuman } from '../services/duneService';
import { friendlyPaymentSendError, isInputsSpentBroadcastError } from '../lib/mempoolSpendOverlay';
import { useDuneTxSigner } from '../hooks/useDuneTxSigner';
import { useDuneWalletConnection } from '../hooks/useDuneWalletConnection';
import { walletDataApi, type DuneHolding, type DuneInfo } from '../utils/api';
import {
  dojakwebFeeRateKoinuPerKbFromPreference,
  formatDojakwebFeeRate,
  koinuPerByteToKoinuPerKb,
} from '../lib/fees/txFeePreference';
import { NetworkFeeControl } from './fees/NetworkFeeControl';
import { Input } from '@/components/ui/input';
import { MIN_PLAIN_PAYMENT_KOINU } from '../lib/dogecoin/softDust';

export interface DuneSendSiblingAccount {
  address: string;
  accountIndex: number;
  nickname?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-populate with a specific holding. */
  holding?: DuneHolding;
  /** Other HD accounts under the same seed — one-tap recipient. */
  siblingAccounts?: DuneSendSiblingAccount[];
  onSuccess?: (txid: string) => void;
}

type Step = 'form' | 'lookup' | 'confirm' | 'broadcasting' | 'done';

const DEFAULT_POSTAGE = String(MIN_PLAIN_PAYMENT_KOINU);

export const DuneSendModal: React.FC<Props> = ({
  isOpen,
  onClose,
  holding,
  siblingAccounts = [],
  onSuccess,
}) => {
  const { address, connected } = useDuneWalletConnection();
  const resolveSigner = useDuneTxSigner();

  const [inputName, setInputName] = useState(holding?.dune ?? holding?.ticker ?? '');
  const [duneInfo, setDuneInfo] = useState<DuneInfo | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [postage, setPostage] = useState(DEFAULT_POSTAGE);
  const [feeRateKoinuPerByte, setFeeRateKoinuPerByte] = useState(
    () => dojakwebFeeRateKoinuPerKbFromPreference() / 1000,
  );
  const feeRateKoinuPerKb = koinuPerByteToKoinuPerKb(feeRateKoinuPerByte);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const divisibility = duneInfo?.divisibility ?? holding?.divisibility ?? 0;
  const displayBalance = holding
    ? smallestUnitsToHuman(BigInt(holding.balance || holding.amount || '0'), divisibility)
    : null;

  const otherSiblings = siblingAccounts.filter(
    (a) => a.address && a.address !== address,
  );

  const reset = () => {
    setInputName(holding?.dune ?? holding?.ticker ?? '');
    setDuneInfo(null);
    setRecipient('');
    setAmount('');
    setPostage(DEFAULT_POSTAGE);
    setFeeRateKoinuPerByte(dojakwebFeeRateKoinuPerKbFromPreference() / 1000);
    setStep('form');
    setError(null);
    setTxid(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const applyLookupResult = (info: DuneInfo) => {
    setDuneInfo(info);
    setStep('form');
  };

  const handleLookup = async (nameOverride?: string) => {
    setError(null);
    const name = (nameOverride ?? inputName).trim();
    if (!name) return setError('Ðune name is required');
    setIsLoading(true);
    setStep('lookup');
    try {
      const info = await walletDataApi.fetchDuneInfo(name);
      if (!info) throw new Error(`Ðune "${name}" not found. Enter the exact Ðune name.`);
      applyLookupResult(info);
    } catch (e: any) {
      setError(e.message ?? 'Failed to look up Ðune');
      setStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-resolve when opened from a holding row (or when duneId is already known).
  useEffect(() => {
    if (!isOpen) return;
    const name = holding?.dune ?? holding?.ticker ?? '';
    setInputName(name);
    setPostage(DEFAULT_POSTAGE);
    setStep('form');
    setError(null);
    setTxid(null);
    setAmount('');
    setRecipient('');

    if (holding?.duneId && holding.divisibility != null) {
      setDuneInfo({
        id: holding.duneId,
        name: holding.dune || holding.ticker || holding.duneId,
        divisibility: holding.divisibility,
        symbol: holding.symbol,
      });
      return;
    }
    if (name) {
      void handleLookup(name);
    } else {
      setDuneInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when modal opens / holding changes
  }, [isOpen, holding?.dune, holding?.ticker, holding?.duneId, holding?.divisibility]);

  const handleConfirm = () => {
    setError(null);
    if (!duneInfo) return setError('Look up a Ðune first');
    if (!recipient.trim()) return setError('Recipient address is required');
    if (recipient.trim() === address) return setError('Recipient must be a different address');
    if (!amount.trim() || Number(amount) <= 0) return setError('Amount must be greater than zero');
    const postageN = Number(postage);
    if (!Number.isFinite(postageN) || postageN < MIN_PLAIN_PAYMENT_KOINU) {
      return setError(`Postage must be at least ${MIN_PLAIN_PAYMENT_KOINU} koinu (0.01 Ð)`);
    }
    setStep('confirm');
  };

  const handleBroadcast = async () => {
    setIsLoading(true);
    setError(null);
    setStep('broadcasting');
    try {
      const resolved = await resolveSigner();
      if (!resolved.ok) throw new Error(resolved.message);

      const result = await sendDune({
        duneId: duneInfo!.id,
        amount: amount.trim(),
        divisibility: duneInfo!.divisibility,
        recipientAddress: recipient.trim(),
        postage: Number(postage),
        feeRate: feeRateKoinuPerKb,
        signer: resolved.signer,
      });

      setTxid(result.txid ?? null);
      setStep('done');
      toast.success('Send transaction broadcast!');
      onSuccess?.(result.txid ?? '');
    } catch (e: any) {
      const raw = e?.message ?? 'Transaction failed';
      setError(
        isInputsSpentBroadcastError(e) || /bad-txns-inputs-spent/i.test(raw)
          ? friendlyPaymentSendError(e)
          : raw,
      );
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-primary bg-bg-primary text-text-primary shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">Send Ðune</h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-text-secondary hover:text-text-primary">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {(step === 'form' || step === 'lookup' || step === 'confirm') && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
              <p className="font-medium text-amber-200">Prevent accidental burns</p>
              <p className="mt-1 text-text-secondary">
                Ðunes ride on UTXOs. This wallet spends the Ðune-bearing outpoints and parks
                remainder on your change (pointer). Confirm recipient + amount before sending.
              </p>
            </div>
          )}
          {(step === 'form' || step === 'lookup') && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Ðune Name <span className="text-yellow-400">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={inputName}
                    onChange={(e) => {
                      setInputName(e.target.value.toUpperCase());
                      setDuneInfo(null);
                    }}
                    placeholder="e.g. DOGE•COIN"
                    className="flex-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLookup()}
                    disabled={isLoading}
                    className="px-4 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-sm hover:border-primary-500 disabled:opacity-50 transition-colors"
                  >
                    {isLoading && step === 'lookup' ? 'Looking…' : 'Look up'}
                  </button>
                </div>
              </div>

              {duneInfo && (
                <div className="bg-bg-secondary rounded-lg p-3 text-sm space-y-1 border border-border-primary">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Name</span>
                    <span className="text-text-primary font-mono">{duneInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">ID</span>
                    <span className="text-text-primary font-mono text-xs">{duneInfo.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Divisibility</span>
                    <span className="text-text-primary">{duneInfo.divisibility}</span>
                  </div>
                  {displayBalance && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Your balance</span>
                      <span className="text-text-primary font-medium">
                        {displayBalance}
                        {duneInfo.symbol ? ` ${duneInfo.symbol}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {duneInfo && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Amount <span className="text-yellow-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`e.g. 100${duneInfo.divisibility > 0 ? '.0' : ''}`}
                        className="flex-1"
                      />
                      {displayBalance && (
                        <button
                          type="button"
                          onClick={() => setAmount(displayBalance)}
                          className="px-3 py-2 text-xs border border-border-primary rounded text-primary-500 hover:bg-bg-secondary transition-colors"
                        >
                          Max
                        </button>
                      )}
                    </div>
                    {duneInfo.divisibility > 0 && (
                      <p className="text-xs text-text-secondary mt-1">
                        Up to {duneInfo.divisibility} decimal places
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Recipient Address <span className="text-yellow-400">*</span>
                    </label>
                    <Input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="D..."
                      className="w-full font-mono"
                    />
                    {connected && otherSiblings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="w-full text-[10px] uppercase tracking-wide text-text-secondary">
                          Your other HD accounts
                        </span>
                        {otherSiblings.map((acc) => (
                          <button
                            key={acc.address}
                            type="button"
                            onClick={() => setRecipient(acc.address)}
                            title={acc.address}
                            className={`rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums transition ${
                              recipient === acc.address
                                ? 'border-primary-500/60 bg-primary-500/15 text-primary-500'
                                : 'border-border-primary bg-bg-secondary text-text-secondary hover:border-primary-500/40 hover:text-text-primary'
                            }`}
                          >
                            #{acc.accountIndex}
                            {acc.nickname ? ` · ${acc.nickname}` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Postage (koinu)
                    </label>
                    <Input
                      type="number"
                      value={postage}
                      onChange={(e) => setPostage(e.target.value)}
                      min={MIN_PLAIN_PAYMENT_KOINU}
                      placeholder={DEFAULT_POSTAGE}
                      className="w-full"
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      Soft-dust safe default: {MIN_PLAIN_PAYMENT_KOINU.toLocaleString()} koinu (0.01 Ð)
                      on the recipient Ðune output.
                    </p>
                  </div>

                  <NetworkFeeControl
                    opReturnScriptLen={40}
                    inputs={1}
                    outputs={3}
                    onRateKoinuPerByteChange={setFeeRateKoinuPerByte}
                  />
                </>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2 border border-border-primary rounded text-text-secondary text-sm hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!duneInfo}
                  className="flex-1 py-2 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-bg-primary rounded text-sm font-medium transition-colors"
                >
                  Review
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && duneInfo && (
            <>
              <div className="bg-bg-secondary rounded-lg p-4 space-y-2 text-sm">
                <h3 className="font-medium text-text-primary mb-3">Confirm Send Transaction</h3>
                <Row label="Ðune" value={duneInfo.name} mono />
                <Row label="Ðune ID" value={duneInfo.id} mono />
                <Row label="Amount" value={`${amount}${duneInfo.symbol ? ` ${duneInfo.symbol}` : ''}`} />
                <Row label="Recipient" value={recipient.trim()} mono />
                <Row label="Postage" value={`${Number(postage).toLocaleString()} koinu`} />
                <Row label="Fee rate" value={formatDojakwebFeeRate(feeRateKoinuPerByte)} />
                <Row label="From" value={address!} mono />
              </div>

              <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded p-3">
                <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Ðune sends are irreversible. Verify the recipient address carefully before confirming.
                </span>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="flex-1 py-2 border border-border-primary rounded text-text-secondary text-sm hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleBroadcast()}
                  disabled={isLoading}
                  className="flex-1 py-2 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-bg-primary rounded text-sm font-medium transition-colors"
                >
                  {isLoading ? 'Signing…' : 'Confirm & Send'}
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
                <h3 className="text-lg font-semibold text-text-primary">Sent!</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Broadcast complete. Switch HD account (or refresh) after a confirmation to see the
                  balance move.
                </p>
              </div>
              {txid && (
                <div className="bg-bg-secondary rounded p-3">
                  <p className="text-xs text-text-secondary mb-1">Transaction ID</p>
                  <p className="font-mono text-xs text-text-primary break-all">{txid}</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-4">
    <span className="text-text-secondary">{label}</span>
    <span className={`text-text-primary text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);
