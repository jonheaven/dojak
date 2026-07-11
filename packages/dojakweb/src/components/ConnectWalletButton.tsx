'use client';

import React, { useEffect, useState } from 'react';
import DojakwebWalletModal from './DojakwebWalletModal';
import WalletDrawer from './WalletDrawer';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import { useDxHostStore } from '../stores/dxHostStore';

export interface ConnectWalletButtonProps {
  className?: string;
  isDark?: boolean;
  /** drawer (default) opens the web wallet with built-in Shiba paw; modal is a centered sheet. */
  mode?: 'drawer' | 'modal';
}

export function ConnectWalletButton({
  className = '',
  isDark = true,
  mode = 'drawer',
}: ConnectWalletButtonProps) {
  const [open, setOpen] = useState(false);
  const { connected, address } = useUnifiedWallet();
  const { t } = useDojakwebI18n();
  const dxOpenSignal = useDxHostStore((s) => s.openWalletSignal);

  useEffect(() => {
    if (dxOpenSignal > 0) setOpen(true);
  }, [dxOpenSignal]);

  // Always show 'Connect wallet' when not connected, regardless of stored wallet
  const buttonLabel = connected && address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : t('wallet.connect');

  const buttonAriaLabel = connected && address
    ? `${t('wallet.openConnectedAria')} ${address}`
    : t('wallet.connect');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={buttonAriaLabel}
        className={`ds-connect-button inline-flex min-h-10 appearance-none items-center gap-3 rounded-lg border border-[color:var(--ds-accent-border)] bg-[linear-gradient(180deg,var(--ds-accent-solid)_0%,var(--ds-accent-solid-hover)_100%)] px-4 py-2 text-sm font-semibold text-[color:var(--ds-accent-foreground)] transition hover:brightness-105 ${className}`.trim()}
      >
        <span>{buttonLabel}</span>
        {connected && address ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" /> : null}
      </button>
      {mode === 'drawer' ? (
        <WalletDrawer
          isOpen={open}
          onClose={() => setOpen(false)}
          initialStep={connected ? 'dashboard' : 'entry'}
          isDark={isDark}
        />
      ) : (
        <DojakwebWalletModal
          isOpen={open}
          onClose={() => setOpen(false)}
          isDark={isDark}
          initialStep={connected ? 'dashboard' : 'entry'}
          mode="modal"
        />
      )}
    </>
  );
}
