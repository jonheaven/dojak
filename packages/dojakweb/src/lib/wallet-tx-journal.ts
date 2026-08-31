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

export type DojakwebWalletTxProtocol =
  | 'dogecoin'
  | 'doginals'
  | 'dunes'
  | 'treats'
  | 'charms'
  | 'alkanes'
  | 'marketplace'
  | 'dxd'
  | 'dlotto'
  | 'dgames'
  | 'dlocker'
  | 'incinerator'
  | 'dogepark'
  | 'dogetag'
  | 'unknown';

export type DojakwebWalletTxEntry = {
  id: string;
  txid?: string;
  address?: string | null;
  protocol?: DojakwebWalletTxProtocol;
  action: string;
  title: string;
  summary?: string;
  status: DojakwebWalletTxStatus;
  createdAt: string;
  updatedAt: string;
  /** Hostname of the page that created this journal row (e.g. dogenals.com). */
  originHost?: string;
  /** Path of that page (e.g. /dunes, /alkanes). */
  originPath?: string;
  /** Human label for the dApp / surface. */
  originLabel?: string;
  metadata?: Record<string, unknown>;
};

export const WALLET_TX_PROTOCOL_LABELS: Record<DojakwebWalletTxProtocol, string> = {
  dogecoin: 'Dogecoin',
  doginals: 'Doginals',
  dunes: 'Ðunes',
  treats: 'ÐogeTreats',
  charms: 'Charms',
  alkanes: 'Ðalkanes',
  marketplace: 'Marketplace',
  dxd: 'Ð𝕏Ð',
  dlotto: 'ÐLotto',
  dgames: 'ÐGames',
  dlocker: 'ÐLocker',
  incinerator: 'BurneÐ',
  dogepark: 'DogePark',
  dogetag: 'ÐogeTag',
  unknown: 'Unknown',
};

