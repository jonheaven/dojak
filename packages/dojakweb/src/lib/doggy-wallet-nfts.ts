/**
 * doggy.market wallet NFT bag — `GET /wallet/:addr/nfts`.
 *
 * Browser → api.doggy.market is CORS-blocked (ACAO is doggy.market only).
 * Always hit same-origin `/api/doggy` or command.dog `/v1/doggy` proxies.
 *
 * MyDoge `/inscriptions/:addr` and Spooky `/wallet/:addr/nfts` have been empty / 500;
 * Doggy remains the reliable Era-1 Doginals inventory source.
 */

export type DoggyListedInscription = {
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

const DOGGY_WALLET_PAGE = 100;
const DOGGY_WALLET_MAX = 5_000;
const PAGE_TIMEOUT_MS = 12_000;

function normId(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^([0-9a-fA-F]{64}i\d+)/);
  return m ? m[1] : t;
}

function validId(raw: string): string | null {
  const id = normId(raw);
  return /^[0-9a-fA-F]{64}i\d+$/.test(id) ? id : null;
}

export function doggyInscriptionContentUrl(inscriptionId: string): string {
  return `https://cdn.doggy.market/content/${encodeURIComponent(normId(inscriptionId))}`;
}

/**
 * Never call api.doggy.market from the browser (CORS is doggy-only).
 * Prefer absolute command.dog — Vercel Hobby catch-all `api/[...path]` 404s
 * `/api/doggy/*` and `/api/commanddog/*` before rewrites can help. Local Express
 * still mounts `/api/doggy` for the tunnel stack.
 */
function doggyProxyBases(): string[] {
  const bases: string[] = [
    'https://api.command.dog/v1/doggy',
    '/api/doggy',
    '/api/commanddog/v1/doggy',
  ];
  return [...new Set(bases.map((b) => b.replace(/\/+$/, '')))];
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
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

async function getWalletNftsPage(
  address: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<{ rows: unknown[]; total: number } | null> {
  const path = `/wallet/${encodeURIComponent(address)}/nfts?offset=${offset}&limit=${limit}`;
  for (const base of doggyProxyBases()) {
    const j = await getJson(`${base}${path}`, signal);
    if (!j || typeof j !== 'object') continue;
    const obj = j as { data?: unknown; total?: unknown };
    const rows = Array.isArray(obj.data) ? obj.data : [];
    const total = typeof obj.total === 'number' && Number.isFinite(obj.total) ? obj.total : rows.length;
    return { rows, total };
  }
  return null;
}

function mapListedRow(addr: string, row: unknown): DoggyListedInscription | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const inscriptionId = validId(String(r.inscriptionId ?? r.inscription_id ?? ''));
  if (!inscriptionId) return null;
  const outputRaw = typeof r.output === 'string' ? r.output.trim() : '';
  if (!outputRaw.includes(':')) return null;
  const contentType = typeof r.contentType === 'string' ? r.contentType : typeof r.content_type === 'string' ? r.content_type : '';
  const contentUrl = doggyInscriptionContentUrl(inscriptionId);
  const inscribedAt = typeof r.inscribedAt === 'string' ? Date.parse(r.inscribedAt) : NaN;
  const owner = typeof r.owner === 'string' && r.owner.trim() ? r.owner.trim() : addr;
  return {
    address: owner,
    content: contentUrl,
    contentBody: '',
    contentLength: typeof r.contentLength === 'number' ? r.contentLength : 0,
    contentType,
    genesisTransaction: inscriptionId.slice(0, 64),
    inscriptionId,
    inscriptionNumber: typeof r.inscriptionNumber === 'number' ? r.inscriptionNumber : 0,
    output: outputRaw,
    outputValue: String(r.outputValue ?? 100_000),
    preview: contentUrl,
    timestamp: Number.isFinite(inscribedAt) ? Math.floor(inscribedAt / 1000) : 0,
    height: typeof r.blockHeight === 'number' ? r.blockHeight : 0,
    location: outputRaw,
  };
}

/**
 * Full wallet NFT bag from doggy.market (`/wallet/:addr/nfts`, paginated).
 * Prefer this fill while MyDoge lists empty and Spooky is down.
 */
export async function fetchDoggyWalletInscriptions(
  address: string,
  signal?: AbortSignal,
): Promise<DoggyListedInscription[]> {
  const addr = address.trim();
  if (!addr) return [];
  const out: DoggyListedInscription[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < DOGGY_WALLET_MAX && offset < total) {
    const page = await getWalletNftsPage(addr, offset, DOGGY_WALLET_PAGE, signal);
    if (!page) break;
    total = page.total > 0 ? page.total : page.rows.length;
    if (!page.rows.length) break;
    for (const row of page.rows) {
      const mapped = mapListedRow(addr, row);
      if (!mapped) continue;
      const k = mapped.inscriptionId.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(mapped);
    }
    if (page.rows.length < DOGGY_WALLET_PAGE) break;
    offset += page.rows.length;
  }
  return out;
}
