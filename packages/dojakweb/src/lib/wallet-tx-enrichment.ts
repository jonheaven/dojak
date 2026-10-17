/**
 * Enrich wallet history rows from dogex metaprotocol indexes
 * (ÐGames, ÐLotto, Ðalkanes, …) so the Transactions tab can label bets,
 * payouts, tickets, and contract calls — not just plain Dogecoin sends.
 */

import { getCommandDogApiBaseUrl, getIndexerFetchBases } from '../utils/api';
import { classifyDnsInscription, revealHistoryFromHex } from './incoming-tx-alerts';
import { dnsNameFromBody } from '../utils/inscription-text';
import { gatedMydogeGetJson } from './mydoge/httpGate';
import {
  loadWalletTxJournal,
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
  return getIndexerFetchBases();
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

async function fetchTextQuiet(url: string, timeoutMs = 8_000): Promise<string | null> {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      ctrl && typeof window !== 'undefined'
        ? window.setTimeout(() => ctrl.abort(), timeoutMs)
        : null;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'text/plain, application/json, text/html' },
      signal: ctrl?.signal,
    });
    if (timer != null) window.clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.startsWith('image/') || ct.includes('octet-stream')) return null;
    const text = (await res.text()).replace(/^\uFEFF/, '').trim();
    if (!text || text.length > 240 || text.includes('\0')) return null;
    return text;
  } catch {
    return null;
  }
}

