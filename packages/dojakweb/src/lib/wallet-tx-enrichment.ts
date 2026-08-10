/**
 * Enrich wallet history rows from dogex metaprotocol indexes
 * (ÐGames, ÐLotto, Ðalkanes, …) so the Transactions tab can label bets,
 * payouts, tickets, and contract calls — not just plain Dogecoin sends.
 */

import {
  DOGEX_PUBLIC_INDEXER_URL,
  getIndexerApiBase,
} from '../utils/api';
import {
  upsertWalletTxJournalEntry,
  walletTxProtocolLabel,
  type DojakwebWalletTxProtocol,
  type DojakwebWalletTxEntry,
} from './wallet-tx-journal';

export type WalletTxEnrichment = {
  txid: string;
  protocol: DojakwebWalletTxProtocol;
  action: string;
  /** Short chip: Bet / Payout / Ticket / Call */
  actionLabel: string;
  title: string;
  summary?: string;
  originLabel?: string;
  metadata?: Record<string, unknown>;
  /** Indexed on-chain → treat as confirmed/indexed in journal. */
  indexed: boolean;
};

function indexerBases(): string[] {
  return [getIndexerApiBase().replace(/\/+$/, ''), DOGEX_PUBLIC_INDEXER_URL].filter(
    (b, i, arr) => b && arr.indexOf(b) === i,
  );
}

async function fetchJsonQuiet(url: string, timeoutMs = 12_000): Promise<unknown | null> {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      ctrl && typeof window !== 'undefined'
        ? window.setTimeout(() => ctrl.abort(), timeoutMs)
        : null;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: ctrl?.signal,
    });
    if (timer != null) window.clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchFirstJson(paths: string[]): Promise<unknown | null> {
  for (const base of indexerBases()) {
    for (const path of paths) {
      const data = await fetchJsonQuiet(`${base}${path}`);
      if (data != null) return data;
    }
  }
  return null;
}

function normalizeTxid(raw: unknown): string | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return /^[0-9a-f]{64}$/.test(s) ? s : null;
}

/** Doginals inscription id → reveal txid (`<64hex>i<vout>`). */
export function txidFromInscriptionId(id: string): string | null {
  const m = String(id || '')
    .trim()
    .toLowerCase()
    .match(/^([0-9a-f]{64})i\d+$/);
  return m ? m[1] : null;
}

function formatGameLabel(game: unknown): string {
  const g = String(game ?? '')
    .trim()
    .toLowerCase();
  if (!g) return 'game';
  if (g === 'custom') return 'BLAZE';
  if (g === 'dogemax') return 'DogeMax';
  if (g === 'dmoon') return 'ÐMoon';
  if (g === '69420') return '69420';
  return g.charAt(0).toUpperCase() + g.slice(1);
}

function dgameOpLabel(op: unknown): { action: string; actionLabel: string } {
  const o = String(op ?? '')
    .trim()
    .toLowerCase();
  if (o === 'p' || o === 'payout') return { action: 'payout', actionLabel: 'Payout' };
  if (o === 'b' || o === 'bet') return { action: 'bet', actionLabel: 'Bet' };
  return { action: o || 'play', actionLabel: o ? o.toUpperCase() : 'Play' };
}

function enrichmentFromDgamesPlay(row: Record<string, unknown>): WalletTxEnrichment | null {
  const txid = normalizeTxid(row.txid);
  if (!txid) return null;
  const game = formatGameLabel(row.game);
  const { action, actionLabel } = dgameOpLabel(row.op);
  const betDoge =
    typeof row.betDoge === 'number'
      ? row.betDoge
      : typeof row.betKoinu === 'number'
        ? row.betKoinu / 1e8
        : undefined;
  const payoutDoge =
    typeof row.payoutDoge === 'number'
      ? row.payoutDoge
      : typeof row.payoutKoinu === 'number'
        ? (row.payoutKoinu as number) / 1e8
        : undefined;
  const pick = row.pick != null ? String(row.pick) : undefined;
  const isPayout = action === 'payout';
  const amountBit =
    isPayout && payoutDoge != null
      ? `${payoutDoge} Ð`
      : betDoge != null
        ? `${betDoge} Ð`
        : undefined;
  const title = isPayout ? `ÐGames payout · ${game}` : `ÐGames bet · ${game}`;
  const summaryParts = [
    amountBit,
    pick ? `pick ${pick}` : null,
    row.betTxid && isPayout ? `bet ${(String(row.betTxid).slice(0, 8))}…` : null,
  ].filter(Boolean);
  return {
    txid,
    protocol: 'dgames',
    action,
    actionLabel,
    title,
    summary: summaryParts.length ? summaryParts.join(' · ') : undefined,
    originLabel: 'dogecoin.games',
    indexed: true,
    metadata: {
      game: row.game,
      op: row.op,
      pick: row.pick,
      betKoinu: row.betKoinu,
      payoutKoinu: row.payoutKoinu,
      betTxid: row.betTxid,
      amountDoge: isPayout ? payoutDoge : betDoge,
    },
  };
}

