'use client';

import type { ReactNode } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CpuChipIcon,
  LockClosedIcon,
  PlusIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { LoaderCircle, Usb } from 'lucide-react';
import { WalletProviderIcon } from './WalletProviderIcon';
import type { DojakwebTranslate } from '../../contexts/DojakwebLocaleContext';
import type { BrowserWalletSeedGroup } from '../../lib/wallet-seed-groups';
import type { WalletType } from '../../types/wallet';
import { useWalletConnectOptions } from '../../hooks/useWalletConnectOptions';

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

function walletTypeIcon(type: WalletType, active: boolean): ReactNode {
  return <WalletProviderIcon walletType={type} size="sm" framed className={active ? 'border-[#FCD34D]/30' : undefined} />;
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
  /** When true, show icon row to connect another provider (keeps current sessions). */
  enableConnectAnother?: boolean;
  onSelectBrowserFlow?: () => void;
  onConnectedAnother?: () => void;
  t: DojakwebTranslate;
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function SectionHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/45">
        {icon}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
    </div>
  );
}

function ConnectAnotherSection({
  t,
  isBusy,
  onSelectBrowserFlow,
  onConnectedAnother,
}: {
  t: DojakwebTranslate;
  isBusy: boolean;
  onSelectBrowserFlow?: () => void;
  onConnectedAnother?: () => void;
}) {
  const { tiles, connectingType, anyConnecting, handleSelect } = useWalletConnectOptions({
    onSelectBrowser: () => onSelectBrowserFlow?.(),
    onConnected: () => onConnectedAnother?.(),
  });
  const connectables = tiles.filter((tile) => !tile.connected);
  if (connectables.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <SectionHeader
        icon={<PlusIcon className="h-4 w-4" aria-hidden />}
        label={t('modal.walletSwitcher.connectAnother')}
      />
      <p className="px-0.5 text-[11px] leading-relaxed text-white/40">
        {t('modal.walletSwitcher.connectAnotherHint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {connectables.map((tile) => {
          const busy = connectingType === tile.type;
          return (
            <button
              key={tile.type}
              type="button"
              disabled={isBusy || anyConnecting || (!tile.available && tile.type !== 'browser')}
              title={tile.title}
              aria-label={tile.ariaLabel}
              onClick={() => void handleSelect(tile.type)}
              className={cx(
                'relative flex h-12 w-12 items-center justify-center rounded-xl border transition',
                tile.available || tile.type === 'browser'
                  ? 'border-white/15 bg-white/[0.05] hover:border-white/30 hover:bg-white/[0.1]'
                  : 'cursor-not-allowed border-white/[0.08] bg-white/[0.02] opacity-40',
                (isBusy || anyConnecting) && 'cursor-wait opacity-70',
              )}
            >
              <WalletProviderIcon walletType={tile.type} size="md" />
              {busy ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" aria-hidden />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
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
  enableConnectAnother = false,
  onSelectBrowserFlow,
  onConnectedAnother,
  t,
}: WalletAccountSwitcherPanelProps) {
  const sections: ReactNode[] = [];

  if (enableConnectAnother) {
    sections.push(
      <ConnectAnotherSection
        key="connect-another"
        t={t}
        isBusy={isBusy}
        onSelectBrowserFlow={onSelectBrowserFlow}
        onConnectedAnother={onConnectedAnother}
      />,
    );
  }

  if (localSeedGroups.length > 0) {
    sections.push(
      <section key="local" className="space-y-2.5" title={t('modal.walletSwitcher.group.localHint')}>
        <SectionHeader icon={<CpuChipIcon className="h-4 w-4" aria-hidden />} label={t('modal.walletSwitcher.tab.local')} />
        <div className="space-y-2.5">
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
                  'overflow-hidden rounded-xl border bg-white/[0.02]',
                  groupActive ? 'border-[#FCD34D]/35 shadow-[inset_0_1px_0_rgba(252,211,77,0.08)]' : 'border-white/10',
                )}
              >
                <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-white/90">{seedTitle}</div>
                    {group.accounts.length > 1 ? (
                      <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-white/45">
                        {t('modal.walletSwitcher.accountsInSeed', { count: String(group.accounts.length) })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1.5 p-2">
                  {group.accounts.map((acc) => {
                    const isActive = acc.address === activeAddress && walletType === 'browser';
                    const idx = acc.accountIndex ?? 0;
                    const encrypted = Boolean((acc as { encrypted?: boolean }).encrypted);
                    return (
                      <button
                        key={acc.address}
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          if (!isActive) void onSelectLocalAddress(acc.address);
                        }}
                        className={cx(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                          isActive
                            ? 'border-[#FCD34D]/40 bg-[#FCD34D]/10 text-white'
                            : 'border-transparent bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06] hover:text-white',
                          isBusy && 'cursor-wait opacity-70',
                        )}
                        aria-pressed={isActive}
                      >
                        <span
                          className={cx(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                            isActive
                              ? 'border-[#FCD34D]/30 bg-[#FCD34D]/10'
                              : encrypted
                                ? 'border-amber-400/25 bg-amber-500/10'
                                : 'border-white/10 bg-white/5',
                          )}
                        >
                          {encrypted && !isActive ? (
                            <LockClosedIcon className="h-4 w-4 text-amber-300/90" aria-hidden />
                          ) : (
                            <WalletProviderIcon walletType="browser" size="sm" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {acc.nickname?.trim() || t('modal.savedWallets.account', { index: String(idx) })}
                          </span>
                          <span className="block font-mono text-[11px] text-white/45">
                            {truncateAddress(acc.address)}
                            {acc.derivationPath ? ` · ${acc.derivationPath.replace(/^m\//, '')}` : ''}
                          </span>
                        </span>
                        {isActive ? (
                          <span className="shrink-0 rounded-md border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FCD34D]">
                            {t('modal.walletSwitcher.active')}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-white/25">→</span>
                        )}
                      </button>
                    );
                  })}
                  {groupActive && canAddHdAccount ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onAddHdAccount()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-transparent px-2 py-2.5 text-xs font-semibold text-white/55 transition hover:border-[#D4A017]/40 hover:bg-[#FCD34D]/5 hover:text-[#FCD34D]"
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
        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
        wallet.isActive
          ? 'border-[#FCD34D]/45 bg-[#FCD34D]/10 text-white shadow-[inset_0_1px_0_rgba(252,211,77,0.08)]'
          : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/18 hover:bg-white/[0.06] hover:text-white',
        isBusy && 'cursor-wait opacity-70',
      )}
      aria-pressed={wallet.isActive}
      title={t('modal.walletSwitcher.useAsActive', { label: wallet.label })}
    >
      <span
        className={cx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
          wallet.isActive
            ? 'border-[#FCD34D]/30 bg-[#FCD34D]/10 text-[#FCD34D]'
            : 'border-white/10 bg-white/5 text-white/45',
        )}
      >
        {walletTypeIcon(wallet.type, wallet.isActive)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{wallet.label}</span>
        <span className="block font-mono text-[11px] text-white/45">
          {wallet.address ? truncateAddress(wallet.address) : t('modal.walletSwitcher.connected')}
        </span>
      </span>
      {wallet.isActive ? (
        <span className="shrink-0 rounded-md border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FCD34D]">
          {t('modal.walletSwitcher.active')}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-white/25">→</span>
      )}
    </button>
  );

  if (extensionWallets.length > 0) {
    sections.push(
      <section key="ext" className="space-y-2.5" title={t('modal.walletSwitcher.group.extHint')}>
        <SectionHeader icon={<WalletIcon className="h-4 w-4" aria-hidden />} label={t('modal.walletSwitcher.tab.ext')} />
        <div className="space-y-2">{extensionWallets.map(renderWalletRow)}</div>
      </section>,
    );
  }

  if (hardwareWallets.length > 0) {
    sections.push(
      <section key="hw" className="space-y-2.5" title={t('modal.walletSwitcher.group.hwHint')}>
        <SectionHeader icon={<Usb className="h-4 w-4" aria-hidden />} label={t('modal.walletSwitcher.tab.hw')} />
        <div className="space-y-2">
          {hardwareWallets.map((wallet) => (
            <div key={wallet.type} className="space-y-1.5">
              {renderWalletRow(wallet)}
              {wallet.type === 'ledger' && wallet.isActive && ledgerAccountIndex != null ? (
                <div className="flex items-center justify-end gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-white/40">
                    {t('modal.walletSwitcher.ledgerAccount')}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy || ledgerAccountIndex <= 0}
                    onClick={() => void onLedgerAccountDelta(-1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-35"
                    aria-label={t('modal.walletSwitcher.ledgerPrevAccount')}
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
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-35"
                    aria-label={t('modal.walletSwitcher.ledgerNextAccount')}
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
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/50">
        {t('modal.walletSwitcher.empty')}
      </p>
    );
  }

  return <div className="space-y-6">{sections}</div>;
}
