/**
 * Charms Token Launch Modal
 *
 * Simple fungible surface (ticker / supply / decimals / pack) that maps into a real
 * Charms app template via `/v1/charms/launch/prepare` — not Runes-style metadata alone.
 */

import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { charmsService } from '../lib/charms';
import type { CharmsChainId, CharmsLaunchPack, PrepareLaunchResponse } from '../lib/charms/types';
import { CHARMS_CHAIN_CONFIG } from '../lib/charms/constants';
import {
  linkRevealToCommit,
  pickFundingUtxo,
  txNeedsWalletSign,
  unsignedLegacyTxToPsbtHex,
} from '../lib/charms/launch-tx';
import {
  fetchSpendableUtxosConservativeForAddress,
  filterSafeSpendableUtxos,
} from '../lib/broadcast/dogecoinTxBroadcast';
import { coerceSignedPsdtToRawTxHex, getTxHex, tryParsePsdt } from '../lib/doginal-psdt';
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

type Step = 'form' | 'confirm' | 'broadcasting' | 'scaffold' | 'done';

const PACK_OPTIONS: { id: CharmsLaunchPack; label: string; hint: string }[] = [
  { id: 'fair', label: 'Fair fungible', hint: 'Open-mint style template — conservation + mint rules' },
  { id: 'tax', label: 'Tax mode', hint: 'Per-transfer tax / burn / reflections policy' },
  { id: 'shill', label: 'Shill / referral', hint: 'Referral + optional PoW mining difficulty' },
  { id: 'hodl', label: 'Hodl', hint: 'Lock / vesting oriented template' },
];