function enrichmentFromDlottoTicket(row: Record<string, unknown>): WalletTxEnrichment | null {
  const insc = String(row.ticket_inscription_id ?? row.ticketInscriptionId ?? '');
  const txid = txidFromInscriptionId(insc);
  if (!txid) return null;
  const game = formatGameLabel(row.game);
  const status = String(row.status ?? 'active').toLowerCase();
  const picks = Array.isArray(row.picks) ? row.picks.join(',') : undefined;
  const round = String(row.round_id ?? row.roundId ?? '').slice(0, 10);
  const isWin = status === 'won' || status === 'winner' || status === 'claimed';
  return {
    txid,
    protocol: 'dlotto',
    action: isWin ? 'win' : 'ticket',
    actionLabel: isWin ? 'Win' : 'Ticket',
    title: `ÐLotto ticket · ${game}`,
    summary: [picks ? `picks ${picks}` : null, status, round ? `round ${round}…` : null]
      .filter(Boolean)
      .join(' · '),
    originLabel: 'dogecoin.games · ÐLotto',
    indexed: true,
    metadata: {
      ticketInscriptionId: insc,
      roundId: row.round_id ?? row.roundId,
      game: row.game,
      picks: row.picks,
      status,
    },
  };
}

function enrichmentFromAlkaneReceipt(
  txid: string,
  receipt: Record<string, unknown>,
): WalletTxEnrichment {
  const target = String(receipt.target ?? receipt.alkane ?? receipt.id ?? '').trim();
  const ok = receipt.success !== false && receipt.error == null;
  return {
    txid,
    protocol: 'alkanes',
    action: 'call',
    actionLabel: 'Call',
    title: target ? `Ðalkane call · ${target}` : 'Ðalkane call',
    summary: ok ? 'Indexed call receipt' : String(receipt.error ?? 'call failed'),
    originLabel: 'dogenals · Ðalkanes',
    indexed: true,
    metadata: { receipt },
  };
}

/** Address-scoped dogex pull: ÐGames plays + ÐLotto tickets. */
export async function fetchAddressProtocolEnrichments(
  address: string,
): Promise<Map<string, WalletTxEnrichment>> {
  const out = new Map<string, WalletTxEnrichment>();
  const addr = address.trim();
  if (!addr) return out;

  const [playsBody, ticketsBody] = await Promise.all([
    fetchFirstJson([
      `/api/dgames/plays?player=${encodeURIComponent(addr)}&op=all&limit=100`,
    ]),
    fetchFirstJson([
      `/api/dogelotto/tickets?address=${encodeURIComponent(addr)}&limit=100`,
    ]),
  ]);

  const plays =
    playsBody && typeof playsBody === 'object' && Array.isArray((playsBody as any).plays)
      ? ((playsBody as any).plays as unknown[])
      : [];
  for (const raw of plays) {
    if (!raw || typeof raw !== 'object') continue;
    const e = enrichmentFromDgamesPlay(raw as Record<string, unknown>);
    if (e) out.set(e.txid, e);
  }

  const tickets =
    ticketsBody && typeof ticketsBody === 'object' && Array.isArray((ticketsBody as any).tickets)
      ? ((ticketsBody as any).tickets as unknown[])
      : [];
  for (const raw of tickets) {
    if (!raw || typeof raw !== 'object') continue;
    const e = enrichmentFromDlottoTicket(raw as Record<string, unknown>);
    if (!e) continue;
    // Prefer dgames if somehow same txid (unlikely); otherwise set.
    if (!out.has(e.txid) || out.get(e.txid)!.protocol === 'dogecoin') {
      out.set(e.txid, e);
    }
  }

  return out;
}

