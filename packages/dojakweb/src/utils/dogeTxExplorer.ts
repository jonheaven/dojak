/** Dogecoin transaction explorer URLs — matches Wallet → Settings → Dogecoin Transaction Explorer. */

import { useSyncExternalStore } from 'react';

export type DogeTxExplorerId = 'dogenals' | 'sochain' | 'dogechain' | 'blockchair';

export const CHAIN_EXPLORER_CONFIG_KEY = 'dojakweb-chain-explorer-config';

const CHANGED_EVENT = 'dojakweb-chain-explorer-changed';

/** Canonical Ðexplorer (dogenals eco). */
export const DOGENALS_EXPLORER_ORIGIN = 'https://explorer.dogenals.com';

export function loadDogeTxExplorerPreference(): DogeTxExplorerId {
  if (typeof window === 'undefined') return 'dogenals';
  const raw = window.localStorage.getItem(CHAIN_EXPLORER_CONFIG_KEY);
  if (
    raw === 'dogenals' ||
    raw === 'sochain' ||
    raw === 'dogechain' ||
    raw === 'blockchair'
  ) {
    return raw;
  }
  return 'dogenals';
}

export function saveDogeTxExplorerPreference(value: DogeTxExplorerId): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CHAIN_EXPLORER_CONFIG_KEY, value);
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function dogeTxExplorerUrl(txid: string, pref?: DogeTxExplorerId): string {
  const id = txid.trim();
  const p = pref ?? loadDogeTxExplorerPreference();
  switch (p) {
    case 'sochain':
      return `https://sochain.com/tx/DOGE/${id}`;
    case 'dogechain':
      return `https://dogechain.info/tx/${id}`;
    case 'blockchair':
      return `https://blockchair.com/dogecoin/transaction/${id}`;
    case 'dogenals':
    default:
      return `${DOGENALS_EXPLORER_ORIGIN}/tx/${id}`;
  }
}

export function dogeTxExplorerDisplayName(pref?: DogeTxExplorerId): string {
  const p = pref ?? loadDogeTxExplorerPreference();
  switch (p) {
    case 'sochain':
      return 'SoChain';
    case 'dogechain':
      return 'DogeChain';
    case 'blockchair':
      return 'Blockchair';
    case 'dogenals':
    default:
      return 'Ðexplorer';
  }
}

function subscribeExplorer(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHAIN_EXPLORER_CONFIG_KEY || e.key === null) callback();
  };
  const onCustom = () => callback();
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGED_EVENT, onCustom);
  };
}

function getExplorerSnapshot(): DogeTxExplorerId {
  return loadDogeTxExplorerPreference();
}

/** Re-renders when the user changes the explorer in wallet settings (same tab or another tab). */
export function useDogeTxExplorerPreference(): DogeTxExplorerId {
  return useSyncExternalStore(subscribeExplorer, getExplorerSnapshot, getExplorerSnapshot);
}
