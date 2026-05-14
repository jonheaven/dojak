import type { WalletData } from '../types/wallet';

export type BrowserWalletSeedGroup = {
  /** Stable id: seed fingerprint when present, else single-address fallback. */
  id: string;
  accounts: WalletData[];
};

/**
 * Group saved browser wallet rows by HD seed. Rows without `seedFingerprint` become their own group.
 * Accounts are sorted by `accountIndex` ascending for predictable ↑↓ navigation.
 */
export function groupBrowserWalletsBySeed(wallets: WalletData[]): BrowserWalletSeedGroup[] {
  const map = new Map<string, WalletData[]>();
  for (const w of wallets) {
    const id = w.seedFingerprint?.trim() || w.address;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(w);
  }
  return [...map.entries()].map(([id, accounts]) => ({
    id,
    accounts: [...accounts].sort((a, b) => (a.accountIndex ?? 0) - (b.accountIndex ?? 0)),
  }));
}

export function findSeedGroupIndexForAddress(
  groups: BrowserWalletSeedGroup[],
  address: string | null | undefined
): number {
  if (!address) return 0;
  const idx = groups.findIndex((g) => g.accounts.some((a) => a.address === address));
  return idx >= 0 ? idx : 0;
}

export function findAccountIndexInGroup(group: BrowserWalletSeedGroup, address: string | null | undefined): number {
  if (!address) return 0;
  const idx = group.accounts.findIndex((a) => a.address === address);
  return idx >= 0 ? idx : 0;
}