async function fetchFirstText(paths: string[]): Promise<string | null> {
  for (const base of indexerBases()) {
    for (const path of paths) {
      const text = await fetchTextQuiet(`${base}${path}`);
      if (text) return text;
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
    summary: ok
      ? 'Indexed call receipt'
      : /status\s+8/i.test(String(receipt.error ?? ''))
        ? `${receipt.error} · off-window`
        : String(receipt.error ?? 'call failed'),
    originLabel: 'dogenals · Ðalkanes',
    indexed: true,
    metadata: { receipt },
  };
}

function enrichmentFromDlockerLock(row: Record<string, unknown>): WalletTxEnrichment | null {
  const txid = normalizeTxid(row.txid);
  if (!txid) return null;
  const status = String(row.status ?? 'active').toLowerCase();
  const lockType = String(row.lockType ?? row.lock_type ?? 'doge').toLowerCase();
  const duneName = String(row.duneName ?? row.dune_name ?? '').trim();
  const duneAmount = String(row.duneAmount ?? row.dune_amount ?? '').trim();
  const inscriptionId = String(row.inscriptionId ?? row.inscription_id ?? '').trim();
  const amountDoge =
    typeof row.amountDoge === 'number'
      ? row.amountDoge
      : typeof row.amountKoinu === 'number'
        ? (row.amountKoinu as number) / 1e8
        : undefined;
  const asset =
    lockType === 'dune' && duneName
      ? duneName
      : lockType === 'inscription'
        ? inscriptionId
          ? `${inscriptionId.slice(0, 10)}…`
          : 'inscription'
        : 'DOGE';
  const action = 'lock';
  return {
    txid,
    protocol: 'dlocker',
    action,
    actionLabel: 'Lock',
    title: `Lock ${asset}`,
    summary: [
      duneAmount && duneName ? `${duneAmount} ${duneName}` : amountDoge != null ? `${amountDoge} Ð` : null,
      inscriptionId || null,
      status,
    ]
      .filter(Boolean)
      .join(' · '),
    originLabel: 'dogenals · ÐLocker',
    indexed: true,
    metadata: {
      lockType,
      status,
      amountDoge,
      duneName: duneName || undefined,
      duneAmount: duneAmount || undefined,
      amountDisplay: duneAmount || undefined,
      locktimeUnix: row.locktimeUnix ?? row.locktime_unix,
      vout: row.vout,
      unlockTxid: row.unlockTxid,
      inscriptionId: inscriptionId || undefined,
    },
  };
}

export async function fetchAddressProtocolEnrichments(
  address: string,
): Promise<Map<string, WalletTxEnrichment>> {
  const out = new Map<string, WalletTxEnrichment>();
  const addr = address.trim();
  if (!addr) return out;

  const [playsBody, ticketsBody, locksBody, dnsBody] = await Promise.all([
    fetchFirstJson([
      `/api/dgames/plays?player=${encodeURIComponent(addr)}&op=all&limit=100`,
    ]),
    fetchFirstJson([
      `/api/dogelotto/tickets?address=${encodeURIComponent(addr)}&limit=100`,
    ]),
    fetchFirstJson([
      `/api/dlocker/address/${encodeURIComponent(addr)}?status=all&limit=100`,
    ]),
    fetchFirstJson([
      `/api/dns/address/${encodeURIComponent(addr)}?limit=200`,
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

  const locks =
    locksBody && typeof locksBody === 'object' && Array.isArray((locksBody as any).locks)
      ? ((locksBody as any).locks as unknown[])
      : [];
  for (const raw of locks) {
    if (!raw || typeof raw !== 'object') continue;
    const e = enrichmentFromDlockerLock(raw as Record<string, unknown>);
    if (!e) continue;
    const existing = out.get(e.txid);
    if (!existing || existing.protocol === 'dogecoin' || existing.protocol === 'dunes') {
      out.set(e.txid, e);
    }
    const unlockTxid = normalizeTxid((raw as Record<string, unknown>).unlockTxid);
    if (unlockTxid && unlockTxid !== e.txid) {
      out.set(unlockTxid, {
        ...e,
        txid: unlockTxid,
        action: 'unlock',
        actionLabel: 'Unlock',
        title: e.title.replace(/^Lock /, 'Unlock '),
      });
    }
  }

  const dnsNames =
    dnsBody && typeof dnsBody === 'object' && Array.isArray((dnsBody as any).names)
      ? ((dnsBody as any).names as unknown[])
      : [];
  for (const raw of dnsNames) {
    if (!raw || typeof raw !== 'object') continue;
    for (const e of enrichmentsFromDnsName(raw as Record<string, unknown>)) {
      const existing = out.get(e.txid);
      if (!existing || existing.protocol === 'dogecoin' || existing.protocol === 'doginals') {
        out.set(e.txid, e);
      }
    }
  }

  return out;
}

function enrichmentsFromDnsName(row: Record<string, unknown>): WalletTxEnrichment[] {
  const name = String(row.name || '').trim().toLowerCase();
  if (!name) return [];
  const out: WalletTxEnrichment[] = [];
  const regId = String(row.inscription_id || row.inscriptionId || '').trim();
  const regTxid = txidFromInscriptionId(regId);
  if (regTxid) {
    out.push({
      txid: regTxid,
      protocol: 'dns',
      action: 'register',
      actionLabel: 'Register',
      title: `Register · ${name}`,
      summary: name,
      originLabel: 'dogecoin.dog · DNS',
      indexed: true,
      metadata: { name, inscriptionId: regId, actionLabel: 'Register' },
    });
  }
  const cfgId = String(row.config_inscription_id || row.configInscriptionId || '').trim();
  const cfgTxid = txidFromInscriptionId(cfgId);
  if (cfgTxid && cfgTxid !== regTxid) {
    out.push({
      txid: cfgTxid,
      protocol: 'dns',
      action: 'config',
      actionLabel: 'Config',
      title: `Config · ${name}`,
      summary: name,
      originLabel: 'dogecoin.dog · DNS',
      indexed: true,
      metadata: { name, inscriptionId: cfgId, actionLabel: 'Config' },
    });
  }
  return out;
}

/**
 * Probe dogex for txids still unlabeled (alkanes call receipts, single-play lookup, Ðune outs).
 * Caps concurrency to keep the Transactions tab snappy.
 */
export async function probeTxProtocolEnrichments(
  txids: string[],
  already: Map<string, WalletTxEnrichment>,
  limit = 48,
  address?: string,
): Promise<Map<string, WalletTxEnrichment>> {
  const out = new Map(already);
  const pending = txids
    .map((t) => t.trim().toLowerCase())
    .filter((t) => /^[0-9a-f]{64}$/.test(t) && !out.has(t))
    .slice(0, limit);

  const mydogeRows = address ? await fetchMydogeInscriptionRows(address) : [];

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
          return;
        }
        const dlock = await fetchFirstJson([`/api/dlocker/tx/${txid}`]);
        if (dlock && typeof dlock === 'object' && Array.isArray((dlock as any).locks) && (dlock as any).locks.length) {
          const e = enrichmentFromDlockerLock((dlock as any).locks[0] as Record<string, unknown>);
          if (e) {
            out.set(txid, e);
            return;
          }
        }
        const market = await fetchFirstJson([`/api/marketplace/tx/${txid}`]);
        if (market && typeof market === 'object' && !(market as any).error) {
          const e = await enrichmentFromMarketplace(
            txid,
            market as Record<string, unknown>,
            mydogeRows,
          );
          if (e) {
            out.set(txid, e);
            return;
          }
        }
        const located = enrichmentFromInscriptionLocation(txid, mydogeRows);
        if (located) {
          out.set(txid, located);
          return;
        }
        const revealed = await enrichmentFromRevealTx(txid);
        if (revealed) {
          out.set(txid, revealed);
          return;
        }
        const dune = await enrichmentFromDuneOutpoints(txid);
        if (dune) out.set(txid, dune);
      }),
    );
  }
  return out;
}

