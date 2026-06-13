import { getIndexerApiBase } from '../../utils/api';

export type TreatsTokenRow = {
  ticker: string;
  ticker_lower: string;
  max: string;
  limit: string | null;
  minted: string;
  burned: string;
  circulating: string;
  remaining: string;
  deploy_height: number;
  deploy_txid: string;
};

export type TreatsBalanceRow = {
  tick: string;
  balance: string;
};

export async function fetchTreatsTokens(offset = 0, pageSize = 100): Promise<{
  tokens: TreatsTokenRow[];
  total: number;
}> {
  const base = getIndexerApiBase();
  const url = new URL('api/doginals/treats/tokens', `${base.replace(/\/+$/, '')}/`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('page_size', String(pageSize));
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) return { tokens: [], total: 0 };
    const data = (await res.json()) as { tokens?: TreatsTokenRow[]; total?: number };
    return {
      tokens: Array.isArray(data.tokens) ? data.tokens : [],
      total: typeof data.total === 'number' ? data.total : 0,
    };
  } catch {
    return { tokens: [], total: 0 };
  }
}

export async function fetchTreatsBalances(address: string): Promise<TreatsBalanceRow[]> {
  const base = getIndexerApiBase();
  const url = `${base.replace(/\/+$/, '')}/api/doginals/treats/balance/${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { balances?: TreatsBalanceRow[] };
    return Array.isArray(data.balances) ? data.balances : [];
  } catch {
    return [];
  }
}

export type TreatsHolderRow = {
  address: string;
  balance: string;
};

export async function fetchTreatsHolders(
  tick: string,
  offset = 0,
  pageSize = 50,
): Promise<{ holders: TreatsHolderRow[]; total: number }> {
  const base = getIndexerApiBase();
  const url = new URL(
    `api/doginals/treats/holders/${encodeURIComponent(tick.toLowerCase())}`,
    `${base.replace(/\/+$/, '')}/`,
  );
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('page_size', String(pageSize));
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) return { holders: [], total: 0 };
    const data = (await res.json()) as { holders?: TreatsHolderRow[]; total?: number };
    return {
      holders: Array.isArray(data.holders) ? data.holders : [],
      total: typeof data.total === 'number' ? data.total : 0,
    };
  } catch {
    return { holders: [], total: 0 };
  }
}

export async function fetchTreatsToken(tick: string): Promise<TreatsTokenRow | null> {
  const lower = tick.toLowerCase();
  const { tokens } = await fetchTreatsTokens(0, 500);
  return tokens.find((t) => t.ticker_lower === lower) ?? null;
}
