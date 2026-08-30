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

export async function fetchDxByHandle(handle: string): Promise<DxRegistration | null> {
  const h = handle.trim();
  if (!h) return null;
  try {
    const res = await fetch(`${indexerRoot()}/api/dx/handle/${encodeURIComponent(h)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { linked?: boolean; registration?: DxRegistration | null };
    return j.linked && j.registration ? j.registration : null;
  } catch {
    return null;
  }
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
