'use client';

import type { ReactNode } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CpuChipIcon,
  PlusIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { Usb } from 'lucide-react';
import type { DojakwebTranslate } from '../../contexts/DojakwebLocaleContext';
import type { BrowserWalletSeedGroup } from '../../lib/wallet-seed-groups';
import type { WalletType } from '../../types/wallet';

export type WalletSwitcherSummary = {
  type: WalletType;
  label: string;
  address: string | null;
  isActive: boolean;
  accountIndex: number | null;
};

function truncateAddress(address: string | null | undefined): string {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function walletDotClass(type: WalletType, active: boolean): string {
  if (active) return 'bg-[#FCD34D]';
  switch (type) {
    case 'browser':
      return 'bg-emerald-400/80';
    case 'mydoge':
      return 'bg-sky-400/80';
    case 'spookydoge':
      return 'bg-violet-400/80';
    case 'dojak':
      return 'bg-[#D4A017]/90';
    case 'ledger':
      return 'bg-indigo-400/80';
    case 'dogewatch':
      return 'bg-orange-400/80';
    default:
      return 'bg-white/30';
  }
}

export type WalletAccountSwitcherPanelProps = {
  localSeedGroups: BrowserWalletSeedGroup[];
  extensionWallets: WalletSwitcherSummary[];
  hardwareWallets: WalletSwitcherSummary[];
  activeAddress: string | null;
  walletType: WalletType | null;
  isBusy: boolean;
  canAddHdAccount: boolean;
  ledgerAccountIndex: number | null;
  onSelectLocalAddress: (address: string) => void | Promise<void>;
  onAddHdAccount: () => void | Promise<void>;
  onSelectWalletType: (type: WalletType) => void;
  onLedgerAccountDelta: (delta: -1 | 1) => void | Promise<void>;
  t: DojakwebTranslate;
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function WalletAccountSwitcherPanel({
  localSeedGroups,
  extensionWallets,
  hardwareWallets,
  activeAddress,
  walletType,
  isBusy,
  canAddHdAccount,
  ledgerAccountIndex,
  onSelectLocalAddress,
  onAddHdAccount,
  onSelectWalletType,
  onLedgerAccountDelta,
  t,
}: WalletAccountSwitcherPanelProps) {
  const sections: ReactNode[] = [];

  if (localSeedGroups.length > 0) {
    sections.push(
      <section key="local" className="space-y-2" title={t('modal.walletSwitcher.group.localHint')}>
        <div className="flex items-center gap-2 px-0.5">
          <CpuChipIcon className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {t('modal.walletSwitcher.tab.local')}
          </span>
        </div>
        <div className="space-y-2">
          {localSeedGroups.map((group) => {
            const primary = group.accounts[0];
            const seedTitle =
              primary?.nickname?.trim() ||
              t('modal.walletSwitcher.seedGroup', { count: String(group.accounts.length) });
            const groupActive = group.accounts.some(
              (a) => a.address === activeAddress && walletType === 'browser',
            );
            return (
              <div
                key={group.id}
                className={cx(
                  'rounded-lg border bg-white/[0.03]',
                  groupActive ? 'border-[#FCD34D]/35' : 'border-white/10',
                )}
              >
                <div className="border-b border-white/10 px-3 py-2">
                  <div className="truncate text-xs font-semibold text-white/85">{seedTitle}</div>
                  {group.accounts.length > 1 ? (
                    <div className="mt-0.5 text-[10px] text-white/40">
                      {t('modal.walletSwitcher.accountsInSeed', { count: String(group.accounts.length) })}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1 p-2">
                  {group.accounts.map((acc) => {
                    const isActive = acc.address === activeAddress && walletType === 'browser';
                    const idx = acc.accountIndex ?? 0;
                    return (
                      <button
                        key={acc.address}
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          if (!isActive) void onSelectLocalAddress(acc.address);
                        }}
                        className={cx(
                          'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition',
                          isActive
                            ? 'border-[#FCD34D]/40 bg-[#FCD34D]/10 text-white'
                            : 'border-transparent bg-white/5 text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white',
                        )}
                        aria-pressed={isActive}
                      >
                        <span
                          className={cx('h-2 w-2 shrink-0 rounded-full', walletDotClass('browser', isActive))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {acc.nickname?.trim() ||
                              t('modal.savedWallets.account', { index: String(idx) })}
                          </span>
                          <span className="block font-mono text-[11px] text-white/45">
                            {truncateAddress(acc.address)}
                            {acc.derivationPath ? ` · ${acc.derivationPath.replace(/^m\//, '')}` : ''}
                          </span>
                        </span>
                        {isActive ? (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#FCD34D]">
                            {t('modal.walletSwitcher.active')}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] text-white/30">→</span>
                        )}
                      </button>
                    );
                  })}
                  {groupActive && canAddHdAccount ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onAddHdAccount()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 bg-transparent px-2 py-2 text-xs font-semibold text-white/55 transition hover:border-[#D4A017]/40 hover:text-[#FCD34D]"
                    >
                      <PlusIcon className="h-3.5 w-3.5" aria-hidden />
                      {t('modal.walletSwitcher.addAccount')}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>,
    );
  }

  const renderWalletRow = (wallet: WalletSwitcherSummary) => (
    <button
      key={wallet.type}
      type="button"
      disabled={isBusy}
      onClick={() => {
        if (!wallet.isActive) onSelectWalletType(wallet.type);
      }}
      className={cx(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
        wallet.isActive
          ? 'border-[#FCD34D] bg-[#FCD34D]/10 text-white'
          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
      )}
      aria-pressed={wallet.isActive}
      title={t('modal.walletSwitcher.useAsActive', { label: wallet.label })}
    >
      <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', walletDotClass(wallet.type, wallet.isActive))} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{wallet.label}</span>
        <span className="block text-xs text-white/50">
          {wallet.address ? truncateAddress(wallet.address) : t('modal.walletSwitcher.connected')}
        </span>
      </span>
      {wallet.isActive ? (
        <span className="shrink-0 rounded border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#FCD34D]">
          {t('modal.walletSwitcher.active')}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-white/30">→</span>
      )}
    </button>
  );

  if (extensionWallets.length > 0) {
    sections.push(
      <section key="ext" className="space-y-2" title={t('modal.walletSwitcher.group.extHint')}>
        <div className="flex items-center gap-2 px-0.5">
          <WalletIcon className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {t('modal.walletSwitcher.tab.ext')}
          </span>
        </div>
        <div className="space-y-2">{extensionWallets.map(renderWalletRow)}</div>
      </section>,
    );
  }

  if (hardwareWallets.length > 0) {
    sections.push(
      <section key="hw" className="space-y-2" title={t('modal.walletSwitcher.group.hwHint')}>
        <div className="flex items-center gap-2 px-0.5">
          <Usb className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {t('modal.walletSwitcher.tab.hw')}
          </span>
        </div>
        <div className="space-y-2">
          {hardwareWallets.map((wallet) => (
            <div key={wallet.type} className="space-y-1">
              {renderWalletRow(wallet)}
              {wallet.type === 'ledger' && wallet.isActive && ledgerAccountIndex != null ? (
                <div className="flex items-center justify-end gap-2 px-1 pb-1">
                  <span className="text-[10px] uppercase tracking-wide text-white/40">
                    {t('modal.localNav.account')}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy || ledgerAccountIndex <= 0}
                    onClick={() => void onLedgerAccountDelta(-1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-35"
                    aria-label={t('modal.localNav.prevAccount')}
                  >
                    <ChevronUpIcon className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2rem] text-center text-xs font-semibold tabular-nums text-white/75">
                    #{ledgerAccountIndex}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onLedgerAccountDelta(1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-35"
                    aria-label={t('modal.localNav.nextAccount')}
                  >
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>,
    );
  }

  if (sections.length === 0) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-center text-sm text-white/50">
        {t('modal.walletSwitcher.empty')}
      </p>
    );
  }

  return <div className="space-y-5">{sections}</div>;
}