const PROTOCOL_RANK: Record<DojakwebWalletTxProtocol, number> = {
  unknown: 0,
  dogecoin: 1,
  dogetag: 2,
  doginals: 3,
  marketplace: 3,
  dxd: 3,
  treats: 4,
  charms: 4,
  dunes: 5,
  alkanes: 5,
  dlotto: 5,
  dgames: 5,
  dlocker: 6,
  incinerator: 6,
  dogepark: 5,
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

function isProtocol(value: unknown): value is DojakwebWalletTxProtocol {
  return typeof value === 'string' && value in WALLET_TX_PROTOCOL_LABELS;
}

export function walletTxProtocolLabel(protocol?: string | null): string {
  if (!protocol) return WALLET_TX_PROTOCOL_LABELS.unknown;
  if (isProtocol(protocol)) return WALLET_TX_PROTOCOL_LABELS[protocol];
  return protocol;
}

export function guessWalletTxOriginLabel(host: string, path: string): string {
  const h = host.toLowerCase();
  const p = path.toLowerCase();
  if (h.includes('dogecoin.games')) {
    if (p.includes('lotto') || p.includes('dlotto')) return 'dogecoin.games · ÐLotto';
    return 'dogecoin.games';
  }
  if (h.includes('dogenals')) {
    if (p.includes('/lock')) return 'dogenals · ÐLocker';
    if (p.includes('/incinerator') || p.includes('/burn')) return 'dogenals · BurneÐ';
    if (p.includes('alkane')) return 'dogenals · Ðalkanes';
    if (p.includes('dogepark')) return 'dogenals · DogePark';
    // Protocol (Ðunes / Treats) already has its own chip — don't restamp "dogenals · Ðunes".
    return 'dogenals.com';
  }
  if (h.includes('dojak')) return 'Dojakweb';
  if (h.includes('localhost') || h === '127.0.0.1') return `local · ${p || '/'}`;
  return host || 'this dApp';
}

function stampOrigin(
  entry: Partial<DojakwebWalletTxEntry>,
): Pick<DojakwebWalletTxEntry, 'originHost' | 'originPath' | 'originLabel'> {
  if (entry.originHost || entry.originLabel) {
    return {
      ...(entry.originHost ? { originHost: entry.originHost } : {}),
      ...(entry.originPath ? { originPath: entry.originPath } : {}),
      ...(entry.originLabel ? { originLabel: entry.originLabel } : {}),
    };
  }
  if (typeof window === 'undefined') return {};
  try {
    const originHost = window.location.hostname || undefined;
    const originPath = window.location.pathname || undefined;
    if (!originHost) return {};
    return {
      originHost,
      originPath,
      originLabel: guessWalletTxOriginLabel(originHost, originPath || '/'),
    };
  } catch {
    return {};
  }
}

function richerProtocol(
  a?: DojakwebWalletTxProtocol | null,
  b?: DojakwebWalletTxProtocol | null,
): DojakwebWalletTxProtocol {
  const left = a && isProtocol(a) ? a : 'unknown';
  const right = b && isProtocol(b) ? b : 'unknown';
  return PROTOCOL_RANK[right] >= PROTOCOL_RANK[left] ? right : left;
}

function normalizeEntry(raw: unknown): DojakwebWalletTxEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Partial<DojakwebWalletTxEntry>;
  if (typeof entry.action !== 'string' || !entry.action.trim()) return null;
  if (typeof entry.title !== 'string' || !entry.title.trim()) return null;
  const txid = isValidTxid(entry.txid) ? entry.txid.trim().toLowerCase() : undefined;
  const id =
    typeof entry.id === 'string' && entry.id.trim()
      ? entry.id.trim()
      : txid || `local-${Date.now()}`;
  const createdAt =
    typeof entry.createdAt === 'string' && entry.createdAt.trim() ? entry.createdAt : nowIso();
  const protocol = isProtocol(entry.protocol) ? entry.protocol : 'unknown';
  return {
    id,
    ...(txid ? { txid } : {}),
    address: typeof entry.address === 'string' && entry.address.trim() ? entry.address.trim() : null,
    protocol,
    action: entry.action.trim(),
    title: entry.title.trim(),
    summary: typeof entry.summary === 'string' ? entry.summary : undefined,
    status: entry.status || 'broadcasted',
    createdAt,
    updatedAt:
      typeof entry.updatedAt === 'string' && entry.updatedAt.trim() ? entry.updatedAt : createdAt,
    originHost: typeof entry.originHost === 'string' ? entry.originHost : undefined,
    originPath: typeof entry.originPath === 'string' ? entry.originPath : undefined,
    originLabel: typeof entry.originLabel === 'string' ? entry.originLabel : undefined,
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
  const origin = stampOrigin({ ...existing, ...entry });
  const next: DojakwebWalletTxEntry = {
    ...(existing || {}),
    ...entry,
    id: existing?.id || id,
    ...(txid ? { txid } : {}),
    protocol: richerProtocol(existing?.protocol, entry.protocol),
    action: (() => {
      const incoming = entry.action?.trim();
      if (!incoming) return existing?.action || 'broadcast';
      if (
        existing?.protocol &&
        existing.protocol !== 'dogecoin' &&
        existing.protocol !== 'unknown' &&
        entry.protocol === 'dogecoin'
      ) {
        return existing.action;
      }
      return incoming;
    })(),
    title: (() => {
      const incoming = entry.title?.trim();
      if (!incoming) return existing?.title || 'Transaction';
      if (
        existing?.protocol &&
        existing.protocol !== 'dogecoin' &&
        existing.protocol !== 'unknown' &&
        entry.protocol === 'dogecoin'
      ) {
        return existing.title;
      }
      return incoming;
    })(),
    summary: (() => {
      if (
        existing?.protocol &&
        existing.protocol !== 'dogecoin' &&
        existing.protocol !== 'unknown' &&
        entry.protocol === 'dogecoin'
      ) {
        return existing.summary ?? entry.summary;
      }
      return entry.summary ?? existing?.summary;
    })(),
    createdAt: existing?.createdAt || entry.createdAt || timestamp,
    updatedAt: timestamp,
    address: (() => {
      const incoming =
        typeof entry.address === 'string' && entry.address.trim() ? entry.address.trim() : null;
      const prev = existing?.address ?? null;
      // Never reassign a row from one HD account onto another.
      if (prev && incoming && prev !== incoming) return prev;
      return incoming || prev;
    })(),
    originHost: origin.originHost || existing?.originHost || entry.originHost,
    originPath: origin.originPath || existing?.originPath || entry.originPath,
    originLabel: origin.originLabel || existing?.originLabel || entry.originLabel,
  };
  saveWalletTxJournal([next, ...current.filter((row) => row.id !== next.id && row.txid !== next.txid)]);
  return next;
}

export function journalDlockerTx(opts: {
  txid: string;
  address: string;
  action: 'lock' | 'unlock';
  lockType?: 'doge' | 'dune' | 'inscription';
  title?: string;
  summary?: string;
  amountDoge?: number;
  duneName?: string;
  duneAmount?: string;
  locktimeUnix?: number;
  vout?: number;
  inscriptionId?: string;
}): DojakwebWalletTxEntry | null {
  const lockType = opts.lockType || 'doge';
  const inscriptionId = opts.inscriptionId?.trim();
  const asset =
    lockType === 'dune'
      ? opts.duneName || 'Ðune'
      : lockType === 'inscription'
        ? inscriptionId
          ? `${inscriptionId.slice(0, 10)}…`
          : 'inscription'
        : 'DOGE';
  const title =
    opts.title ||
    (opts.action === 'unlock' ? `Unlock ${asset}` : `Lock ${asset}`);
  const summary =
    opts.summary ||
    [
      opts.duneAmount && opts.duneName ? `${opts.duneAmount} ${opts.duneName}` : null,
      inscriptionId && lockType === 'inscription' ? inscriptionId : null,
      opts.locktimeUnix
        ? `until ${new Date(opts.locktimeUnix * 1000).toISOString().slice(0, 10)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined;
  return upsertWalletTxJournalEntry({
    txid: opts.txid,
    address: opts.address,
    protocol: 'dlocker',
    action: opts.action,
    title,
    summary,
    status: 'broadcasted',
    originLabel: 'dogenals · ÐLocker',
    metadata: {
      actionLabel: opts.action === 'unlock' ? 'Unlock' : 'Lock',
      lockType,
      amountDoge: opts.amountDoge,
      duneName: opts.duneName,
      duneAmount: opts.duneAmount,
      amountDisplay: opts.duneAmount,
      locktimeUnix: opts.locktimeUnix,
      vout: opts.vout,
      inscriptionId,
    },
  });
}

export function journalIncineratorTx(opts: {
  txid: string;
  address: string;
  inscriptionIds: string[];
  feeKoinu?: number;
  burnedPostageKoinu?: number;
}): DojakwebWalletTxEntry | null {
  const ids = opts.inscriptionIds.map((id) => id.trim()).filter(Boolean);
  const first = ids[0] || 'inscription';
  const more = ids.length > 1 ? ` +${ids.length - 1}` : '';
  const title = ids.length > 1 ? `Burn ${ids.length} inscriptions` : `Burn ${first.slice(0, 10)}…`;
  return upsertWalletTxJournalEntry({
    txid: opts.txid,
    address: opts.address,
    protocol: 'incinerator',
    action: 'burn',
    title,
    summary: ids.join(', ') || undefined,
    status: 'broadcasted',
    originLabel: 'dogenals · BurneÐ',
    metadata: {
      actionLabel: 'Burn',
      inscriptionId: first,
      inscriptionIds: ids,
      feeKoinu: opts.feeKoinu,
      burnedPostageKoinu: opts.burnedPostageKoinu,
      amountDisplay: more || first,
    },
  });
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

function foldWalletChipText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ÐðĐđ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** True when a chip is just restating the protocol (Ðune vs Ðunes, Treat vs Treats, …). */
function chipRestatesProtocol(chip: string, protocolFolded: string): boolean {
  if (!protocolFolded) return false;
  const c = foldWalletChipText(chip);
  if (!c) return true;
  if (c === 'transfer' || c === 'dune' || c === 'dunes' || c === 'treat' || c === 'treats') {
    if (
      protocolFolded === c ||
      protocolFolded === `${c}s` ||
      protocolFolded.replace(/s$/, '') === c ||
      protocolFolded.includes(c)
    ) {
      return true;
    }
  }
  return (
    c === protocolFolded ||
    protocolFolded === `${c}s` ||
    protocolFolded.replace(/s$/, '') === c ||
    (c.length >= 4 && protocolFolded.startsWith(c)) ||
    (protocolFolded.length >= 4 && c.startsWith(protocolFolded))
  );
}

/**
 * Collapse redundant protocol / action / origin chips for history + detail.
 * Keeps useful action chips (Bet, Mint, Etch) and distinct origins (dogecoin.games).
 */
export function walletTxDisplayChips(row: {
  protocol?: DojakwebWalletTxProtocol | string | null;
  protocolLabel?: string | null;
  actionLabel?: string | null;
  originLabel?: string | null;
}): { protocolLabel?: string; actionLabel?: string; originLabel?: string } {
  const protocol =
    row.protocol && isProtocol(row.protocol) && row.protocol !== 'dogecoin' && row.protocol !== 'unknown'
      ? row.protocol
      : undefined;
  const protocolLabel = protocol
    ? (row.protocolLabel?.trim() || WALLET_TX_PROTOCOL_LABELS[protocol])
    : undefined;
  const pFold = protocolLabel ? foldWalletChipText(protocolLabel) : '';

  let actionLabel = row.actionLabel?.trim() || undefined;
  if (actionLabel && chipRestatesProtocol(actionLabel, pFold || foldWalletChipText(String(row.protocol || '')))) {
    actionLabel = undefined;
  }
  if (actionLabel && foldWalletChipText(actionLabel) === 'transfer') {
    actionLabel = undefined;
  }

  let originLabel = row.originLabel?.trim() || undefined;
  if (originLabel) {
    const oFold = foldWalletChipText(originLabel);
    // Bare host restates “you’re on dogenals” — drop unless it names another product.
    if (oFold === 'dogenalscom' || oFold === 'dogenals' || oFold === 'dojakweb') {
      originLabel = undefined;
    } else if (pFold && oFold.startsWith('dogenals') && oFold.includes(pFold)) {
      // "dogenals · Ðunes" when protocol is already Ðunes — drop.
      originLabel = undefined;
    } else if (pFold && chipRestatesProtocol(originLabel, pFold) && !oFold.includes('games')) {
      originLabel = undefined;
    }
  }

  return {
    ...(protocolLabel ? { protocolLabel } : {}),
    ...(actionLabel ? { actionLabel } : {}),
    ...(originLabel ? { originLabel } : {}),
  };
}

export function walletTxActionLabel(entry?: DojakwebWalletTxEntry | null): string | undefined {
  const fromMeta = entry?.metadata?.actionLabel;
  if (typeof fromMeta === 'string' && fromMeta.trim()) {
    const raw = fromMeta.trim();
    const protocol = entry?.protocol;
    const protocolLabel = protocol ? walletTxProtocolLabel(protocol) : '';
    if (chipRestatesProtocol(raw, foldWalletChipText(protocolLabel || String(protocol || '')))) {
      // fall through to action-based label
    } else {
      return raw;
    }
  }
  const a = entry?.action?.trim().toLowerCase();
  if (!a) return undefined;
  if (a === 'bet') return 'Bet';
  if (a === 'payout') return 'Payout';
  if (a === 'ticket') return 'Ticket';
  if (a === 'win') return 'Win';
  if (a === 'call') return 'Call';
  if (a === 'lock') return 'Lock';
  if (a === 'unlock') return 'Unlock';
  if (a === 'send') return 'Send';
  if (a === 'mint') return 'Mint';
  if (a === 'etch' || a === 'dune-etch') return 'Etch';
  if (a === 'transfer') return undefined;
  return undefined;
}

export type WalletTxListRow = {
  txid: string;
  type: 'sent' | 'received';
  amount: number;
  address: string;
  confirmations: number;
  timestamp: string;
  pending: boolean;
  localOnly?: boolean;
  journal?: DojakwebWalletTxEntry;
  protocol?: DojakwebWalletTxProtocol;
  protocolLabel?: string;
  /** Short action chip: Bet / Payout / Ticket / Call */
  actionLabel?: string;
  originLabel?: string;
  title?: string;
  summary?: string;
  /** Token units for Ðune (etc.) — Activity chip; DOGE `amount` stays postage. */
  tokenAmountLabel?: string;
  /** HD account that created this optimistic/local row (not the counterparty). */
  walletAddress?: string;
};

function dogeAddressesEqual(a?: string | null, b?: string | null): boolean {
  const left = a?.trim();
  const right = b?.trim();
  if (!left || !right) return false;
  return left === right;
}

/** Journal rows with no address must not appear as local-only history on an HD account. */
export function walletTxJournalBelongsToAddress(
  entry: Pick<DojakwebWalletTxEntry, 'address'>,
  address?: string | null,
): boolean {
  const want = address?.trim();
  if (!want) return true;
  return dogeAddressesEqual(entry.address, want);
}

/**
 * Merge MyDoge (or other) wallet history with the local Dojakweb journal so
 * protocol-tagged broadcasts show up even before the extension API lists them.
 */
export function mergeWalletTxJournalIntoList<T extends {
  txid: string;
  type: 'sent' | 'received';
  amount: number;
  address: string;
  confirmations: number;
  timestamp: string;
  pending: boolean;
  localOnly?: boolean;
  protocolHint?: DojakwebWalletTxProtocol | string;
  title?: string;
  summary?: string;
}>(
  chainTxs: T[],
  journal: DojakwebWalletTxEntry[],
  opts?: { address?: string | null },
): WalletTxListRow[] {
  const addr = opts?.address?.trim() || null;
  const byTxid = new Map<string, WalletTxListRow>();

  for (const tx of chainTxs) {
    const txid = tx.txid.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(txid)) continue;
    if (byTxid.has(txid)) continue;
    const hint =
      tx.protocolHint && isProtocol(tx.protocolHint) ? tx.protocolHint : 'dogecoin';
    byTxid.set(txid, {
      ...tx,
      txid,
      protocol: hint,
      protocolLabel: WALLET_TX_PROTOCOL_LABELS[hint],
      title: tx.title,
      summary: tx.summary,
    });
  }

  for (const entry of journal) {
    if (!entry.txid) continue;
    const existing = byTxid.get(entry.txid);
    if (existing) {
      // Overlay labels only when the journal is unscoped or owned by this account.
      if (addr && entry.address && !dogeAddressesEqual(entry.address, addr)) continue;
    } else if (!walletTxJournalBelongsToAddress(entry, addr)) {
      // Don't invent local-only rows from another HD account (or unscoped broadcasts).
      continue;
    } else if (entry.status === 'indexed' || entry.status === 'confirmed') {
      // Already on-chain: if this address's history didn't return it, it's leftover journal.
      continue;
    }
    const metaRecipient =
      typeof entry.metadata?.recipientAddress === 'string'
        ? entry.metadata.recipientAddress.trim()
        : '';
    const metaDuneName =
      typeof entry.metadata?.duneName === 'string'
        ? entry.metadata.duneName.trim()
        : typeof entry.metadata?.spacedName === 'string'
          ? entry.metadata.spacedName.trim()
          : '';
    const metaAmount =
      typeof entry.metadata?.amount === 'string' || typeof entry.metadata?.amount === 'number'
        ? String(entry.metadata.amount)
        : '';
    if (existing) {
      const protocol = richerProtocol(existing.protocol, entry.protocol);
      const actionLabel = walletTxActionLabel(entry) || existing.actionLabel;
      const type =
        entry.action === 'payout' || entry.action === 'win'
          ? 'received'
          : existing.type;
      const metaToken =
        typeof entry.metadata?.amountDisplay === 'string' ||
        typeof entry.metadata?.amountDisplay === 'number'
          ? String(entry.metadata.amountDisplay)
          : metaAmount;
      const tokenAmountLabel =
        (protocol === 'dunes' || protocol === 'dlocker' || protocol === 'marketplace') && metaToken
          ? `${type === 'received' ? '+' : '-'}${metaToken}${
              protocol === 'marketplace'
                ? ''
                : metaDuneName
                  ? ` ${metaDuneName.replace(/•/g, '').slice(0, 12)}`
                  : ''
            }`
          : existing.tokenAmountLabel;
      byTxid.set(entry.txid, {
        ...existing,
        type,
        journal: entry,
        protocol,
        protocolLabel: walletTxProtocolLabel(protocol),
        actionLabel,
        originLabel: entry.originLabel || existing.originLabel,
        title:
          entry.title ||
          existing.title ||
          (protocol === 'dlocker'
            ? entry.action === 'unlock'
              ? 'Unlock ÐLocker'
              : 'Lock ÐLocker'
            : protocol === 'dunes' && metaDuneName
              ? `${type === 'sent' ? 'Send' : 'Receive'} ${metaDuneName}`
              : protocol === 'marketplace'
                ? entry.title || 'NFT sale'
                : undefined),
        summary:
          entry.summary ||
          existing.summary ||
          (protocol === 'dunes' && metaAmount
            ? `${metaAmount}${metaDuneName ? ` ${metaDuneName}` : ''}${metaRecipient ? ` → ${metaRecipient.slice(0, 10)}…` : ''}`
            : undefined),
        address: metaRecipient || existing.address,
        amount:
          typeof entry.metadata?.amountDoge === 'number' && entry.metadata.amountDoge > 0
            ? entry.metadata.amountDoge
            : existing.amount,
        tokenAmountLabel,
        pending: existing.pending || entry.status === 'broadcasted' || entry.status === 'seen',
        localOnly: false,
      });
    } else {
      const created = entry.createdAt || entry.updatedAt;
      const type = entry.action === 'payout' || entry.action === 'win' ? 'received' : 'sent';
      const metaToken =
        typeof entry.metadata?.amountDisplay === 'string' ||
        typeof entry.metadata?.amountDisplay === 'number'
          ? String(entry.metadata.amountDisplay)
          : metaAmount;
      byTxid.set(entry.txid, {
        txid: entry.txid,
        type,
        amount: typeof entry.metadata?.amountDoge === 'number' ? entry.metadata.amountDoge : 0,
        address: metaRecipient || entry.address || '',
        confirmations: entry.status === 'confirmed' || entry.status === 'indexed' ? 1 : 0,
        timestamp: created.includes('T') ? created.replace('T', ' ').slice(0, 19) : created,
        pending: entry.status !== 'confirmed' && entry.status !== 'indexed' && entry.status !== 'failed',
        localOnly: true,
        journal: entry,
        protocol: entry.protocol || 'unknown',
        protocolLabel: walletTxProtocolLabel(entry.protocol),
        actionLabel: walletTxActionLabel(entry),
        originLabel: entry.originLabel,
        title:
          entry.title ||
          (entry.protocol === 'dunes' && metaDuneName ? `Send ${metaDuneName}` : undefined),
        summary: entry.summary,
        tokenAmountLabel:
          (entry.protocol === 'dunes' || entry.protocol === 'dlocker') && metaToken
            ? `${type === 'received' ? '+' : '-'}${metaToken}${metaDuneName ? ` ${metaDuneName.replace(/•/g, '').slice(0, 12)}` : ''}`
            : undefined,
      });
    }
  }

  return [...byTxid.values()].sort((a, b) => compareWalletTxNewestFirst(a, b));
}

/** Chain time first — never journal `updatedAt` (enrichment bumps that and scrambles the list). */
export function compareWalletTxNewestFirst(
  a: { timestamp?: string; pending?: boolean; confirmations?: number; journal?: { createdAt?: string } },
  b: { timestamp?: string; pending?: boolean; confirmations?: number; journal?: { createdAt?: string } },
): number {
  const ap = a.pending ? 1 : 0;
  const bp = b.pending ? 1 : 0;
  if (ap !== bp) return bp - ap;
  const ta = walletTxSortTimeMs(a);
  const tb = walletTxSortTimeMs(b);
  if (tb !== ta) return tb - ta;
  return (a.confirmations ?? 0) - (b.confirmations ?? 0);
}

function walletTxSortTimeMs(tx: {
  timestamp?: string;
  journal?: { createdAt?: string };
}): number {
  return parseWalletTxTime(tx.timestamp) || parseWalletTxTime(tx.journal?.createdAt) || 0;
}

function parseWalletTxTime(raw?: string): number {
  const t = (raw || '').trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    const ms = n > 1e12 ? n : n > 1e10 ? n : n * 1000;
    return Number.isFinite(ms) ? ms : 0;
  }
  const iso = /T/.test(t) ? t : `${t.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}
