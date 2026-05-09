import { getEnv } from './env';

const normalizeBaseUrl = (value?: string | null): string => (value || '').trim().replace(/\/$/, '');

/**
 * Same-origin proxy in Vite dev → local `nostr-rs-relay` (default `127.0.0.1:8090` in vite.config.ts).
 * Set `VITE_COMMAND_DOG_NOSTR_URL` to override (tunnel or public relay).
 */
export const COMMAND_DOG_NOSTR_DEV_PROXY_PATH = '/__nostrrelay';

/** HTTP base for NIP-11 (`GET /` + `Accept: application/nostr+json`). Empty when not configured (production without env). */
export function getCommandDogNostrHttpBaseUrl(): string {
  const fromEnv = normalizeBaseUrl(getEnv('VITE_COMMAND_DOG_NOSTR_URL', ''));
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    return normalizeBaseUrl(new URL(COMMAND_DOG_NOSTR_DEV_PROXY_PATH, window.location.origin).href);
  }
  return '';
}

export function isCommandDogNostrConfigured(): boolean {
  return getCommandDogNostrHttpBaseUrl().length > 0;
}

/** WebSocket URL for Nostr clients (root path `/`). */
export function getCommandDogNostrWsUrl(): string {
  const http = getCommandDogNostrHttpBaseUrl();
  if (!http) return '';
  if (http.startsWith('ws://') || http.startsWith('wss://')) {
    return http.endsWith('/') ? http : `${http}/`;
  }
  const u = new URL(http);
  const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  const path =
    !u.pathname || u.pathname === '/'
      ? '/'
      : u.pathname.endsWith('/')
        ? u.pathname
        : `${u.pathname}/`;
  return `${wsProto}//${u.host}${path}`;
}

export type CommandDogNostrRelayInfo = {
  name?: string;
  description?: string;
  pubkey?: string;
  software?: string;
  version?: string;
  supported_nips?: number[];
  limitation?: string;
};

export async function fetchCommandDogNostrRelayInfo(
  signal?: AbortSignal
): Promise<{ ok: true; info: CommandDogNostrRelayInfo } | { ok: false; error: string }> {
  const base = getCommandDogNostrHttpBaseUrl();
  if (!base) {
    return { ok: false, error: 'not_configured' };
  }
  const url = new URL('/', base).href;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/nostr+json' },
      signal,
    });
    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }
    const info = (await res.json()) as CommandDogNostrRelayInfo;
    return { ok: true, info };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