export const CharmsCreateModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { address, connected, signPSBT } = useUnifiedWallet();

  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [supply, setSupply] = useState('1000000');
  const [decimals, setDecimals] = useState('8');
  const [chainId, setChainId] = useState<CharmsChainId>('doge');
  const [pack, setPack] = useState<CharmsLaunchPack>('fair');

  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [scaffold, setScaffold] = useState<PrepareLaunchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = () => {
    setTicker('');
    setName('');
    setSupply('1000000');
    setDecimals('8');
    setChainId('doge');
    setPack('fair');
    setStep('form');
    setError(null);
    setTxid(null);
    setScaffold(null);
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
    if (!supply.trim() || isNaN(Number(supply)) || Number(supply) <= 0) {
      setError('Supply must be a positive number');
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
      setError('Connect a Dogecoin wallet before launching a Charms token');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('broadcasting');
    try {
      let fundingUtxo: string | undefined;
      let fundingValue: bigint | undefined;
      let prevTxs: string[] | undefined;
      const prevTxHexByTxid: Record<string, string> = {};

      if (chainId === 'doge') {
        const utxos = await fetchSpendableUtxosConservativeForAddress(address);
        const { safe } = filterSafeSpendableUtxos(address, utxos);
        const funding = pickFundingUtxo(safe);
        if (!funding) {
          throw new Error('No spendable plain DOGE UTXOs found for Charms launch fees.');
        }
        const prevHex = await getTxHex(funding.tx_hash);
        prevTxHexByTxid[funding.tx_hash] = prevHex;
        fundingUtxo = `${funding.tx_hash}:${funding.tx_output_n}`;
        fundingValue = BigInt(funding.value);
        prevTxs = [prevHex];
      }

      const launch = await charmsService.prepareLaunch({
        ticker: ticker.trim(),
        supply: BigInt(supply.replace(/,/g, '')),
        decimals: Number(decimals),
        chainId,
        address,
        pack,
        metadata: {
          name: name.trim(),
          ticker: ticker.trim(),
          decimals: Number(decimals),
        },
        ...(fundingUtxo ? { fundingUtxo } : {}),
        ...(fundingValue !== undefined ? { fundingValue } : {}),
        ...(prevTxs?.length ? { prevTxs } : {}),
      });

      const signAndBroadcastHex = async (
        unsigned: string,
      ): Promise<{ txid: string; signedTxHex: string }> => {
        const trimmed = unsigned.trim();
        if (!trimmed) {
          throw new Error('Empty transaction payload from launch prepare');
        }

        let payloadForWallet = trimmed;
        if (!tryParsePsdt(trimmed) && txNeedsWalletSign(trimmed)) {
          payloadForWallet = unsignedLegacyTxToPsbtHex(trimmed, prevTxHexByTxid);
        }

        const signedPayload = await signPSBT(payloadForWallet);
        const signedTxHex = coerceSignedPsdtToRawTxHex(signedPayload);
        const broadcast = await charmsService.broadcastSignedTx({
          signedTxHex,
          chainId,
        });
        const { Transaction } = await import('bitcoinjs-lib');
        const txid = broadcast.txid || Transaction.fromHex(signedTxHex).getId();
        prevTxHexByTxid[txid] = signedTxHex;
        return { txid, signedTxHex };
      };

      const unsignedList =
        Array.isArray(launch.txs) && launch.txs.length > 0
          ? launch.txs.map((t) => String(t).trim()).filter(Boolean)
          : [(launch.unsignedTxHex || '').trim()].filter(Boolean);

      if (unsignedList.length === 0) {
        setScaffold(launch);
        setStep('scaffold');
        toast.message(
          launch.dogecoin?.carrierHint ||
            'App scaffolded — enable CHARMS_ENABLE_CANONICAL_DOGE_PREPARE + Dogecoin prove for a signable tx'
        );
        return;
      }

      let lastTxid = '';

      if (unsignedList.length >= 2) {
        const [commitHex, revealHex] = unsignedList;
        let commitTxid: string;
        if (txNeedsWalletSign(commitHex)) {
          ({ txid: commitTxid } = await signAndBroadcastHex(commitHex));
        } else {
          const broadcast = await charmsService.broadcastSignedTx({
            signedTxHex: commitHex,
            chainId,
          });
          commitTxid = broadcast.txid;
          prevTxHexByTxid[commitTxid] = commitHex;
        }

        const linkedReveal = linkRevealToCommit(revealHex, commitTxid);
        if (txNeedsWalletSign(linkedReveal)) {
          ({ txid: lastTxid } = await signAndBroadcastHex(linkedReveal));
        } else {
          const broadcast = await charmsService.broadcastSignedTx({
            signedTxHex: linkedReveal,
            chainId,
          });
          lastTxid = broadcast.txid;
        }
      } else {
        for (const unsigned of unsignedList) {
          ({ txid: lastTxid } = await signAndBroadcastHex(unsigned));
        }
      }

      setTxid(lastTxid);
      setStep('done');
      onSuccess?.(lastTxid, ticker.trim());
      toast.success(`Charms token "${ticker}" launched`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to launch Charms token';
      console.error('Failed to launch Charms token:', err);
      setError(message);
      setStep('form');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const identity = scaffold?.contract?.identity || scaffold?.spell?.identity;
  const vk = scaffold?.contract?.verificationKey || scaffold?.spell?.verificationKey;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg border-[var(--ds-border-strong)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--ds-text)]">Launch Charms fungible</DialogTitle>
        </DialogHeader>

        <div>
          {step === 'form' && (
            <div className="space-y-4">
              <Alert className="border-[var(--ds-border)] bg-[var(--ds-bg)]">
                <InformationCircleIcon className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed text-[var(--ds-text-muted)]">
                  Charms are programmable UTXO assets (app contract + recursive Groth16 proof), not
                  inscription tickers. You sign in this wallet (<code className="text-[var(--ds-text)]">@dojak/web</code>);
                  dogex indexes the on-chain <code className="text-[var(--ds-text)]">spell</code> carrier.
                </AlertDescription>
              </Alert>

              <div>
                <Label className="mb-1 block text-[var(--ds-text)]">Ticker</Label>
                <Input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="e.g., JAWN"
                  maxLength={10}
                />
              </div>

              <div>
                <Label className="mb-1 block text-[var(--ds-text)]">Display name</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Jawn Token"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-[var(--ds-text)]">Supply</Label>
                  <Input type="number" value={supply} onChange={(e) => setSupply(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block text-[var(--ds-text)]">Decimals</Label>
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
                <Label className="mb-1 block text-[var(--ds-text)]">App template pack</Label>
                <Select value={pack} onValueChange={(v) => setPack(v as CharmsLaunchPack)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACK_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-[var(--ds-text-muted)]">
                  {PACK_OPTIONS.find((p) => p.id === pack)?.hint}
                </p>
              </div>

              <div>
                <Label className="mb-1 block text-[var(--ds-text)]">Chain</Label>
                <Select value={chainId} onValueChange={(v) => setChainId(v as CharmsChainId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHARMS_CHAIN_CONFIG).map(([chain, config]) => (
                      <SelectItem key={chain} value={chain}>
                        {config.name}
                        {chain !== 'doge' ? ' (experimental here)' : ''}
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

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} className={charmsModalSecondaryBtnClass}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!ticker.trim() || !name.trim()}
                  className={charmsModalPrimaryBtnClass}
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className={`${charmsModalCardClass} space-y-2 text-sm`}>
                <p>
                  <span className="text-[var(--ds-text-muted)]">Ticker</span> ·{' '}
                  <span className="font-mono font-semibold">{ticker}</span>
                </p>
                <p>
                  <span className="text-[var(--ds-text-muted)]">Name</span> · {name}
                </p>
                <p>
                  <span className="text-[var(--ds-text-muted)]">Supply</span> · {supply} ({decimals} decimals)
                </p>
                <p>
                  <span className="text-[var(--ds-text-muted)]">Pack</span> · {pack}
                </p>
                <p>
                  <span className="text-[var(--ds-text-muted)]">Chain</span> ·{' '}
                  {CHARMS_CHAIN_CONFIG[chainId]?.name ?? chainId}
                </p>
              </div>
              <p className="text-xs text-[var(--ds-text-muted)]">
                Next step calls <code className="text-[var(--ds-text)]">/v1/charms/launch/prepare</code> to
                compile the template and build spell inputs. Signing only happens if a Dogecoin tx hex is
                returned.
              </p>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('form')} className={charmsModalSecondaryBtnClass}>
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleBroadcast()}
                  disabled={isLoading || !connected}
                  className={charmsModalPrimaryBtnClass}
                >
                  {isLoading ? 'Preparing…' : connected ? 'Scaffold & launch' : 'Connect wallet first'}
                </button>
              </div>
            </div>
          )}

          {step === 'broadcasting' && (
            <p className="py-8 text-center text-sm text-[var(--ds-text-muted)]">
              Scaffolding app contract / requesting prove payload…
            </p>
          )}

          {step === 'scaffold' && scaffold && (
            <div className="space-y-4">
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <InformationCircleIcon className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-xs leading-relaxed text-[var(--ds-text-muted)]">
                  The fungible <strong className="text-[var(--ds-text)]">app was scaffolded</strong> (template →
                  VK → NormalizedSpell), but no signable Dogecoin carrier was returned yet. Enable{' '}
                  <code className="text-[var(--ds-text)]">CHARMS_ENABLE_CANONICAL_DOGE_PREPARE</code> + a Dogecoin
                  Charms prover; this wallet (<code className="text-[var(--ds-text)]">@dojak/web</code>) signs,{' '}
                  <code className="text-[var(--ds-text)]">dogex</code> indexes.
                  {scaffold.dogecoin?.carrierHint ? (
                    <>
                      <br />
                      <span className="text-[var(--ds-text-muted)]">{scaffold.dogecoin.carrierHint}</span>
                    </>
                  ) : null}
                </AlertDescription>
              </Alert>
              <div className={`${charmsModalCardClass} space-y-2 break-all font-mono text-[11px]`}>
                <p>
                  <span className="text-[var(--ds-text-muted)]">identity</span>
                  <br />
                  {identity || '—'}
                </p>
                <p>
                  <span className="text-[var(--ds-text-muted)]">vk</span>
                  <br />
                  {vk || '—'}
                </p>
                <p>
                  <span className="text-[var(--ds-text-muted)]">launchId</span>
                  <br />
                  {scaffold.launchId || '—'}
                </p>
                <p>
                  <span className="text-[var(--ds-text-muted)]">compiled</span> ·{' '}
                  {scaffold.contract?.compiled ? 'yes' : 'fallback hash'}
                </p>
              </div>
              <button type="button" onClick={handleClose} className={charmsModalPrimaryBtnClass}>
                Close
              </button>
            </div>
          )}

          {step === 'done' && txid && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[var(--ds-text)]">Launch broadcast</p>
              <p className="break-all font-mono text-xs text-[var(--ds-text-muted)]">{txid}</p>
              <button type="button" onClick={handleClose} className={charmsModalPrimaryBtnClass}>
                Done
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
