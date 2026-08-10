import React, { useState } from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { mintDune } from '../services/duneService';
import { useDuneTxSigner } from '../hooks/useDuneTxSigner';
import { useDuneWalletConnection } from '../hooks/useDuneWalletConnection';
import { walletDataApi, type DuneInfo } from '../utils/api';
import {
  dojakwebFeeRateKoinuPerKbFromPreference,
  formatDojakwebFeeRate,
  koinuPerByteToKoinuPerKb,
} from '../lib/fees/txFeePreference';
import { NetworkFeeControl } from './fees/NetworkFeeControl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-populate with a specific dune name. */
  duneName?: string;
  onSuccess?: (txid: string) => void;
}

type Step = 'form' | 'lookup' | 'confirm' | 'broadcasting' | 'done';

export const DuneMintModal: React.FC<Props> = ({ isOpen, onClose, duneName, onSuccess }) => {
  const { address, connected } = useDuneWalletConnection();
  const resolveSigner = useDuneTxSigner();

  const [inputName, setInputName]       = useState(duneName ?? '');
  const [duneInfo, setDuneInfo]         = useState<DuneInfo | null>(null);
  const [destination, setDestination]   = useState('');
  const [postage, setPostage]           = useState('100000');
  const [feeRateKoinuPerByte, setFeeRateKoinuPerByte] = useState(
    () => dojakwebFeeRateKoinuPerKbFromPreference() / 1000,
  );
  const feeRateKoinuPerKb = koinuPerByteToKoinuPerKb(feeRateKoinuPerByte);
  const [step, setStep]                 = useState<Step>('form');
  const [error, setError]               = useState<string | null>(null);
  const [txid, setTxid]                 = useState<string | null>(null);
  const [isLoading, setIsLoading]       = useState(false);

  const reset = () => {
    setInputName(duneName ?? ''); setDuneInfo(null); setDestination('');
    setPostage('100000'); setFeeRateKoinuPerByte(dojakwebFeeRateKoinuPerKbFromPreference() / 1000);
    setStep('form'); setError(null); setTxid(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleLookup = async () => {
    setError(null);
    const name = inputName.trim();
    if (!name) return setError('Ðune name is required');
    setIsLoading(true);
    setStep('lookup');
    try {
      const info = await walletDataApi.fetchDuneInfo(name);
      if (!info) {
        throw new Error(`Ðune "${name}" not found. Check the name and try again.`);
      }
      if (!info.mintable && !info.terms) {
        throw new Error(`Ðune "${info.name}" is not open for minting (no mint terms).`);
      }
      setDuneInfo(info);
      setStep('form');
    } catch (e: any) {
      setError(e.message ?? 'Failed to look up dune');
      setStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    setError(null);
    if (!duneInfo) return setError('Look up a dune first');
    const dest = destination.trim() || address;
    if (!dest) return setError('Destination address is required');
    const postageNum = Number(postage);
    if (!Number.isFinite(postageNum) || postageNum < 1_000_000) {
      return setError('Postage must be at least 1,000,000 koinu (0.01 DOGE) — Dogecoin soft dust');
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

      const result = await mintDune({
        duneId: duneInfo!.id,
        destination: destination.trim() || resolved.signer.fromAddress,
        postage: Number(postage),
        feeRate: feeRateKoinuPerKb,
        signer: resolved.signer,
      });

      setTxid(result.txid ?? null);
      setStep('done');
      toast.success('Mint transaction broadcast!');
      onSuccess?.(result.txid ?? '');
    } catch (e: any) {
      setError(e.message ?? 'Transaction failed');
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-primary bg-bg-primary text-text-primary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Mint Ðune</h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-text-secondary hover:text-text-primary">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {(step === 'form' || step === 'lookup') && (
            <>
              {/* Dune name lookup */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Ðune Name <span className="text-yellow-400">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={inputName}
                    onChange={e => { setInputName(e.target.value.toUpperCase()); setDuneInfo(null); }}
                    placeholder="e.g. DOGE•COIN"
                    className="flex-1 font-mono"
                  />
                  <button
                    onClick={handleLookup}
                    disabled={isLoading}
                    className="px-4 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-sm hover:border-primary-500 disabled:opacity-50 transition-colors"
                  >
                    {isLoading && step === 'lookup' ? 'Looking…' : 'Look up'}
                  </button>
                </div>
              </div>

              {/* Dune info card */}
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
                  {duneInfo.symbol && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Symbol</span>
                      <span className="text-text-primary">{duneInfo.symbol}</span>
                    </div>
                  )}
                  {duneInfo.terms?.amount && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Tokens per mint</span>
                      <span className="text-text-primary">{Number(duneInfo.terms.amount).toLocaleString()}</span>
                    </div>
                  )}
                  {duneInfo.terms?.cap && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mint cap</span>
                      <span className="text-text-primary">{Number(duneInfo.terms.cap).toLocaleString()}</span>
                    </div>
                  )}
                  {duneInfo.mints && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mints so far</span>
                      <span className="text-text-primary">{Number(duneInfo.mints).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {duneInfo && (
                <>
                  {/* Destination */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Destination Address
                    </label>
                    <Input
                      type="text"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      placeholder={address ?? 'Leave empty to use your wallet address'}
                      className="w-full font-mono"
                    />
                  </div>

                  {/* Postage */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Postage (koinu)
                    </label>
                    <Input
                      type="number"
                      value={postage}
                      onChange={e => setPostage(e.target.value)}
                      min={100000}
                      className="w-full"
                    />
                    <p className="text-xs text-text-secondary mt-1">Minimum 100,000 (0.001 DOGE). Attached to the Ðune output.</p>
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
                <button onClick={handleClose} className="flex-1 py-2 border border-border-primary rounded text-text-secondary text-sm hover:text-text-primary transition-colors">
                  Cancel
                </button>
                <button
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
                <h3 className="font-medium text-text-primary mb-3">Confirm Mint Transaction</h3>
                <Row label="Ðune" value={duneInfo.name} mono />
                <Row label="Ðune ID" value={duneInfo.id} mono />
                {duneInfo.terms?.amount && <Row label="Tokens received" value={Number(duneInfo.terms.amount).toLocaleString()} />}
                <Row label="Destination" value={destination.trim() || address!} mono />
                <Row label="Postage" value={`${Number(postage).toLocaleString()} koinu (${(Number(postage) / 1e8).toFixed(4)} DOGE)`} />
                <Row label="Fee rate" value={formatDojakwebFeeRate(feeRateKoinuPerByte)} />
              </div>

              <div className="flex items-start gap-2 text-xs text-blue-300 bg-blue-400/10 rounded p-3">
                <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  The Ðune indexer must confirm this transaction before your balance updates. This may take a few minutes.
                </span>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep('form')} className="flex-1 py-2 border border-border-primary rounded text-text-secondary text-sm hover:text-text-primary transition-colors">
                  Back
                </button>
                <button
                  onClick={handleBroadcast}
                  disabled={isLoading}
                  className="flex-1 py-2 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-bg-primary rounded text-sm font-medium transition-colors"
                >
                  {isLoading ? 'Signing…' : 'Confirm & Mint'}
                </button>
              </div>
            </>
          )}

          {step === 'broadcasting' && (
            <div className="text-center py-8 space-y-3">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-secondary text-sm">Broadcasting mint transaction…</p>
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
                <h3 className="text-lg font-semibold text-text-primary">Mint Submitted!</h3>
                <p className="text-sm text-text-secondary mt-1">Your mint transaction has been broadcast. Refresh your wallet after a few minutes.</p>
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
