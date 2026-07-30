'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useUnifiedWallet } from '../../contexts/useUnifiedWallet';
import { walletDataApi, type DuneHolding } from '../../utils/api';
import { DuneDeployModal } from '../DuneDeployModal';
import { DuneMintModal } from '../DuneMintModal';
import { DuneSendModal } from '../DuneSendModal';

export type DunesUiOp = 'deploy' | 'mint' | 'send';

export interface DunesToolsPanelProps {
  initialOp?: DunesUiOp;
  initialDune?: string;
  ops?: DunesUiOp[];
  compact?: boolean;
  className?: string;
}

const DEFAULT_OPS: DunesUiOp[] = ['deploy', 'mint', 'send'];

export function DunesToolsPanel({
  initialOp = 'mint',
  initialDune = '',
  ops = DEFAULT_OPS,
  compact = false,
  className = '',
}: DunesToolsPanelProps) {
  const { address } = useUnifiedWallet();
  const firstOp = ops.includes(initialOp) ? initialOp : ops[0] ?? 'mint';

  const [deployOpen, setDeployOpen] = useState(firstOp === 'deploy');
  const [mintOpen, setMintOpen] = useState(firstOp === 'mint');
  const [sendOpen, setSendOpen] = useState(firstOp === 'send');
  const [sendHolding, setSendHolding] = useState<DuneHolding | undefined>();
  const [holdings, setHoldings] = useState<DuneHolding[] | null>(null);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  const refreshHoldings = useCallback(async () => {
    if (!address) {
      setHoldings(null);
      return;
    }
    setLoadingHoldings(true);
    try {
      const rows = await walletDataApi.fetchDunes(address);
      setHoldings(rows);
    } catch {
      setHoldings([]);
    } finally {
      setLoadingHoldings(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshHoldings();
  }, [refreshHoldings]);

  const openSend = (holding?: DuneHolding) => {
    setSendHolding(holding);
    setSendOpen(true);
  };

  const onModalSuccess = () => {
    void refreshHoldings();
  };

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {!compact && (
        <div className="rounded-2xl border border-border-primary bg-bg-secondary p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-500">Ðunes · 0xÐ</p>
          <h2 className="mt-2 text-2xl font-bold text-text-primary">Etch, mint, and send Ðunes</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            UTXO-native tokens on Dogecoin — balances live on outputs. Deploy with an{' '}
            <strong className="text-text-primary">etch</strong> (premine and/or open mint), then mint and transfer via{' '}
            <strong className="text-text-primary">edicts</strong>. Give her the Ð.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ops.includes('deploy') && (
          <button
            type="button"
            onClick={() => setDeployOpen(true)}
            className="rounded-xl border border-[#FCD34D]/50 bg-[#FCD34D]/10 px-4 py-2 text-sm font-semibold text-[#FCD34D] transition hover:bg-[#FCD34D]/20"
          >
            Deploy (etch)
          </button>
        )}
        {ops.includes('mint') && (
          <button
            type="button"
            onClick={() => setMintOpen(true)}
            className="rounded-xl border border-border-primary px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-primary-500"
          >
            Mint
          </button>
        )}
        {ops.includes('send') && (
          <button
            type="button"
            onClick={() => openSend()}
            className="rounded-xl border border-border-primary px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-primary-500"
          >
            Send
          </button>
        )}
      </div>

      {address && (
        <div className="rounded-2xl border border-border-primary bg-bg-secondary p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Your Ðune holdings</p>
            <button
              type="button"
              onClick={() => void refreshHoldings()}
              className="text-xs text-text-secondary underline hover:text-text-primary"
            >
              Refresh
            </button>
          </div>
          {loadingHoldings ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : holdings?.length ? (
            <ul className="space-y-2">
              {holdings.map((h, i) => {
                const name = h.dune ?? h.ticker ?? '—';
                const balance = Number(h.balance || h.amount || 0).toLocaleString();
                return (
                  <li
                    key={`${name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-primary bg-bg-primary px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-text-primary">{name}</p>
                      {h.symbol && <p className="text-xs text-text-secondary">{h.symbol}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm text-text-primary">{balance}</span>
                      {ops.includes('send') && (
                        <button
                          type="button"
                          onClick={() => openSend(h)}
                          className="rounded-lg border border-border-primary px-2 py-1 text-xs text-text-secondary hover:border-primary-500 hover:text-text-primary"
                        >
                          Send
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">No Ðunes indexed for this address yet.</p>
          )}
        </div>
      )}

      {!address && (
        <p className="rounded-xl border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
          Connect your Dojakweb wallet to view holdings and sign Ðune transactions.
        </p>
      )}

      <DuneDeployModal
        isOpen={deployOpen}
        onClose={() => setDeployOpen(false)}
        initialName={initialDune || undefined}
        onSuccess={() => {
          onModalSuccess();
          setDeployOpen(false);
        }}
      />
      <DuneMintModal
        isOpen={mintOpen}
        onClose={() => setMintOpen(false)}
        duneName={initialDune || undefined}
        onSuccess={() => {
          onModalSuccess();
          setMintOpen(false);
        }}
      />
      <DuneSendModal
        isOpen={sendOpen}
        onClose={() => {
          setSendOpen(false);
          setSendHolding(undefined);
        }}
        holding={sendHolding}
        onSuccess={() => {
          onModalSuccess();
          setSendOpen(false);
          setSendHolding(undefined);
        }}
      />
    </div>
  );
}
