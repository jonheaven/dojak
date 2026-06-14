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
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FCD34D]">Dunes</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Etch, mint, and send Ðunes</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            UTXO-native Runes-style tokens on Dogecoin — balances live on outputs, not addresses.
            Deploy with an <strong className="text-zinc-200">etch</strong>, mint to postage outputs, transfer via{' '}
            <strong className="text-zinc-200">edicts</strong>.
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
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Mint
          </button>
        )}
        {ops.includes('send') && (
          <button
            type="button"
            onClick={() => openSend()}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Send
          </button>
        )}
      </div>

      {address && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Your Ðune holdings</p>
            <button
              type="button"
              onClick={() => void refreshHoldings()}
              className="text-xs text-zinc-400 underline hover:text-white"
            >
              Refresh
            </button>
          </div>
          {loadingHoldings ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : holdings?.length ? (
            <ul className="space-y-2">
              {holdings.map((h, i) => {
                const name = h.dune ?? h.ticker ?? '—';
                const balance = Number(h.balance || h.amount || 0).toLocaleString();
                return (
                  <li
                    key={`${name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-white">{name}</p>
                      {h.symbol && <p className="text-xs text-zinc-500">{h.symbol}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm text-zinc-300">{balance}</span>
                      {ops.includes('send') && (
                        <button
                          type="button"
                          onClick={() => openSend(h)}
                          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
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
            <p className="text-sm text-zinc-500">No Ðunes indexed for this address yet.</p>
          )}
        </div>
      )}

      {!address && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-400">
          Connect your Dojakweb wallet to view holdings and sign Ðune transactions.
        </p>
      )}

      <DuneDeployModal
        isOpen={deployOpen}
        onClose={() => setDeployOpen(false)}
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
