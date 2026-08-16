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
import { HARD_DUST_KOINU } from '../lib/dogecoin/softDust';

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
  /**
   * Render inside the Dojakweb wallet chassis (same overlay as signature approval).
   * Use this from the wallet panel — never a page-level modal under the drawer.
   */
  embedded?: boolean;
}

type Step = 'form' | 'lookup' | 'confirm' | 'broadcasting' | 'done';

const DEFAULT_POSTAGE = String(HARD_DUST_KOINU);

export const DuneSendModal: React.FC<Props> = ({
  isOpen,
  onClose,
  holding,
  siblingAccounts = [],
  onSuccess,
  embedded = false,
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

  useEffect(() => {
    if (!embedded || !isOpen) return;
    const chassis = document.querySelector('.ds-wallet-dashboard');
    if (!chassis) return;
    chassis.classList.add('ds-wallet-approval-open');
    return () => {
      chassis.classList.remove('ds-wallet-approval-open');
    };
  }, [embedded, isOpen]);

  const handleConfirm = () => {
    setError(null);
    if (!duneInfo) return setError('Look up a Ðune first');
    if (!recipient.trim()) return setError('Recipient address is required');
    if (recipient.trim() === address) return setError('Recipient must be a different address');
    if (!amount.trim() || Number(amount) <= 0) return setError('Amount must be greater than zero');
    const postageN = Number(postage);
    if (!Number.isFinite(postageN) || postageN < HARD_DUST_KOINU) {
      return setError(`Postage must be at least ${HARD_DUST_KOINU} koinu (0.001 Ð)`);
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
        duneName: duneInfo!.name || holding?.dune || holding?.ticker,
        spacedName: duneInfo!.name || holding?.dune,
        symbol: duneInfo!.symbol || holding?.symbol,
      });

      setTxid(result.txid ?? null);
      setStep('done');
      toast.success('Ðune send broadcast!');
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

  const lockHint = (
    <p className={embedded ? 'ds-wallet-approval__desc' : 'mt-1 text-text-secondary'}>
      Tokens sit on 0.001 Ð carriers (same sentinel as inscriptions). Remainder parks on a
      second 0.001 Ð out to you — leftover DOGE change is plain and spendable. Each 0.001
      out adds +0.01 Ð to the miner fee.
    </p>
  );

  const formBody = (
    <>
      {(step === 'form' || step === 'lookup' || step === 'confirm') &&
        (embedded ? (
          <div className="ds-wallet-approval__unlock">
            <p className="ds-wallet-approval__unlock-title">0.001 Ð inscription lock</p>
            {lockHint}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
            <p className="font-medium text-amber-200">0.001 Ð inscription lock</p>
            {lockHint}
          </div>
        ))}

      {(step === 'form' || step === 'lookup') && (
        <>
          <div>
            <label className={embedded ? 'ds-wallet-approval__section-label' : 'mb-1 block text-sm font-medium text-text-secondary'}>
              Ðune Name <span className="text-yellow-400">*</span>
            </label>
            <div className="mt-1 flex gap-2">
              <Input
                type="text"
                value={inputName}
                onChange={(e) => {
                  setInputName(e.target.value.toUpperCase());
                  setDuneInfo(null);
                }}
                placeholder="e.g. DOGE•COIN"
                className={embedded ? 'ds-wallet-approval__input flex-1 font-mono' : 'flex-1 font-mono'}
              />
              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={isLoading}
                className={
                  embedded
                    ? 'ds-wallet-approval__btn-reject shrink-0 px-3'
                    : 'rounded border border-border-primary bg-bg-secondary px-4 py-2 text-sm text-text-primary transition-colors hover:border-primary-500 disabled:opacity-50'
                }
              >
                {isLoading && step === 'lookup' ? 'Looking…' : 'Look up'}
              </button>
            </div>
          </div>

          {duneInfo && (
            <div className={embedded ? 'ds-wallet-approval__details' : 'space-y-1 rounded-lg border border-border-primary bg-bg-secondary p-3 text-sm'}>
              <div className="flex justify-between gap-3">
                <span className={embedded ? 'ds-wallet-approval__detail-label' : 'text-text-secondary'}>Name</span>
                <span className={embedded ? 'ds-wallet-approval__detail-value font-mono' : 'font-mono text-text-primary'}>{duneInfo.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={embedded ? 'ds-wallet-approval__detail-label' : 'text-text-secondary'}>ID</span>
                <span className={embedded ? 'ds-wallet-approval__detail-value font-mono text-xs' : 'font-mono text-xs text-text-primary'}>{duneInfo.id}</span>
              </div>
              {displayBalance && (
                <div className="flex justify-between gap-3">
                  <span className={embedded ? 'ds-wallet-approval__detail-label' : 'text-text-secondary'}>Your balance</span>
                  <span className={embedded ? 'ds-wallet-approval__detail-value' : 'font-medium text-text-primary'}>
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
                <label className={embedded ? 'ds-wallet-approval__section-label' : 'mb-1 block text-sm font-medium text-text-secondary'}>
                  Amount <span className="text-yellow-400">*</span>
                </label>
                <div className="mt-1 flex gap-2">
                  <Input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`e.g. 100${duneInfo.divisibility > 0 ? '.0' : ''}`}
                    className={embedded ? 'ds-wallet-approval__input flex-1' : 'flex-1'}
                  />
                  {displayBalance && (
                    <button
                      type="button"
                      onClick={() => setAmount(displayBalance)}
                      className={
                        embedded
                          ? 'ds-wallet-approval__btn-reject shrink-0 px-3 text-xs'
                          : 'rounded border border-border-primary px-3 py-2 text-xs text-primary-500 transition-colors hover:bg-bg-secondary'
                      }
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className={embedded ? 'ds-wallet-approval__section-label' : 'mb-1 block text-sm font-medium text-text-secondary'}>
                  Recipient Address <span className="text-yellow-400">*</span>
                </label>
                <Input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="D..."
                  className={embedded ? 'ds-wallet-approval__input mt-1 w-full font-mono' : 'w-full font-mono'}
                />
                {connected && otherSiblings.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="w-full text-[10px] uppercase tracking-wide text-white/45">
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
                            ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                            : 'border-white/10 bg-white/5 text-white/60 hover:border-amber-400/40 hover:text-white'
                        }`}
                      >
                        #{acc.accountIndex}
                        {acc.nickname ? ` · ${acc.nickname}` : ''}
                      </button>
                    ))}
                  </div>
                ) : connected && siblingAccounts.length <= 1 ? (
                  <p className="mt-2 text-[11px] leading-snug text-white/45">
                    No other HD accounts yet. On the wallet dashboard, tap{' '}
                    <span className="font-semibold text-white">+</span> next to account # to
                    derive the next address, then send Ðunes here.
                  </p>
                ) : null}
              </div>

              {!embedded && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Postage (koinu)
                  </label>
                  <Input
                    type="number"
                    value={postage}
                    onChange={(e) => setPostage(e.target.value)}
                    min={HARD_DUST_KOINU}
                    placeholder={DEFAULT_POSTAGE}
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    Default {HARD_DUST_KOINU.toLocaleString()} koinu (0.001 Ð) on the recipient
                    carrier. Remainder uses a matching 0.001 Ð out to you.
                  </p>
                </div>
              )}

              <NetworkFeeControl
                opReturnScriptLen={40}
                inputs={1}
                outputs={4}
                onRateKoinuPerByteChange={setFeeRateKoinuPerByte}
              />
            </>
          )}

          {error && (
            <p className={embedded ? 'ds-wallet-approval__error' : 'text-sm text-red-400'}>{error}</p>
          )}
        </>
      )}

      {step === 'confirm' && duneInfo && (
        <>
          <div className={embedded ? 'ds-wallet-approval__details' : 'space-y-2 rounded-lg bg-bg-secondary p-4 text-sm'}>
            {!embedded && <h3 className="mb-3 font-medium text-text-primary">Confirm Send Transaction</h3>}
            <Row embedded={embedded} label="Ðune" value={duneInfo.name} mono />
            <Row embedded={embedded} label="Ðune ID" value={duneInfo.id} mono />
            <Row embedded={embedded} label="Amount" value={`${amount}${duneInfo.symbol ? ` ${duneInfo.symbol}` : ''}`} />
            <Row embedded={embedded} label="Recipient" value={recipient.trim()} mono />
            <Row embedded={embedded} label="Carrier" value="0.001 Ð × 2 (recipient + remainder)" />
            <Row embedded={embedded} label="Fee rate" value={formatDojakwebFeeRate(feeRateKoinuPerByte)} />
            <Row embedded={embedded} label="From" value={address!} mono />
          </div>

          <div className={embedded ? 'ds-wallet-approval__hint' : 'flex items-start gap-2 rounded bg-yellow-400/10 p-3 text-xs text-yellow-400'}>
            {!embedded && <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            <span>
              Ðune sends are irreversible. Verify the recipient address carefully before confirming.
            </span>
          </div>

          {error && (
            <p className={embedded ? 'ds-wallet-approval__error' : 'text-sm text-red-400'}>{error}</p>
          )}
        </>
      )}

      {step === 'broadcasting' && (
        <div className="space-y-3 py-8 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          <p className={embedded ? 'ds-wallet-approval__desc' : 'text-sm text-text-secondary'}>
            Signing and broadcasting transaction…
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className={embedded ? 'ds-wallet-approval__title' : 'text-lg font-semibold text-text-primary'}>Sent!</h3>
            <p className={embedded ? 'ds-wallet-approval__desc' : 'mt-1 text-sm text-text-secondary'}>
              Broadcast complete. Switch HD account (or refresh) after a confirmation to see the
              balance move.
            </p>
          </div>
          {txid && (
            <div className={embedded ? 'ds-wallet-approval__details' : 'rounded bg-bg-secondary p-3'}>
              <p className={embedded ? 'ds-wallet-approval__detail-label mb-1' : 'mb-1 text-xs text-text-secondary'}>
                Transaction ID
              </p>
              <p className="break-all font-mono text-xs">{txid}</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  const footer =
    step === 'form' || step === 'lookup' ? (
      <>
        <button
          type="button"
          onClick={handleClose}
          className={embedded ? 'ds-wallet-approval__btn-reject' : 'flex-1 rounded border border-border-primary py-2 text-sm text-text-secondary transition-colors hover:text-text-primary'}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!duneInfo}
          className={embedded ? 'ds-wallet-approval__btn-approve' : 'flex-1 rounded bg-primary-500 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-primary-400 disabled:opacity-50'}
        >
          Review
        </button>
      </>
    ) : step === 'confirm' ? (
      <>
        <button
          type="button"
          onClick={() => setStep('form')}
          className={embedded ? 'ds-wallet-approval__btn-reject' : 'flex-1 rounded border border-border-primary py-2 text-sm text-text-secondary transition-colors hover:text-text-primary'}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void handleBroadcast()}
          disabled={isLoading}
          className={embedded ? 'ds-wallet-approval__btn-approve' : 'flex-1 rounded bg-primary-500 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-primary-400 disabled:opacity-50'}
        >
          {isLoading ? 'Signing…' : 'Confirm & Send'}
        </button>
      </>
    ) : step === 'done' ? (
      <button
        type="button"
        onClick={handleClose}
        className={embedded ? 'ds-wallet-approval__btn-approve col-span-2' : 'w-full rounded bg-primary-500 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-primary-400'}
      >
        Close
      </button>
    ) : null;

  if (embedded) {
    return (
      <div className="ds-wallet-approval" role="dialog" aria-modal="true" aria-labelledby="dune-send-title">
        <div className="ds-wallet-approval__header">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="ds-wallet-approval__eyebrow">Local Browser Wallet</p>
              <h2 id="dune-send-title" className="ds-wallet-approval__title">
                Send Ðune
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="ds-wallet-approval__btn-reject !w-auto px-2 py-1"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="ds-wallet-approval__body">{formBody}</div>
        {footer ? <div className="ds-wallet-approval__footer">{footer}</div> : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10150] flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-primary bg-bg-primary text-text-primary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Send Ðune</h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-text-secondary hover:text-text-primary">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">{formBody}</div>
        {footer && step !== 'broadcasting' ? <div className="flex gap-3 px-6 pb-5">{footer}</div> : null}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean; embedded?: boolean }> = ({
  label,
  value,
  mono,
  embedded,
}) => (
  <div className={embedded ? 'ds-wallet-approval__detail-row' : 'flex justify-between gap-4'}>
    <span className={embedded ? 'ds-wallet-approval__detail-label' : 'text-text-secondary'}>{label}</span>
    <span
      className={
        embedded
          ? `ds-wallet-approval__detail-value ${mono ? 'font-mono text-xs' : ''}`
          : `break-all text-right text-text-primary ${mono ? 'font-mono text-xs' : ''}`
      }
    >
      {value}
    </span>
  </div>
);
