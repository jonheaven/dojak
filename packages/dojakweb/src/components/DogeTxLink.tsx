import React from 'react';
import {
  dogeTxExplorerDisplayName,
  dogeTxExplorerUrl,
  useDogeTxExplorerPreference,
} from '../utils/dogeTxExplorer';

export function shortDogeTxid(txid: string, head = 10, tail = 8): string {
  const t = txid.trim();
  if (t.length <= head + tail + 1) return t;
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
}

/**
 * Transaction id link using Wallet → Settings → Dogecoin Transaction Explorer
 * (default explorer.dogenals.com).
 */
export function DogeTxLink({
  txid,
  className,
  children,
  full = false,
}: {
  txid: string;
  className?: string;
  children?: React.ReactNode;
  /** Show the full 64-char id instead of a truncated label. */
  full?: boolean;
}) {
  const pref = useDogeTxExplorerPreference();
  const id = txid.trim();
  if (!id) return null;
  const href = dogeTxExplorerUrl(id, pref);
  const name = dogeTxExplorerDisplayName(pref);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={`${name} · ${id}`}
    >
      {children ?? (full ? id : shortDogeTxid(id))}
    </a>
  );
}
