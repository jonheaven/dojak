'use client';

import { Menu } from '@headlessui/react';
import type { ReactNode } from 'react';
import { useDojakwebTheme, type DojakwebTheme } from '../../contexts/DojakwebThemeContext';
import { cn } from '../../lib/utils';

type WalletMenuAnchor = 'bottom end' | 'bottom start' | 'top end';

type WalletMenuItemsProps = {
  children: ReactNode;
  className?: string;
  /** Override wallet theme when the modal `isDark` prop differs from provider context. */
  theme?: DojakwebTheme;
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
  theme: themeProp,
  anchor = 'bottom end',
}: WalletMenuItemsProps) {
  const { theme: contextTheme } = useDojakwebTheme();
  const theme = themeProp ?? contextTheme;
  const isLight = theme === 'light';

  return (
    <Menu.Items
      portal
      transition
      anchor={{ to: anchor, gap: 6, padding: 16 }}
      data-ds-theme={theme}
      className={cn(
        'ds-wallet-menu z-[10002] min-w-[11rem] origin-top rounded-xl border py-1 shadow-2xl outline-none',
        'transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0',
        isLight ? 'border-black/10 bg-[#f5f4f1]' : 'border-white/10 bg-zinc-900',
        className,
      )}
    >
      {children}
    </Menu.Items>
  );
}