type MydogeInscriptionRow = {
  inscriptionId?: string;
  inscriptionNumber?: number;
  output?: string;
  location?: string;
};

function outpointKey(raw: string | undefined): string {
  const parts = String(raw || '')
    .trim()
    .toLowerCase()
    .split(':');
  if (parts.length >= 2 && /^[0-9a-f]{64}$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
    return `${parts[0]}:${Number(parts[1])}`;
  }
  return '';
}

async function fetchMydogeInscriptionRows(address: string): Promise<MydogeInscriptionRow[]> {
  try {
    const body = await gatedMydogeGetJson(
      `https://api.mydoge.com/inscriptions/${encodeURIComponent(address)}`,
    );
    if (!body || typeof body !== 'object') return [];
    const list = Array.isArray((body as { list?: unknown[] }).list)
      ? ((body as { list: unknown[] }).list)
      : Array.isArray(body)
        ? (body as unknown[])
        : [];
    return list.filter((row) => row && typeof row === 'object') as MydogeInscriptionRow[];
  } catch {
    return [];
  }
}

function findMydogeAt(rows: MydogeInscriptionRow[], txid: string, vout?: number): MydogeInscriptionRow | null {
  const want = vout == null ? '' : `${txid}:${vout}`;
  for (const row of rows) {
    const op = outpointKey(row.output) || outpointKey(row.location);
    if (want && op === want) return row;
    if (!want && op.startsWith(`${txid}:`)) return row;
  }
  return null;
}

function enrichmentFromInscriptionLocation(
  txid: string,
  rows: MydogeInscriptionRow[],
): WalletTxEnrichment | null {
  const hit = findMydogeAt(rows, txid);
  const id = String(hit?.inscriptionId ?? '').trim();
  if (!hit || !id) return null;
  const num = hit.inscriptionNumber;
  return {
    txid,
    protocol: 'doginals',
    action: 'transfer',
    actionLabel: 'NFT',
    title: typeof num === 'number' ? `#${num}` : `${id.slice(0, 10)}…`,
    summary: id,
    indexed: true,
    metadata: { inscriptionId: id, inscriptionNumber: num },
  };
}

type MarketNft = {
  inscriptionId?: string;
  vout?: number;
  postageKoinu?: string | number;
  media?: { doggyCdn?: string; dogexContent?: string };
};

export type InscriptionMoveDetail = {
  contentType?: string;
  previewUrl?: string;
  /** Short plain body, or a DNS name pulled out of it. */
  contentPreview?: string;
};

function marketNfts(row: Record<string, unknown>): MarketNft[] {
  return Array.isArray(row.nfts) ? (row.nfts as MarketNft[]) : [];
}

function inscriptionIdFromMarket(
  txid: string,
  row: Record<string, unknown>,
  mydogeRows: MydogeInscriptionRow[],
): string {
  const nfts = marketNfts(row);
  const direct = nfts.map((n) => String(n.inscriptionId ?? '').trim()).find(Boolean) || '';
  if (direct) return direct;
  const vout = nfts.find((n) => n.vout != null)?.vout;
  return String(findMydogeAt(mydogeRows, txid, vout)?.inscriptionId ?? '').trim();
}

function previewUrlFromMarket(row: Record<string, unknown>): string {
  const nft = marketNfts(row).find((n) => n.media?.doggyCdn || n.media?.dogexContent);
  return String(nft?.media?.doggyCdn || nft?.media?.dogexContent || '').trim();
}

function postageDogeFromMarket(row: Record<string, unknown>): number | undefined {
  const raw = marketNfts(row).find((n) => n.postageKoinu != null)?.postageKoinu;
  if (raw == null) return undefined;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n / 1e8;
}

