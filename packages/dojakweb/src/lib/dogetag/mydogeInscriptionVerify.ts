/**
 * Poll MyDoge inscription API and verify indexed CDN bytes match a local file.
 * API shape matches https://api.mydoge.com/inscription/{inscriptionId}
 */

import { gatedMydogeGetJson, MydogeHttpError } from '../mydoge/httpGate';

const MYDOGE_INSCRIPTION_BASE = 'https://api.mydoge.com/inscription/';

export interface MydogeInscriptionMeta {
  content: string;
  contentBody?: string;
  contentLength?: number;
  contentType?: string;
  genesisTransaction?: string;
  inscriptionId: string;
  inscriptionNumber?: number;
  preview?: string;
  timestamp?: number;
}

export interface InscribeArchiveEntry {
  inscriptionId: string;
  walletAddress: string;
  fileName: string;
  contentType: string;
  sha256Hex: string;
  contentLength: number;
  mydogeApiUrl: string;
  cdnContentUrl: string;
  genesisTransaction?: string;
  verifiedAt: number;
}

const ARCHIVE_KEY_PREFIX = 'dojakweb:inscribe-archive-v1-';

export function mydogeInscriptionApiUrl(inscriptionId: string): string {
  return `${MYDOGE_INSCRIPTION_BASE}${encodeURIComponent(inscriptionId)}`;
}

export async function fetchMydogeInscriptionMeta(
  inscriptionId: string,
  signal?: AbortSignal,
): Promise<MydogeInscriptionMeta | null | 'not_found'> {
  try {
    const j = (await gatedMydogeGetJson(mydogeInscriptionApiUrl(inscriptionId), {
      signal,
    })) as MydogeInscriptionMeta;
    if (!j || typeof j.inscriptionId !== 'string') return null;
    return j;
  } catch (e) {
    if (e instanceof MydogeHttpError && e.status === 404) return 'not_found';
    throw e;
  }
}

export function mydogeMetaHasIndexedContent(meta: MydogeInscriptionMeta): boolean {
  if (typeof meta.contentBody === 'string' && meta.contentBody.length > 0) return true;
  if (typeof meta.content === 'string' && meta.content.length > 0) {
    try {
      const u = new URL(meta.content);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }
  return false;
}

export async function sha256Hex(buf: Buffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', u8 as any);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function bytesFromMeta(meta: MydogeInscriptionMeta, signal?: AbortSignal): Promise<Uint8Array> {
  if (typeof meta.contentBody === 'string' && meta.contentBody.length > 0) {
    return new TextEncoder().encode(meta.contentBody);
  }
  const url = meta.content;
  const r = await fetch(url, { signal, mode: 'cors' });
  if (!r.ok) throw new Error(`Content URL returned HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function bytesEqualRemoteLocal(remote: Uint8Array, local: Buffer): boolean {
  if (remote.length !== local.length) return false;
  for (let i = 0; i < remote.length; i++) {
    if (remote[i] !== local[i]) return false;
  }
  return true;
}

export type VerifyLocalAgainstIndexResult =
  | { ok: true; sha256Hex: string; remoteLength: number }
  | { ok: false; reason: string; remoteLength?: number };

export async function verifyLocalAgainstMydogeIndex(
  local: Buffer,
  meta: MydogeInscriptionMeta,
  signal?: AbortSignal,
): Promise<VerifyLocalAgainstIndexResult> {
  const remote = await bytesFromMeta(meta, signal);
  if (!bytesEqualRemoteLocal(remote, local)) {
    return {
      ok: false,
      reason: `Indexed bytes do not match your file (local ${local.length} B, CDN ${remote.length} B).`,
      remoteLength: remote.length,
    };
  }
  const sha = await sha256Hex(local);
  return { ok: true, sha256Hex: sha, remoteLength: remote.length };
}

export async function pollMydogeUntilIndexed(
  inscriptionId: string,
  opts: {
    signal: AbortSignal;
    intervalMs?: number;
    maxAttempts?: number;
    onAttempt?: (attempt: number, meta: MydogeInscriptionMeta | null, note?: string) => void;
  },
): Promise<MydogeInscriptionMeta> {
  /** Default 30s — indexer lag is minutes; avoid hammering api.mydoge.com. */
  const intervalMs = opts.intervalMs ?? 30_000;
  /** ~45 min max wait at default interval. */
  const maxAttempts = opts.maxAttempts ?? 90;
  let lastMeta: MydogeInscriptionMeta | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetchMydogeInscriptionMeta(inscriptionId, opts.signal);
      if (res && res !== 'not_found') {
        lastMeta = res;
        if (mydogeMetaHasIndexedContent(res)) {
          opts.onAttempt?.(attempt, res);
          return res;
        }
        opts.onAttempt?.(attempt, res, 'waiting for content URL on inscription…');
      } else {
        opts.onAttempt?.(attempt, null, res === 'not_found' ? 'not in index yet (404)' : 'empty response');
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      const msg = e instanceof Error ? e.message : String(e);
      opts.onAttempt?.(attempt, lastMeta, msg);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    'Timed out waiting for MyDoge indexer. The reveal tx is on-chain; indexing can take several minutes. Use “Retry check” or open the API link.',
  );
}

function archiveStorageKey(walletAddress: string): string {
  return `${ARCHIVE_KEY_PREFIX}${walletAddress}`;
}

export function loadInscribeArchive(walletAddress: string): InscribeArchiveEntry[] {
  try {
    const raw = localStorage.getItem(archiveStorageKey(walletAddress));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is InscribeArchiveEntry =>
        x &&
        typeof (x as InscribeArchiveEntry).inscriptionId === 'string' &&
        typeof (x as InscribeArchiveEntry).sha256Hex === 'string',
    );
  } catch {
    return [];
  }
}

export function upsertInscribeArchiveEntry(walletAddress: string, entry: InscribeArchiveEntry): void {
  const list = loadInscribeArchive(walletAddress).filter((e) => e.inscriptionId !== entry.inscriptionId);
  list.unshift(entry);
  const trimmed = list.slice(0, 50);
  localStorage.setItem(archiveStorageKey(walletAddress), JSON.stringify(trimmed));
}
