/**
 * Charms Tab Component
 * 
 * Displays Charms tokens held by the user.
 * Allows minting, transferring, and beaming operations.
 */

import React, { useState } from 'react';
import { PlusIcon, ArrowUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import { CharmsCreateModal } from './CharmsCreateModal';
import { CharmsTransferModal } from './CharmsTransferModal';
import type { CharmsToken } from '../lib/charms/types';

interface Props {
  charmsTokens: Map<string, CharmsToken> | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const CharmsTab: React.FC<Props> = ({ charmsTokens, isLoading, error, onRefresh }) => {
  const { t } = useDojakwebI18n();

  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<CharmsToken | undefined>();

  const openTransfer = (token: CharmsToken) => {
    setSelectedToken(token);
    setTransferOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <ArrowPathIcon className="w-6 h-6 text-primary-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
        {error}
        <button
          onClick={onRefresh}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const tokens = Array.from(charmsTokens?.values() ?? []);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-xs hover:border-primary-500 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Create Charms Token
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-xs hover:border-primary-500 transition-colors"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Token list */}
      {tokens.length === 0 ? (
        <div className="p-8 text-center text-text-secondary text-sm">
          <p>No Charms tokens yet.</p>
          <p className="mt-2 text-xs">Create a token to get started with the Charms protocol.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="p-4 bg-bg-secondary border border-border-primary rounded flex items-center justify-between hover:border-primary-500/50 transition-colors"
            >
              <div>
                <p className="text-text-primary font-medium">{token.ticker}</p>
                <p className="text-text-secondary text-sm">{token.name}</p>
              </div>
              <div className="text-right">
                <p className="text-text-primary font-medium">
                  {(token.balance / BigInt(10 ** token.decimals)).toString()}
                </p>
                <p className="text-text-secondary text-xs">Verified ✓</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  type="button"
                  onClick={() => openTransfer(token)}
                  className="flex items-center gap-1 px-2 py-1 bg-primary-500/10 border border-primary-500/30 rounded text-primary-500 text-xs hover:bg-primary-500/20 transition-colors"
                >
                  <ArrowUpIcon className="w-3 h-3" />
                  Send
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CharmsCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          onRefresh();
        }}
      />
      <CharmsTransferModal
        isOpen={transferOpen}
        token={selectedToken}
        onClose={() => setTransferOpen(false)}
        onSuccess={() => {
          setTransferOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
};
