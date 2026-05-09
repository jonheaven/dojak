import React from 'react';
import { MagnifyingGlassIcon, Bars3Icon, ArrowPathIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { SimpleWallet } from '../lib/simple-wallet';
import { DogeAmount } from './DogeAmount';

interface TopBarProps {
  onWalletClick: () => void;
  onMenuClick: () => void;
  wallet: SimpleWallet | null;
  balance?: number;
  balanceVerified?: boolean;
  isSidebarOpen: boolean;
  /** When DogeOS is enabled (browser wallet), shows active chain pill — gold L1 vs violet DogeOS. */
  chainIndicator?: React.ReactNode;
  onHelpClick?: () => void;
  onSwitchAccount?: () => void;
  onRefreshBalance?: () => void;
  balanceRefreshing?: boolean;
  balanceError?: string | null;
}

export const TopBar: React.FC<TopBarProps> = ({
  onWalletClick,
  onMenuClick,
  wallet,
  balance,
  balanceVerified = false,
  isSidebarOpen,
  chainIndicator,
  onHelpClick,
  onSwitchAccount,
  onRefreshBalance,
  balanceRefreshing = false,
  balanceError
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-bg-primary border-b border-border-primary h-16 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md hover:bg-bg-secondary transition-colors duration-200"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <img
              src="/bork.png"
              alt="Bork"
              className="w-6 h-6 object-contain filter invert"
              style={{
                filter: 'invert(1) brightness(0) saturate(100%)',
                mixBlendMode: 'difference'
              }}
            />
          </div>
          <span className="text-xl font-bold text-text-primary hidden sm:block">
            Dojak
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-4 lg:mx-8">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search wallets, PSBTs, UTXOs..."
            className="input w-full pl-10 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {chainIndicator ? (
          <div className="hidden min-[400px]:flex shrink-0 items-center">{chainIndicator}</div>
        ) : null}
        {onHelpClick && (
          <button
            onClick={onHelpClick}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded-lg transition-colors"
            title="Show onboarding tour"
          >
            <QuestionMarkCircleIcon className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-2">
          {wallet && onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary border border-border-primary rounded-lg transition-colors"
              title="Switch to different account"
            >
              Switch Account
            </button>
          )}

          {wallet ? (
            <div className="flex items-center gap-2">
              {onRefreshBalance && (
                <button
                  type="button"
                  onClick={onRefreshBalance}
                  className="rounded-lg border border-border-primary p-2 text-yellow-300 transition hover:bg-bg-secondary hover:text-yellow-200"
                  title={balanceError || 'Refresh balance'}
                  aria-label="Refresh wallet balance"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${balanceRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}

              {balance !== undefined && (
                <div className="flex items-center text-xs text-yellow-400 font-medium">
                  {balanceVerified
                    ? <DogeAmount doge={balance} decimals={4} />
                    : 'Balance unavailable'}
                </div>
              )}

              <button
                type="button"
                data-tour="connect-wallet"
                onClick={onWalletClick}
                className="inline-flex items-center gap-2 rounded-md border border-amber-600/50 bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-amber-400 dark:border-amber-500/40 dark:bg-amber-600 dark:text-white dark:hover:bg-amber-500"
              >
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-xs">
                  {wallet.getAddress().slice(0, 6)}...{wallet.getAddress().slice(-4)}
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-tour="connect-wallet"
              onClick={onWalletClick}
              className="btn-outline px-4 py-2 text-sm font-medium"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
