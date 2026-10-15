import React from 'react';
import {
  dogeAddressExplorerUrl,
  dogeTxExplorerDisplayName,
  useDogeTxExplorerPreference,
} from '../utils/dogeTxExplorer';

export function shortDogeAddress(address: string, head = 8, tail = 6): string {
  const a = address.trim();
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

/**
 * Address link using Wallet → Settings → Dogecoin Transaction Explorer
 * (default doge.watch/address/…).
 */
export function DogeAddressLink({
  address,
  className,
  children,
  full = false,
}: {
  address: string;
  className?: string;
  children?: React.ReactNode;
  /** Show the full address instead of a truncated label. */
  full?: boolean;
}) {
  const pref = useDogeTxExplorerPreference();
  const a = address.trim();
  if (!a) return null;
  const href = dogeAddressExplorerUrl(a, pref);
  const name = dogeTxExplorerDisplayName(pref);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={`${name} · ${a}`}
    >
      {children ?? (full ? a : shortDogeAddress(a))}
    </a>
  );
}
