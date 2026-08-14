'use client';

import type { ReactNode } from 'react';
import { CpuChipIcon } from '@heroicons/react/24/outline';
import { Usb } from 'lucide-react';
import type { WalletType } from '../../types/wallet';

const EXTENSION_LOGOS: Partial<Record<WalletType, string>> = {
  mydoge: '/mydoge.webp',
  dojak: '/dojak.png',
  spookydoge: '/spookydoge.webp',
  dogesoft: '/dogesoft.png',
  ledger: '/ledger.svg',
};

export type WalletProviderIconSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<WalletProviderIconSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-11 w-11',
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function getWalletProviderLogo(type: WalletType | null | undefined): string | null {
  if (!type) return null;
  return EXTENSION_LOGOS[type] ?? null;
}

type WalletProviderIconProps = {
  walletType: WalletType | null | undefined;
  size?: WalletProviderIconSize;
  className?: string;
  framed?: boolean;
};

/** Active wallet identity: extension logos, microchip for local browser wallet. */
export function WalletProviderIcon({
  walletType,
  size = 'md',
  className,
  framed = false,
}: WalletProviderIconProps): ReactNode {
  const box = SIZE_CLASS[size];
  const logo = getWalletProviderLogo(walletType);

  const inner = logo ? (
    <img
      src={logo}
      alt=""
      className={cx(box, 'shrink-0 rounded-lg object-cover', className)}
      draggable={false}
    />
  ) : walletType === 'browser' || !walletType ? (
    <CpuChipIcon
      className={cx(box, 'shrink-0 text-emerald-300/90', className)}
      aria-hidden
    />
  ) : walletType === 'dogewatch' ? (
    <Usb className={cx(box, 'shrink-0 text-orange-300/90', className)} aria-hidden />
  ) : (
    <CpuChipIcon className={cx(box, 'shrink-0 text-white/45', className)} aria-hidden />
  );

  if (!framed) return inner;

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]',
        size === 'lg' ? 'h-11 w-11' : size === 'md' ? 'h-9 w-9' : size === 'sm' ? 'h-7 w-7' : 'h-6 w-6',
        className,
      )}
    >
      {inner}
    </span>
  );
}
