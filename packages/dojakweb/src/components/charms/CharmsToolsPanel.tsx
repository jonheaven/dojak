'use client';

import React, { useState } from 'react';
import { useDataProvider } from '../../providers/DataProvider';
import { CharmsCreateModal } from '../CharmsCreateModal';
import { CharmsTransferModal } from '../CharmsTransferModal';
import type { CharmsToken } from '../../lib/charms/types';

export type CharmsUiOp = 'create' | 'transfer';

export interface CharmsToolsPanelProps {
  initialOp?: CharmsUiOp;
  ops?: CharmsUiOp[];
  compact?: boolean;
  className?: string;
}

const DEFAULT_OPS: CharmsUiOp[] = ['create', 'transfer'];

export function CharmsToolsPanel({
  initialOp = 'create',
  ops = DEFAULT_OPS,
  compact = false,
  className = '',
}: CharmsToolsPanelProps) {
  const { charmsTokens, refreshCharms, isLoadingCharms } = useDataProvider();
  const firstOp = ops.includes(initialOp) ? initialOp : ops[0] ?? 'create';

  const [createOpen, setCreateOpen] = useState(firstOp === 'create');
  const [transferOpen, setTransferOpen] = useState(firstOp === 'transfer');
  const [selectedToken, setSelectedToken] = useState<CharmsToken | undefined>();

  const tokens = Array.from(charmsTokens?.values() ?? []);

  const openTransfer = (token?: CharmsToken) => {
    setSelectedToken(token);
    setTransferOpen(true);
  };

  const onSuccess = () => {
    void refreshCharms();
  };

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {!compact && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FCD34D]">Charms</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Create and transfer Charms</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Programmable ZK assets on Dogecoin — client-side validation with Groth16 proofs.
            Launch a token or transfer balances to another address via PSBT.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ops.includes('create') && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-xl border border-[#FCD34D]/50 bg-[#FCD34D]/10 px-4 py-2 text-sm font-semibold text-[#FCD34D] transition hover:bg-[#FCD34D]/20"
          >
            Create token
          </button>
        )}
        {ops.includes('transfer') && (
          <button
            type="button"
            onClick={() => openTransfer(tokens[0])}
            disabled={!tokens.length}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-40"
          >
            Transfer
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Your Charms</p>
          <button
            type="button"
            onClick={() => void refreshCharms()}
            className="text-xs text-zinc-400 underline hover:text-white"
          >
            Refresh
          </button>
        </div>
        {isLoadingCharms ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : tokens.length ? (
          <ul className="space-y-2">
            {tokens.map((token) => {
              const human =
                Number(token.balance) / 10 ** (token.decimals || 8);
              return (
                <li
                  key={`${token.txid}:${token.vout}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold text-white">{token.ticker}</p>
                    {token.name && <p className="truncate text-xs text-zinc-500">{token.name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm text-zinc-300">{human.toLocaleString()}</span>
                    {ops.includes('transfer') && (
                      <button
                        type="button"
                        onClick={() => openTransfer(token)}
                        className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
                      >
                        Transfer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            No Charms detected yet. Create a token or connect a wallet with existing holdings.
          </p>
        )}
      </div>

      <CharmsCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          onSuccess();
          setCreateOpen(false);
        }}
      />
      <CharmsTransferModal
        isOpen={transferOpen}
        token={selectedToken}
        onClose={() => {
          setTransferOpen(false);
          setSelectedToken(undefined);
        }}
        onSuccess={() => {
          onSuccess();
          setTransferOpen(false);
          setSelectedToken(undefined);
        }}
      />
    </div>
  );
}
