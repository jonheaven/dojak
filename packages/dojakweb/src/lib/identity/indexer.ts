/**
 * dogex identity lookups for the in-wallet Ð𝕏 / ÐN05 panel.
 */
import { getIndexerApiBase } from '../../utils/api';

export type DxRegistration = {
  xHandle: string;
  dogeAddress: string;
  txid?: string;
  tweetId?: string | null;
  tweetVerified?: boolean | null;
  height?: number;
  source?: string;
};

export type N05Record = {
  name: string;
  identifier: string;
  address: string;
  pubkey: string;
  txid?: string;
  domain?: string;
};

function indexerRoot(): string {
  return getIndexerApiBase().replace(/\/+$/, '');
}

export async function fetchDxByAddress(address: string): Promise<DxRegistration | null> {
  const a = address.trim();
  if (!a) return null;
  try {
    const res = await fetch(`${indexerRoot()}/api/dx/address/${encodeURIComponent(a)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { linked?: boolean; registration?: DxRegistration | null };
    return j.linked && j.registration ? j.registration : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Ð𝕏 handle. Fail-closed for payments:
 * - throws on network / timeout / non-OK HTTP
 * - returns null only when the indexer explicitly says unlinked / no registration
 */
export async function fetchDxByHandle(handle: string): Promise<DxRegistration | null> {
  const h = handle.trim();
  if (!h) return null;
  const res = await fetch(`${indexerRoot()}/api/dx/handle/${encodeURIComponent(h)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Ð𝕏 lookup failed (HTTP ${res.status}). Try again or paste a Dogecoin address.`);
  }
  const j = (await res.json()) as { linked?: boolean; registration?: DxRegistration | null };
  if (j.linked === true && j.registration?.dogeAddress) return j.registration;
  return null;
}

export type DnsResolveResult =
  | { status: 'registered'; name: string; payAddress: string; owner: string | null }
  | { status: 'available'; name: string };

/**
 * Resolve a Doge Domain (`label.namespace`) to its pay-to address.
 * Fail-closed: throws on transport / non-OK HTTP. `available` when the name is free / not indexed.
 */
export async function fetchDnsResolve(name: string): Promise<DnsResolveResult> {
  const n = name.trim().toLowerCase();
  if (!n) throw new Error('Enter a Doge Domain name.');
  const res = await fetch(`${indexerRoot()}/api/dns/resolve/${encodeURIComponent(n)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Domain lookup failed (HTTP ${res.status}). Try again or paste a Dogecoin address.`);
  }
  const j = (await res.json()) as {
    ok?: boolean;
    available?: boolean;
    record?: {
      name?: string;
      owner?: string | null;
      payAddress?: string | null;
      records?: { address?: string | null };
    } | null;
  };
  const rec = j.record;
  if (j.available === true || !rec) {
    return { status: 'available', name: n };
  }
  const pay =
    (typeof rec.payAddress === 'string' && rec.payAddress.trim()) ||
    (typeof rec.records?.address === 'string' && rec.records.address.trim()) ||
    (typeof rec.owner === 'string' && rec.owner.trim()) ||
    '';
  if (!pay) {
    return { status: 'available', name: typeof rec.name === 'string' ? rec.name : n };
  }
  return {
    status: 'registered',
    name: typeof rec.name === 'string' && rec.name ? rec.name : n,
    payAddress: pay,
    owner: typeof rec.owner === 'string' ? rec.owner : null,
  };
}

export async function fetchN05ByAddress(address: string): Promise<N05Record | null> {
  const a = address.trim();
  if (!a) return null;
  try {
    const res = await fetch(`${indexerRoot()}/api/n05/address/${encodeURIComponent(a)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { linked?: boolean; record?: N05Record | null };
    return j.linked && j.record ? j.record : null;
  } catch {
    return null;
  }
}

export async function fetchN05ByName(name: string): Promise<N05Record | null> {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  try {
    const res = await fetch(`${indexerRoot()}/api/n05/name/${encodeURIComponent(n)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { linked?: boolean; record?: N05Record | null };
    return j.linked && j.record ? j.record : j.record ?? null;
  } catch {
    return null;
  }
}

export type DnsNameRecord = {
  name: string;
  namespace?: string;
  inscriptionId?: string;
  owner?: string | null;
  records?: {
    address?: string | null;
    url?: string | null;
    site?: string | null;
    avatar?: string | null;
    content?: string | null;
  };
};

export async function fetchDnsByAddress(address: string): Promise<DnsNameRecord[]> {
  const a = address.trim();
  if (!a) return [];
  try {
    const res = await fetch(`${indexerRoot()}/api/dns/address/${encodeURIComponent(a)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { names?: DnsNameRecord[] };
    return j.names ?? [];
  } catch {
    return [];
  }
}
