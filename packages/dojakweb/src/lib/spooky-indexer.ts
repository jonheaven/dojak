/**
 * Spooky Doge indexer — read-only cross-check beside doggy.market / MyDoge / dogex.
 * CORS is open (`access-control-allow-origin: *`). Do not broadcast here.
 *
 * Extension 1.3.0 calls `https://api.spookydoge.xyz/v1`.
 */

export const SPOOKY_API_BASE = 'https://api.spookydoge.xyz/v1';

export type SpookyInscription = {
  inscriptionId: string;
  inscriptionNumber?: number;
  contentType?: string;
  contentUrl: string;
  output?: string;
  owner?: string;
  satpointOffset?: number;
  blockHeight?: number;
  outputValueKoinu?: number;
};

/** Shape matches the wallet inscription list so it can be merged by id. */
export type SpookyListedInscription = {
  address: string;
  content: string;
  contentBody: string;
  contentLength: number;
  contentType: string;
  genesisTransaction: string;
  inscriptionId: string;
  inscriptionNumber: number;
  output: string;
  outputValue: string;
  preview: string;
  timestamp: number;
  height: number;
  location: string;
};

export type SpookyDrc20Holding = {
  ticker: string;
  balance: string;
  transferable: string;
  available: string;
};

function normId(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^([0-9a-fA-F]{64}i\d+)/);
  return m ? m[1] : t;
}

function validId(raw: string): string | null {
  const id = normId(raw);
  return /^[0-9a-fA-F]{64}i\d+$/.test(id) ? id : null;
}

export function spookyInscriptionContentUrl(inscriptionId: string): string {
  return `https://cdn.spookydoge.xyz/content/${encodeURIComponent(normId(inscriptionId))}`;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function mapInscription(j: Record<string, unknown>, fallbackId: string): SpookyInscription | null {
  const inscriptionId = validId(String(j.inscription_id ?? j.inscriptionId ?? fallbackId));
  if (!inscriptionId) return null;
  const output = typeof j.output === 'string' ? j.output.trim() : '';
  const offsetRaw = j.satpoint_offset ?? j.offset;
  const shibes = Number(j.amount_shibes);
  return {
    inscriptionId,
    inscriptionNumber:
      typeof j.inscription_number === 'number'
        ? j.inscription_number
        : typeof j.inscriptionNumber === 'number'
          ? j.inscriptionNumber
          : undefined,
    contentType: typeof j.content_type === 'string' ? j.content_type : typeof j.contentType === 'string' ? j.contentType : undefined,
    contentUrl: typeof j.content_url === 'string' && j.content_url.trim() ? j.content_url.trim() : spookyInscriptionContentUrl(inscriptionId),
    output: output.includes(':') ? output : undefined,
    owner: typeof j.owner_address === 'string' ? j.owner_address : typeof j.owner === 'string' ? j.owner : undefined,
    satpointOffset: typeof offsetRaw === 'number' && offsetRaw >= 0 ? offsetRaw : undefined,
    blockHeight: typeof j.block_height === 'number' ? j.block_height : undefined,
    outputValueKoinu: Number.isFinite(shibes) && shibes > 0 ? Math.round(shibes) : undefined,
  };
}

export async function fetchSpookyInscription(
  inscriptionId: string,
  signal?: AbortSignal,
): Promise<SpookyInscription | null> {
  const id = validId(inscriptionId);
  if (!id) return null;
  const j = await getJson(`${SPOOKY_API_BASE}/inscriptions/${encodeURIComponent(id)}`, signal);
  if (!j || typeof j !== 'object') return null;
  return mapInscription(j as Record<string, unknown>, id);
}

/** First page only. Spooky is a cross-check, not the wallet's full archive. */
export async function fetchSpookyWalletInscriptions(
  address: string,
  signal?: AbortSignal,
): Promise<SpookyListedInscription[]> {
  const addr = address.trim();
  if (!addr) return [];
  const j = await getJson(
    `${SPOOKY_API_BASE}/wallet/${encodeURIComponent(addr)}/nfts?offset=0&limit=100`,
    signal,
  );
  const rows = j && typeof j === 'object' && Array.isArray((j as { nfts?: unknown }).nfts)
    ? ((j as { nfts: unknown[] }).nfts)
    : [];
  const out: SpookyListedInscription[] = [];
  for (const row of rows.slice(0, 100)) {
    if (!row || typeof row !== 'object') continue;
    const meta = mapInscription(row as Record<string, unknown>, '');
    if (!meta?.output) continue;
    const txid = meta.inscriptionId.slice(0, 64);
    out.push({
      address: addr,
      content: meta.contentUrl,
      contentBody: '',
      contentLength: 0,
      contentType: meta.contentType || '',
      genesisTransaction: txid,
      inscriptionId: meta.inscriptionId,
      inscriptionNumber: meta.inscriptionNumber ?? 0,
      output: meta.output,
      outputValue: String(meta.outputValueKoinu ?? 100_000),
      preview: meta.contentUrl,
      timestamp: 0,
      height: meta.blockHeight ?? 0,
      location: meta.output,
    });
  }
  return out;
}

export async function fetchSpookyDrc20Holdings(
  address: string,
  signal?: AbortSignal,
): Promise<SpookyDrc20Holding[]> {
  const addr = address.trim();
  if (!addr) return [];
  const j = await getJson(`${SPOOKY_API_BASE}/wallet/${encodeURIComponent(addr)}/holdings`, signal);
  const rows = j && typeof j === 'object' && Array.isArray((j as { holdings?: unknown }).holdings)
    ? ((j as { holdings: unknown[] }).holdings)
    : [];
  const out: SpookyDrc20Holding[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const ticker = String(r.tick ?? r.ticker ?? '').trim();
    if (!ticker) continue;
    out.push({
      ticker,
      balance: String(r.total_balance ?? r.balance ?? '0'),
      available: String(r.available_balance ?? r.available ?? '0'),
      transferable: String(r.transferable_balance ?? r.transferable ?? '0'),
    });
  }
  return out;
}
