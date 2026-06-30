'use client';

import React, { useState } from 'react';
import { useDataProvider } from '../../providers/DataProvider';
import { CharmsCreateModal } from '../CharmsCreateModal';
import { CharmsTransferModal } from '../CharmsTransferModal';
import type { CharmsToken } from '../../lib/charms/types';
import {
  charmsBodyClass,
  charmsEyebrowClass,
  charmsListItemClass,
  charmsPanelClass,
  charmsPanelCompactClass,
  charmsPrimaryBtnClass,
  charmsSecondaryBtnClass,
  charmsTitleClass,
} from './charms-ui-classes';

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
    <div className={`ds-charms-tools space-y-6 ${className}`.trim()}>
      {!compact && (
        <div className={charmsPanelClass}>
          <p className={charmsEyebrowClass}>Charms</p>
          <h2 className={charmsTitleClass}>Create and transfer Charms</h2>
          <p className={charmsBodyClass}>
            Programmable ZK assets on Dogecoin — client-side validation with Groth16 proofs.
            Launch a token or transfer balances to another address via PSBT.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ops.includes('create') && (
          <button type="button" onClick={() => setCreateOpen(true)} className={charmsPrimaryBtnClass}>
            Create token
          </button>
        )}
        {ops.includes('transfer') && (
          <button
            type="button"
            onClick={() => openTransfer(tokens[0])}
            disabled={!tokens.length}
            className={charmsSecondaryBtnClass}
          >
            Transfer
          </button>
        )}
      </div>

      <div className={charmsPanelCompactClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--ds-text-muted)]">Your Charms</p>
          <button
            type="button"
            onClick={() => void refreshCharms()}
            className="text-xs text-[var(--ds-text-muted)] underline hover:text-[var(--ds-text)]"
          >
            Refresh
          </button>
        </div>
        {isLoadingCharms ? (
          <p className="text-sm text-[var(--ds-text-muted)]">Loading…</p>
        ) : tokens.length ? (
          <ul className="space-y-2">
            {tokens.map((token) => {
              const human = Number(token.balance) / 10 ** (token.decimals || 8);
              return (
                <li key={`${token.txid}:${token.vout}`} className={charmsListItemClass}>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold text-[var(--ds-text)]">{token.ticker}</p>
                    {token.name && (
                      <p className="truncate text-xs text-[var(--ds-text-muted)]">{token.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm text-[var(--ds-text-muted)]">
                      {human.toLocaleString()}
                    </span>
                    {ops.includes('transfer') && (
                      <button
                        type="button"
                        onClick={() => openTransfer(token)}
                        className="rounded-lg border border-[var(--ds-border-strong)] px-2 py-1 text-xs text-[var(--ds-text)] hover:border-[var(--ds-accent-border)]"
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
          <p className="text-sm text-[var(--ds-text-muted)]">
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