function hexFromRawBody(body: string): string {
  let hex = body.trim().toLowerCase().replace(/^0x/, '').replace(/^"|"$/g, '');
  try {
    const json = JSON.parse(body) as { hex?: string; raw?: string; result?: string } | string;
    if (typeof json === 'string') hex = json;
    else hex = String(json.hex ?? json.raw ?? json.result ?? hex);
  } catch {
    /* plain hex */
  }
  hex = hex.trim().toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{100,}$/.test(hex) ? hex : '';
}

async function fetchRevealHex(txid: string): Promise<string | null> {
  for (const base of indexerBases()) {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer =
        ctrl && typeof window !== 'undefined' ? window.setTimeout(() => ctrl.abort(), 6_000) : null;
      const res = await fetch(`${base}/api/tx/${encodeURIComponent(txid)}/raw`, {
        cache: 'no-store',
        headers: { Accept: 'application/json,text/plain' },
        signal: ctrl?.signal,
      });
      if (timer != null) window.clearTimeout(timer);
      if (!res.ok) continue;
      const hex = hexFromRawBody(await res.text());
      if (hex) return hex;
    } catch {
      /* try next base */
    }
  }
  if (typeof window === 'undefined') return null;
  const commandDog = getCommandDogApiBaseUrl().trim().replace(/\/+$/, '');
  if (!commandDog) return null;
  try {
    const res = await fetch(`${commandDog}/rpc/getrawtransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ params: [txid, false] }),
    });
    if (!res.ok) return null;
    const hex = hexFromRawBody(await res.text());
    return hex || null;
  } catch {
    return null;
  }
}

/** Plain-name and JSON DNS bodies are a register, not a generic inscription send. */
export function withDnsRegisterLabel(row: WalletTxEnrichment): WalletTxEnrichment {
  const preview = String(row.metadata?.contentPreview ?? row.title ?? '');
  const contentType = typeof row.metadata?.contentType === 'string' ? row.metadata.contentType : undefined;
  const dns = classifyDnsInscription(preview, contentType);
  if (!dns) return row;
  const action = dns.kind === 'config' || dns.kind === 'primary' ? dns.kind : 'register';
  const actionLabel = action === 'config' ? 'Config' : action === 'primary' ? 'Primary' : 'Register';
  return {
    ...row,
    protocol: 'dns',
    action,
    actionLabel,
    title: dns.name,
    summary: 'Received doginal',
    originLabel: row.originLabel || 'dogecoin.dog · DNS',
    metadata: {
      ...row.metadata,
      name: dns.name,
      contentType: contentType || 'text/plain',
      contentPreview: dns.name,
      actionLabel,
    },
  };
}

/** Doginals reveal (bulk cart or single mint) read from raw tx hex. */
export function enrichmentFromRevealHex(txid: string, hex: string): WalletTxEnrichment | null {
  const id = txid.trim().toLowerCase();
  const label = revealHistoryFromHex(hex);
  if (!label || !/^[0-9a-f]{64}$/.test(id)) return null;
  return {
    txid: id,
    protocol: label.protocol,
    action: label.action,
    actionLabel: label.actionLabel,
    title: label.title,
    summary: label.summary,
    originLabel: label.protocol === 'dns' ? 'dogecoin.dog · DNS' : undefined,
    indexed: true,
    metadata: {
      name: label.name,
      inscriptionId: `${id}i0`,
      contentType: label.contentType,
      contentPreview: label.contentPreview,
      postageDoge: label.protocol === 'dns' ? 0.001 : undefined,
      actionLabel: label.actionLabel,
    },
  };
}

async function enrichmentFromRevealTx(txid: string): Promise<WalletTxEnrichment | null> {
  const hex = await fetchRevealHex(txid);
  if (!hex) return null;
  return enrichmentFromRevealHex(txid, hex);
}

function contentLabel(detail?: InscriptionMoveDetail): string {
  const preview = detail?.contentPreview?.trim() || '';
  if (!preview) return '';
  return dnsNameFromBody(preview) || preview.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 80) || '';
}

/**
 * Doginal gift / self-move. dogex `kind: "transfer"` is not a sale — the wallet
 * was showing the net DOGE delta (postage + fee) as a plain payment.
 */
export function inscriptionMoveEnrichment(
  txid: string,
  row: Record<string, unknown>,
  detail?: InscriptionMoveDetail,
  mydogeRows: MydogeInscriptionRow[] = [],
): WalletTxEnrichment | null {
  const kind = String(row.kind ?? '');
  if (kind !== 'transfer' && kind !== 'self_move') return null;
  const inscriptionId = inscriptionIdFromMarket(txid, row, mydogeRows);
  if (!inscriptionId) return null;
  const seller = typeof row.seller === 'string' ? row.seller : '';
  const buyer = typeof row.buyer === 'string' ? row.buyer : '';
  const label = contentLabel(detail);
  const self = kind === 'self_move';
  const summary =
    typeof row.summary === 'string' && row.summary.trim()
      ? row.summary.trim()
      : self
        ? 'Inscription self-move'
        : 'Inscription transfer';
  const postageDoge = postageDogeFromMarket(row);
  const previewUrl = detail?.previewUrl?.trim() || previewUrlFromMarket(row);
  return {
    txid,
    protocol: 'doginals',
    action: 'send',
    actionLabel: self ? 'Move' : 'Send',
    title: label || (self ? 'Inscription self-move' : 'Inscription transfer'),
    summary,
    indexed: true,
    metadata: {
      inscriptionId,
      contentType: detail?.contentType || undefined,
      previewUrl: previewUrl || undefined,
      contentPreview: label || undefined,
      seller: seller || undefined,
      buyer: buyer || undefined,
      recipientAddress: buyer || undefined,
      postageDoge,
      actionLabel: self ? 'Move' : 'Send',
    },
  };
}

async function fetchInscriptionMoveDetail(inscriptionId: string): Promise<InscriptionMoveDetail> {
  const body = await fetchFirstJson([`/inscription/${encodeURIComponent(inscriptionId)}`]);
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const contentType = String(row.contentType ?? row.content_type ?? '').trim();
  const previewUrl = String(row.preview ?? '').trim();
  const length = Number(row.contentLength ?? row.content_length ?? NaN);
  const textual =
    !contentType ||
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml');
  let contentPreview = '';
  if (textual && (!Number.isFinite(length) || length <= 240)) {
    const text = await fetchFirstText([`/cdn/content/${encodeURIComponent(inscriptionId)}`]);
    if (text) contentPreview = text;
  }
  return {
    ...(contentType ? { contentType } : {}),
    ...(previewUrl ? { previewUrl } : {}),
    ...(contentPreview ? { contentPreview } : {}),
  };
}

async function enrichmentFromMarketplace(
  txid: string,
  row: Record<string, unknown>,
  mydogeRows: MydogeInscriptionRow[] = [],
): Promise<WalletTxEnrichment | null> {
  const kind = String(row.kind ?? '');
  if (kind === 'transfer' || kind === 'self_move') {
    const inscriptionId = inscriptionIdFromMarket(txid, row, mydogeRows);
    const detail = inscriptionId ? await fetchInscriptionMoveDetail(inscriptionId) : undefined;
    const moved = inscriptionMoveEnrichment(txid, row, detail, mydogeRows);
    return moved ? withDnsRegisterLabel(moved) : null;
  }
  if (kind !== 'marketplace_sale' && kind !== 'otc_sale') return null;
  const venue = String(row.venue ?? 'openordex').trim() || 'openordex';
  const seller = typeof row.seller === 'string' ? row.seller : '';
  const buyer = typeof row.buyer === 'string' ? row.buyer : '';
  const price =
    typeof row.grossPriceDoge === 'number'
      ? row.grossPriceDoge
      : typeof row.sellerProceedsDoge === 'number'
        ? row.sellerProceedsDoge
        : undefined;
  const inscriptionId = inscriptionIdFromMarket(txid, row, mydogeRows);
  const num = inscriptionId ? findMydogeAt(mydogeRows, txid)?.inscriptionNumber : undefined;
  const summary =
    typeof row.summary === 'string' && row.summary.trim()
      ? row.summary.trim()
      : `${venue} sale${price != null ? ` · ${price} Ð` : ''}`;
  const title = num != null ? `${venue} #${num}` : venue === 'openordex' ? 'NFT sale' : venue;
  const previewUrl = previewUrlFromMarket(row);
  return {
    txid,
    protocol: 'marketplace',
    action: 'buy',
    actionLabel: 'Buy',
    title,
    summary: inscriptionId ? `${summary} · ${inscriptionId.slice(0, 12)}…` : summary,
    originLabel: venue === 'openordex' ? 'OpenOrdex' : venue,
    indexed: true,
    metadata: {
      venue,
      seller: seller || undefined,
      buyer: buyer || undefined,
      grossPriceDoge: price,
      inscriptionId: inscriptionId || undefined,
      previewUrl: previewUrl || undefined,
      amountDisplay: price != null ? `${price} Ð` : undefined,
    },
  };
}

export type WalletTxInscriptionFace = {
  inscriptionId: string;
  contentType?: string;
  previewUrl?: string;
  contentPreview?: string;
  postageDoge?: number;
};

/** Inscription carried by a history row, from the journal enrichment metadata. */
export function inscriptionFaceFromWalletTx(row: {
  journal?: { metadata?: Record<string, unknown> } | null;
}): WalletTxInscriptionFace | null {
  const meta = row.journal?.metadata;
  if (!meta) return null;
  const inscriptionId = String(meta.inscriptionId ?? '').trim();
  if (!/^[0-9a-f]{64}i\d+$/i.test(inscriptionId)) return null;
  const postage = meta.postageDoge;
  return {
    inscriptionId,
    contentType: typeof meta.contentType === 'string' ? meta.contentType : undefined,
    previewUrl: typeof meta.previewUrl === 'string' ? meta.previewUrl : undefined,
    contentPreview: typeof meta.contentPreview === 'string' ? meta.contentPreview : undefined,
    postageDoge: typeof postage === 'number' && postage > 0 ? postage : undefined,
  };
}

/** dogex `/api/dunes/outpoint/:txid/:vout` — Ðune amount lives here, not in MyDoge DOGE history. */
async function enrichmentFromDuneOutpoints(txid: string): Promise<WalletTxEnrichment | null> {
  // Standard Ðune send: OP_RETURN(0) → recipient postage(1) → change(2). Prefer vout 1.
  const order = [1, 0, 2, 3, 4, 5];
  for (const vout of order) {
    const body = await fetchFirstJson([`/api/dunes/outpoint/${txid}/${vout}`]);
    if (!body || typeof body !== 'object') continue;
    const dunes = Array.isArray((body as any).dunes) ? ((body as any).dunes as unknown[]) : [];
    if (!dunes.length && !(body as any).has_dunes) continue;
    const row = (dunes[0] && typeof dunes[0] === 'object' ? dunes[0] : null) as Record<
      string,
      unknown
    > | null;
    if (!row) continue;
    const amount = String(row.amount ?? row.balance ?? '').trim();
    if (!amount || amount === '0') continue;
    const spaced = String(row.spaced_name ?? row.spacedName ?? '').trim();
    const name = String(row.name ?? row.dune ?? row.ticker ?? '').trim();
    const label = spaced || name || String(row.dune_id ?? row.id ?? 'Ðune');
    const duneId = String(row.dune_id ?? row.id ?? '').trim();
    return {
      txid,
      protocol: 'dunes',
      action: 'transfer',
      // No actionLabel — protocol chip already says Ðunes; title is the token name.
      title: label,
      summary: `${amount} ${label}`,
      indexed: true,
      metadata: {
        amount,
        duneName: label,
        duneId: duneId || undefined,
        outpointVout: vout,
        amountDisplay: amount,
      },
    };
  }
  return null;
}

/** Persist enrichments into the local journal so labels survive refreshes. */
export function applyEnrichmentsToJournal(
  address: string,
  enrichments: Iterable<WalletTxEnrichment>,
): void {
  const owner = address.trim();
  const journal = loadWalletTxJournal();
  for (const e of enrichments) {
    const existing = journal.find((row) => row.txid === e.txid);
    if (existing?.address && existing.address !== owner) continue;
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
  if (a === 'lock') return 'Lock';
  if (a === 'unlock') return 'Unlock';
  if (a === 'send') return 'Send';
  if (a === 'receive') return 'Receive';
  if (a === 'register') return 'Register';
  if (a === 'config') return 'Config';
  if (a === 'primary') return 'Primary';
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

  const journal = loadWalletTxJournal();
  const alreadyDns = new Set(
    journal.filter((row) => row.txid && row.protocol === 'dns').map((row) => row.txid as string),
  );
  const needProbe = visibleTxids.filter((t) => {
    const id = t.trim().toLowerCase();
    return /^[0-9a-f]{64}$/.test(id) && !byAddress.has(id) && !alreadyDns.has(id);
  });
  if (!needProbe.length) return byAddress;

  const probed = await probeTxProtocolEnrichments(needProbe, byAddress, 48, address);
  const fresh: WalletTxEnrichment[] = [];
  for (const [txid, e] of probed) {
    if (!byAddress.has(txid)) fresh.push(e);
  }
  if (fresh.length) applyEnrichmentsToJournal(address, fresh);
  return probed;
}
