/**
 * Lightweight reachability checks for each broadcast relay (Wallet → Network settings).
 * Does not submit a real transaction — only pings health/version endpoints or RPC metadata.
 */

import { getCommandDogApiBaseUrl } from '../../utils/api';
import { browserRpcProxyAbsoluteUrl, fetchRpcDetailedHealth } from '../rpc-proxy-client';

export type BroadcastRelayHealthProvider = 'rpc' | 'commanddog' | 'tatum' | 'blockcypher' | 'blockchair';

export interface BroadcastRelayHealthResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export interface BroadcastRelayHealthConfig {
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
  tatumApiKey: string;
}

const FETCH_MS = 18_000;

function withTimeout(signalMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(signalMs);
  }
  const ac = new AbortController();
  setTimeout(() => ac.abort(), signalMs);
  return ac.signal;
}

/**
 * Single-relay probe using current Wallet Settings fields (URL / keys) where applicable.
 */
export async function testBroadcastRelayHealth(
  provider: BroadcastRelayHealthProvider,
  cfg: BroadcastRelayHealthConfig,
): Promise<BroadcastRelayHealthResult> {
  const t0 =
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const done = (ok: boolean, message: string): BroadcastRelayHealthResult => ({
    ok,
    latencyMs: Math.round(
      (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0,
    ),
    message,
  });

  try {
    switch (provider) {
      case 'rpc': {
        if (typeof window === 'undefined') {
          return done(false, 'Not available in this environment');
        }
        if (!browserRpcProxyAbsoluteUrl()) {
          return done(
            false,
            'No same-origin RPC proxy — enable dev middleware (/api/rpc-proxy) or deploy with proxy',
          );
        }
        const url = cfg.rpcUrl?.trim();
        const user = cfg.rpcUser?.trim();
        const pass = cfg.rpcPass;
        if (!url || !user || pass === undefined || pass === '') {
          return done(false, 'Enter RPC URL, username, and password');
        }
        const res = await fetchRpcDetailedHealth({ rpcUrl: url, rpcUser: user, rpcPass: pass });
        if (res.ok) {
          const b = res.blocks != null ? ` · block ${res.blocks.toLocaleString()}` : '';
          const ibd = res.initialBlockDownload ? ' (syncing)' : '';
          return done(true, `Core reachable${b}${ibd}`);
        }
        return done(false, res.error);
      }
      case 'commanddog': {
        const base = getCommandDogApiBaseUrl().replace(/\/$/, '');
        const res = await fetch(`${base}/health`, { method: 'GET', signal: withTimeout(FETCH_MS) });
        if (!res.ok) {
          return done(false, `HTTP ${res.status} — check VITE_COMMAND_DOG_API_URL / tunnel`);
        }
        const j = (await res.json().catch(() => null)) as { status?: string; service?: string } | null;
        const st = j?.status === 'ok' ? 'ok' : res.status;
        const svc = j?.service ? ` (${j.service})` : '';
        return done(true, `GET /health → ${st}${svc}`);
      }
      case 'tatum': {
        const key = cfg.tatumApiKey?.trim();
        if (!key) {
          return done(false, 'Add a Tatum API key to test');
        }
        const res = await fetch('https://api.tatum.io/v3/tatum/version', {
          method: 'GET',
          headers: { 'x-api-key': key },
          signal: withTimeout(FETCH_MS),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return done(
            false,
            `HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ''}`,
          );
        }
        const text = (await res.text()).trim();
        return done(true, text ? text.slice(0, 100) : 'API key accepted');
      }
      case 'blockcypher': {
        const res = await fetch('https://api.blockcypher.com/v1/doge/main', {
          method: 'GET',
          signal: withTimeout(FETCH_MS),
        });
        if (!res.ok) {
          return done(false, `HTTP ${res.status}`);
        }
        return done(true, 'Mainnet metadata reachable');
      }
      case 'blockchair': {
        const res = await fetch('https://api.blockchair.com/dogecoin/stats', {
          method: 'GET',
          signal: withTimeout(FETCH_MS),
        });
        if (!res.ok) {
          return done(false, `HTTP ${res.status}`);
        }
        return done(true, 'Stats endpoint reachable');
      }
      default:
        return done(false, 'Unknown provider');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'The user aborted a request.' || msg.includes('aborted')) {
      return done(false, `Timeout after ${FETCH_MS / 1000}s`);
    }
    return done(false, msg);
  }
}

export const ALL_BROADCAST_RELAY_HEALTH_PROVIDERS: BroadcastRelayHealthProvider[] = [
  'rpc',
  'commanddog',
  'tatum',
  'blockcypher',
  'blockchair',
];

export async function testAllBroadcastRelayHealths(
  cfg: BroadcastRelayHealthConfig,
): Promise<Record<BroadcastRelayHealthProvider, BroadcastRelayHealthResult>> {
  const entries = await Promise.all(
    ALL_BROADCAST_RELAY_HEALTH_PROVIDERS.map(
      async (p) => [p, await testBroadcastRelayHealth(p, cfg)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<BroadcastRelayHealthProvider, BroadcastRelayHealthResult>;
}
