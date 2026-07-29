export const DOJAKWEB_WALLET_TX_JOURNAL_KEY = 'dojakweb:walletTxJournal:v1';
export const DOJAKWEB_WALLET_TX_JOURNAL_CHANGED_EVENT = 'dojakweb:walletTxJournal:changed';

export type DojakwebWalletTxStatus =
  | 'draft'
  | 'signed'
  | 'broadcasted'
  | 'seen'
  | 'confirmed'
  | 'indexed'
  | 'failed';

export type DojakwebWalletTxEntry = {
  id: string;
  txid?: string;
  address?: string | null;
  protocol?: 'dogecoin' | 'doginals' | 'dunes' | 'treats' | 'charms' | 'marketplace' | 'dxd' | 'unknown';
  action: string;
  title: string;
  summary?: string;
  status: DojakwebWalletTxStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function isValidTxid(txid: string | undefined): txid is string {
  return typeof txid === 'string' && /^[0-9a-fA-F]{64}$/.test(txid.trim());
}

function normalizeEntry(raw: unknown): DojakwebWalletTxEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Partial<DojakwebWalletTxEntry>;
  if (typeof entry.action !== 'string' || !entry.action.trim()) return null;
  if (typeof entry.title !== 'string' || !entry.title.trim()) return null;
  const txid = isValidTxid(entry.txid) ? entry.txid.trim().toLowerCase() : undefined;
  const id = typeof entry.id === 'string' && entry.id.trim()
    ? entry.id.trim()
    : txid || `local-${Date.now()}`;
  const createdAt =
    typeof entry.createdAt === 'string' && entry.createdAt.trim()
      ? entry.createdAt
      : nowIso();
  return {
    id,
    ...(txid ? { txid } : {}),
    address: typeof entry.address === 'string' && entry.address.trim() ? entry.address.trim() : null,
    protocol: entry.protocol || 'unknown',
    action: entry.action.trim(),
    title: entry.title.trim(),
    summary: typeof entry.summary === 'string' ? entry.summary : undefined,
    status: entry.status || 'broadcasted',
    createdAt,
    updatedAt:
      typeof entry.updatedAt === 'string' && entry.updatedAt.trim()
        ? entry.updatedAt
        : createdAt,
    metadata:
      entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
        ? entry.metadata
        : undefined,
  };
}

function dispatchChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DOJAKWEB_WALLET_TX_JOURNAL_CHANGED_EVENT));
}

export function loadWalletTxJournal(): DojakwebWalletTxEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(DOJAKWEB_WALLET_TX_JOURNAL_KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return raw
      .map(normalizeEntry)
      .filter((entry): entry is DojakwebWalletTxEntry => Boolean(entry))
      .filter((entry) => {
        const key = entry.txid || entry.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function saveWalletTxJournal(entries: DojakwebWalletTxEntry[]): void {
  if (!canUseStorage()) return;
  const normalized = entries
    .map(normalizeEntry)
    .filter((entry): entry is DojakwebWalletTxEntry => Boolean(entry))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 100);
  window.localStorage.setItem(DOJAKWEB_WALLET_TX_JOURNAL_KEY, JSON.stringify(normalized));
  dispatchChanged();
}

export function upsertWalletTxJournalEntry(
  entry: Omit<DojakwebWalletTxEntry, 'id' | 'createdAt' | 'updatedAt'> &
    Partial<Pick<DojakwebWalletTxEntry, 'id' | 'createdAt' | 'updatedAt'>>,
): DojakwebWalletTxEntry | null {
  if (!canUseStorage()) return null;
  const timestamp = nowIso();
  const txid = isValidTxid(entry.txid) ? entry.txid.trim().toLowerCase() : undefined;
  const id = entry.id || txid || `local-${timestamp}-${Math.random().toString(36).slice(2)}`;
  const current = loadWalletTxJournal();
  const existing = current.find((row) => (txid && row.txid === txid) || row.id === id);
  const next: DojakwebWalletTxEntry = {
    ...(existing || {}),
    ...entry,
    id: existing?.id || id,
    ...(txid ? { txid } : {}),
    createdAt: existing?.createdAt || entry.createdAt || timestamp,
    updatedAt: timestamp,
  };
  saveWalletTxJournal([next, ...current.filter((row) => row.id !== next.id && row.txid !== next.txid)]);
  return next;
}

export function removeWalletTxJournalEntry(idOrTxid: string): void {
  const key = idOrTxid.trim().toLowerCase();
  saveWalletTxJournal(loadWalletTxJournal().filter((row) => row.id !== idOrTxid && row.txid !== key));
}

export function clearWalletTxJournal(address?: string): void {
  if (!address?.trim()) {
    saveWalletTxJournal([]);
    return;
  }
  const target = address.trim();
  saveWalletTxJournal(loadWalletTxJournal().filter((row) => row.address !== target));
}

export function subscribeWalletTxJournal(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === DOJAKWEB_WALLET_TX_JOURNAL_KEY) listener();
  };
  const onChanged = () => listener();
  window.addEventListener('storage', onStorage);
  window.addEventListener(DOJAKWEB_WALLET_TX_JOURNAL_CHANGED_EVENT, onChanged);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(DOJAKWEB_WALLET_TX_JOURNAL_CHANGED_EVENT, onChanged);
  };
}
