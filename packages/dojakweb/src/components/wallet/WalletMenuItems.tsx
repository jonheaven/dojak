'use client';

import { Menu } from '@headlessui/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type WalletMenuAnchor = 'bottom end' | 'bottom start' | 'top end';

type WalletMenuItemsProps = {
  children: ReactNode;
  className?: string;
  /** Floating placement relative to the ··· trigger (auto-flips inside viewport). */
  anchor?: WalletMenuAnchor;
};

/**
 * Headless UI menu panel portaled above drawer overflow clipping.
 * Use for all wallet flyouts inside the scrollable drawer body.
 */
export function WalletMenuItems({
  children,
  className,
  anchor = 'bottom end',
}: WalletMenuItemsProps) {
  return (
    <Menu.Items
      portal
      transition
      anchor={{ to: anchor, gap: 6, padding: 16 }}
      className={cn(
        'z-[10002] min-w-[11rem] origin-top rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-2xl outline-none',
        'transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0',
        className,
      )}
    >
      {children}
    </Menu.Items>
  );
}