/**
 * Probe dogex for txids still unlabeled (alkanes call receipts, single-play lookup).
 * Caps concurrency to keep the Transactions tab snappy.
 */
export async function probeTxProtocolEnrichments(
  txids: string[],
  already: Map<string, WalletTxEnrichment>,
  limit = 24,
): Promise<Map<string, WalletTxEnrichment>> {
  const out = new Map(already);
  const pending = txids
    .map((t) => t.trim().toLowerCase())
    .filter((t) => /^[0-9a-f]{64}$/.test(t) && !out.has(t))
    .slice(0, limit);

  const CONCURRENCY = 4;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (txid) => {
        const play = await fetchFirstJson([`/api/dgames/plays/${txid}`]);
        if (play && typeof play === 'object' && !(play as any).error && (play as any).txid) {
          const e = enrichmentFromDgamesPlay(play as Record<string, unknown>);
          if (e) {
            out.set(txid, e);
            return;
          }
        }
        const alk = await fetchFirstJson([`/api/alkanes/calls/${txid}`]);
        if (alk && typeof alk === 'object' && (alk as any).ok && (alk as any).receipt) {
          out.set(
            txid,
            enrichmentFromAlkaneReceipt(txid, (alk as any).receipt as Record<string, unknown>),
          );
        }
      }),
    );
  }
  return out;
}

/** Persist enrichments into the local journal so labels survive refreshes. */
export function applyEnrichmentsToJournal(
  address: string,
  enrichments: Iterable<WalletTxEnrichment>,
): void {
  for (const e of enrichments) {
    upsertWalletTxJournalEntry({
      txid: e.txid,
      address,
      protocol: e.protocol,
      action: e.action,
      title: e.title,
      summary: e.summary,
      status: e.indexed ? 'indexed' : 'seen',
      originLabel: e.originLabel,
      originHost: e.originLabel?.includes('dogecoin.games')
        ? 'dogecoin.games'
        : e.originLabel?.includes('dogenals')
          ? 'dogenals.com'
          : undefined,
      metadata: {
        ...e.metadata,
        actionLabel: e.actionLabel,
        protocolLabel: walletTxProtocolLabel(e.protocol),
        source: 'dogex-enrichment',
      },
    });
  }
}

export function enrichmentActionLabel(entry?: DojakwebWalletTxEntry | null): string | undefined {
  const fromMeta = entry?.metadata?.actionLabel;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
  const a = entry?.action?.trim().toLowerCase();
  if (!a) return undefined;
  if (a === 'bet') return 'Bet';
  if (a === 'payout') return 'Payout';
  if (a === 'ticket') return 'Ticket';
  if (a === 'win') return 'Win';
  if (a === 'call') return 'Call';
  if (a === 'send') return 'Send';
  if (a === 'mint') return 'Mint';
  return a.charAt(0).toUpperCase() + a.slice(1);
}

/**
 * Full enrich pass for the Transactions tab: address indexes + probes for
 * visible history txids that are still plain Dogecoin / unknown.
 */
export async function enrichWalletTransactionsForAddress(
  address: string,
  visibleTxids: string[],
): Promise<Map<string, WalletTxEnrichment>> {
  const byAddress = await fetchAddressProtocolEnrichments(address);
  applyEnrichmentsToJournal(address, byAddress.values());

  const needProbe = visibleTxids.filter((t) => {
    const id = t.trim().toLowerCase();
    return /^[0-9a-f]{64}$/.test(id) && !byAddress.has(id);
  });
  if (!needProbe.length) return byAddress;

  const probed = await probeTxProtocolEnrichments(needProbe, byAddress);
  const fresh: WalletTxEnrichment[] = [];
  for (const [txid, e] of probed) {
    if (!byAddress.has(txid)) fresh.push(e);
  }
  if (fresh.length) applyEnrichmentsToJournal(address, fresh);
  return probed;
}
