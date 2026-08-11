'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useDataProviderOptional } from '../../providers/DataProvider';
import { useUnifiedWallet } from '../../contexts/useUnifiedWallet';
import { walletDataApi } from '../../utils/api';
import { charmsService } from '../../services/charmsService';
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

function normalizeUtxos(response: unknown): Array<{ txid?: string; vout?: number }> {
  if (!response || typeof response !== 'object') return [];
  const r = response as Record<string, unknown>;
  if (Array.isArray(r.utxos)) return r.utxos as Array<{ txid?: string; vout?: number }>;
  if (Array.isArray(r.data)) return r.data as Array<{ txid?: string; vout?: number }>;
  if (Array.isArray(r.result)) return r.result as Array<{ txid?: string; vout?: number }>;
  if (Array.isArray(r.list)) return r.list as Array<{ txid?: string; vout?: number }>;
  if (Array.isArray(response)) return response as Array<{ txid?: string; vout?: number }>;
  return [];
}

async function fetchCharmsForAddress(address: string): Promise<Map<string, CharmsToken>> {
  const utxoResponse = await walletDataApi.fetchUtxos(address);
  const walletUtxos = normalizeUtxos(utxoResponse);
  const indexed = await charmsService.scanCharmsForUtxos(walletUtxos, { limit: 24 });
  const nextTokens = new Map<string, CharmsToken>();
  for (const charm of indexed) {
    if (charm.spent_by_txid) continue;
    const key = `${charm.txid}:${charm.vout}:${charm.app_id}`;
    const rawBalance = charm.charm_data?.balance ?? charm.charm_data?.amount ?? charm.charm_data?.value ?? '1';
    const balance = BigInt(String(rawBalance));
    nextTokens.set(key, {
      id: key,
      chainId: 'doge',
      txid: charm.txid,
      vout: charm.vout,
      confirmed: true,
      ticker: charm.app_id,
      name: charm.app_id,
      balance,
      decimals: 0,
      address,
      scriptPubKey: '',
      transferHistory: [],
      chainSupply: { btc: 0n, ltc: 0n, doge: balance, ada: 0n },
      beamHistory: [],
    });
  }
  return nextTokens;
}

export function CharmsToolsPanel({
  initialOp = 'create',
  ops = DEFAULT_OPS,
  compact = false,
  className = '',
}: CharmsToolsPanelProps) {
  const data = useDataProviderOptional();
  const { address, connected } = useUnifiedWallet();
  const firstOp = ops.includes(initialOp) ? initialOp : ops[0] ?? 'create';

  const [createOpen, setCreateOpen] = useState(firstOp === 'create');
  const [transferOpen, setTransferOpen] = useState(firstOp === 'transfer');
  const [selectedToken, setSelectedToken] = useState<CharmsToken | undefined>();
  const [localTokens, setLocalTokens] = useState<Map<string, CharmsToken> | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const refreshLocal = useCallback(async () => {
    if (!connected || !address) {
      setLocalTokens(null);
      return;
    }
    setLocalLoading(true);
    try {
      setLocalTokens(await fetchCharmsForAddress(address));
    } catch {
      setLocalTokens(new Map());
    } finally {
      setLocalLoading(false);
    }
  }, [address, connected]);

  useEffect(() => {
    if (data) return;
    void refreshLocal();
  }, [data, refreshLocal]);

  const charmsTokens = data?.charmsTokens ?? localTokens;
  const isLoadingCharms = data?.isLoadingCharms ?? localLoading;
  const refreshCharms = data?.refreshCharms ?? refreshLocal;

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
            Programmable UTXO assets on Dogecoin — Rust app contracts + recursive Groth16 proofs in the
            transaction carrier (not inscription tickers). Create scaffolds a fungible template; transfer
            moves charm state between UTXOs once indexed.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ops.includes('create') && (
          <button type="button" onClick={() => setCreateOpen(true)} className={charmsPrimaryBtnClass}>
            Launch fungible
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
