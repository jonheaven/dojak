/**
 * Minimal Nostr WebSocket client for the wzrd.dog / dojakweb ordinal order book.
 *
 * Implements just enough of NIP-01 to:
 *  - Subscribe to kind-802 order events
 *  - Publish signed kind-802 listing events (ephemeral keys per listing)
 *
 * No external nostr-tools dependency — uses @noble/secp256k1 for schnorr signing
 * and the browser's SubtleCrypto for SHA-256.
 */

import * as secp from '@noble/secp256k1';
import {
  NOSTR_RELAY_URL,
  NOSTR_BACKUP_RELAYS,
  NOSTR_ALL_RELAYS,
  NOSTR_ORDER_KIND,
  NOSTR_CANCEL_KIND,
  DOGE_NETWORK_NAME,
  EXCHANGE_NAME,
} from './nostr-constants';
import { normalizeDoginalInscriptionId } from '../utils/api';

// Re-export so callers only need this module
export { NOSTR_RELAY_URL, NOSTR_BACKUP_RELAYS, NOSTR_ALL_RELAYS, NOSTR_ORDER_KIND };

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '');
  if (clean.length % 2 !== 0) throw new Error('Invalid hex string length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrOrderInfo {
  inscriptionId: string;
  inscriptionNumber: string;
  inscriptionUtxo: string;
  priceKoinu: number;
  psbtBase64: string;
  network: string;
  exchange: string;
  eventId: string;
  publishedAt: number;
  /** Which relay this event was first received from */
  sourceRelay: string;
}

export type RelayStatus = 'connecting' | 'ok' | 'failed';

export interface RelayInfo {
  url: string;
  status: RelayStatus;
}

export interface NostrPublishRelayResult {
  url: string;
  ok: boolean;
  error?: string;
}

export interface NostrPublishDiagnostics {
  eventId: string;
  relayResults: NostrPublishRelayResult[];
}

/** One visible row per inscription: keep newest `publishedAt`; tie-break on `eventId`. */
function shouldReplaceNostrOrder(incoming: NostrOrderInfo, existing: NostrOrderInfo | undefined): boolean {
  if (!existing) return true;
  if (incoming.publishedAt !== existing.publishedAt) return incoming.publishedAt > existing.publishedAt;
  return incoming.eventId > existing.eventId;
}

// ── SHA-256 (browser SubtleCrypto) ────────────────────────────────────────────

async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buf     = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Bytes(data: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(data);
  const buf     = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(buf);
}

// ── Event building & signing ──────────────────────────────────────────────────

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function generateSecretKey(): Uint8Array {
  const u = (secp as any).utils ?? {};
  if (typeof u.randomPrivateKey === 'function') return u.randomPrivateKey();
  if (typeof u.randomSecretKey === 'function') return u.randomSecretKey();
  throw new Error('Unable to generate secp256k1 key: noble utils missing random key function');
}

async function buildAndSignEvent(
  kind: number,
  tags: string[][],
  content: string,
  secretKey: Uint8Array,
): Promise<NostrEvent> {
  const pubkey     = bytesToHex(secp.schnorr.getPublicKey(secretKey));
  const created_at = Math.floor(Date.now() / 1000);

  const serialised = JSON.stringify([0, pubkey, created_at, kind, tags, content]);
  const id         = await sha256Hex(serialised);

  const msgBytes   = await sha256Bytes(serialised);
  const sigBytes   = await secp.schnorr.signAsync(msgBytes, secretKey);

  return { id, pubkey, created_at, kind, tags, content, sig: bytesToHex(sigBytes) };
}

// ── Single-relay helper ───────────────────────────────────────────────────────

function connectAndSend(url: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(url);
      ws.onopen  = () => { ws.send(message); ws.close(); resolve(); };
      ws.onerror = (e) => reject(new Error(`WebSocket error on ${url}`));
      setTimeout(() => { ws.close(); reject(new Error(`Timeout connecting to ${url}`)); }, 8000);
    } catch (e) {
      reject(e);
    }
  });
}

function subscribeRelay(
  url: string,
  filter: Record<string, unknown>,
  onEvent: (e: NostrEvent) => void,
  onEose?: () => void,
  timeoutMs = 10_000,
  onStatus?: (s: RelayStatus) => void,
): () => void {
  const subId = Math.random().toString(36).slice(2);
  let ws: WebSocket | null = null;

  try {
    ws = new WebSocket(url);
    const reqMsg = JSON.stringify(['REQ', subId, filter]);

    ws.onopen = () => {
      onStatus?.('ok');
      ws!.send(reqMsg);
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        if (!Array.isArray(data)) return;
        if (data[0] === 'EVENT' && data[1] === subId) onEvent(data[2] as NostrEvent);
        if (data[0] === 'EOSE' && data[1] === subId)  onEose?.();
      } catch { /* ignore malformed */ }
    };
    ws.onerror = () => { onStatus?.('failed'); };
    ws.onclose = (e) => { if (e.code !== 1000) onStatus?.('failed'); };
  } catch {
    onStatus?.('failed');
  }

  const timer = setTimeout(() => ws?.close(), timeoutMs);

  return () => { clearTimeout(timer); ws?.close(); };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Publish a seller's signed PSBT to the nostr order book (kind 802).
 * Uses a fresh ephemeral key for each listing (OpenOrdex-style).
 */
export async function publishListingToNostr(
  signedPsbtBase64: string,
  inscriptionId: string,
  inscriptionNumber: string | number,
  inscriptionUtxo: string,
  priceKoinu: number,
): Promise<{ eventId: string; privateKey: string }> {
  const result = await publishListingToNostrWithDiagnostics(
    signedPsbtBase64,
    inscriptionId,
    inscriptionNumber,
    inscriptionUtxo,
    priceKoinu,
  );
  return { eventId: result.eventId, privateKey: result.privateKey };
}

export async function publishListingToNostrWithDiagnostics(
  signedPsbtBase64: string,
  inscriptionId: string,
  inscriptionNumber: string | number,
  inscriptionUtxo: string,
  priceKoinu: number,
): Promise<NostrPublishDiagnostics & { privateKey: string }> {
  const secretKey = generateSecretKey();
  const privateKeyHex = bytesToHex(secretKey);
  const insId = normalizeDoginalInscriptionId(inscriptionId);

  const tags: string[][] = [
    ['n', DOGE_NETWORK_NAME],
    ['t', 'sell'],
    ['i', insId],
    ['m', String(inscriptionNumber)],
    ['u', inscriptionUtxo],
    ['s', String(priceKoinu)],
    ['x', EXCHANGE_NAME],
  ];

  const event = await buildAndSignEvent(NOSTR_ORDER_KIND, tags, signedPsbtBase64, secretKey);
  const msg   = JSON.stringify(['EVENT', event]);
  const relays = [NOSTR_RELAY_URL, ...NOSTR_BACKUP_RELAYS];

  const relayResults = await Promise.all(
    relays.map(async (url): Promise<NostrPublishRelayResult> => {
      try {
        await connectAndSend(url, msg);
        return { url, ok: true };
      } catch (e: any) {
        return { url, ok: false, error: e?.message ?? String(e) };
      }
    }),
  );

  const okCount = relayResults.filter((r) => r.ok).length;
  if (okCount === 0) {
    const firstErr = relayResults.find((r) => !r.ok)?.error ?? 'No relay accepted the event';
    throw new Error(`Failed to publish to Nostr relays. ${firstErr}`);
  }

  return { eventId: event.id, relayResults, privateKey: privateKeyHex };
}

/**
 * Publish a cancel event for a listing (kind 803).
 * References the original listing event ID.
 * Uses the same ephemeral key as the original listing.
 */
export async function publishListingCancelToNostr(
  originalEventId: string,
  inscriptionId: string,
  inscriptionNumber: string | number,
  inscriptionUtxo: string,
  ephemeralPrivateKeyHex: string,
): Promise<string> {
  const result = await publishListingCancelToNostrWithDiagnostics(
    originalEventId,
    inscriptionId,
    inscriptionNumber,
    inscriptionUtxo,
    ephemeralPrivateKeyHex,
  );
  return result.eventId;
}

export async function publishListingCancelToNostrWithDiagnostics(
  originalEventId: string,
  inscriptionId: string,
  inscriptionNumber: string | number,
  inscriptionUtxo: string,
  ephemeralPrivateKeyHex: string,
): Promise<NostrPublishDiagnostics> {
  const insId = normalizeDoginalInscriptionId(inscriptionId);
  const secretKeyBytes = hexToBytes(ephemeralPrivateKeyHex);

  const tags: string[][] = [
    ['n', DOGE_NETWORK_NAME],
    ['t', 'cancel'],
    ['i', insId],
    ['m', String(inscriptionNumber)],
    ['u', inscriptionUtxo],
    ['e', originalEventId], // Reference to original listing event
    ['x', EXCHANGE_NAME],
  ];

  const event = await buildAndSignEvent(NOSTR_CANCEL_KIND, tags, '', secretKeyBytes);
  const msg   = JSON.stringify(['EVENT', event]);
  const relays = [NOSTR_RELAY_URL, ...NOSTR_BACKUP_RELAYS];

  const relayResults = await Promise.all(
    relays.map(async (url): Promise<NostrPublishRelayResult> => {
      try {
        await connectAndSend(url, msg);
        return { url, ok: true };
      } catch (e: any) {
        return { url, ok: false, error: e?.message ?? String(e) };
      }
    }),
  );

  const okCount = relayResults.filter((r) => r.ok).length;
  if (okCount === 0) {
    const firstErr = relayResults.find((r) => !r.ok)?.error ?? 'No relay accepted the event';
    throw new Error(`Failed to publish cancel to Nostr relays. ${firstErr}`);
  }

  return { eventId: event.id, relayResults };
}

/**
 * Fetch recent cancel events from the nostr order book.
 */
export function fetchNostrCancels(
  onCancel: (cancel: NostrCancelInfo) => void,
  limit = 20,
  filterUtxo?: string,
  onRelayStatus?: (info: RelayInfo) => void,
): () => void {
  const filter: Record<string, unknown> = {
    kinds: [NOSTR_CANCEL_KIND],
    limit,
    ...(filterUtxo ? { '#u': [filterUtxo] } : {}),
  };

  function handleEvent(event: NostrEvent, sourceRelay: string) {
    try {
      const inscriptionId = event.tags.find(t => t[0] === 'i')?.[1] ?? '';
      const inscriptionNum = event.tags.find(t => t[0] === 'm')?.[1] ?? '';
      const utxo = event.tags.find(t => t[0] === 'u')?.[1] ?? '';
      const originalEventId = event.tags.find(t => t[0] === 'e')?.[1] ?? '';
      const network = event.tags.find(t => t[0] === 'n')?.[1] ?? '';
      const exchange = event.tags.find(t => t[0] === 'x')?.[1] ?? '';

      if (!inscriptionId || !utxo || !originalEventId) return;

      const cancel: NostrCancelInfo = {
        inscriptionId: normalizeDoginalInscriptionId(inscriptionId),
        inscriptionNumber: inscriptionNum,
        inscriptionUtxo: utxo,
        originalEventId,
        cancelledAt: event.created_at,
        sourceRelay,
        network,
        exchange,
        eventId: event.id,
      };

      onCancel(cancel);
    } catch { /* ignore malformed */ }
  }

  const closers = NOSTR_ALL_RELAYS.map((url) =>
    subscribeRelay(
      url,
      filter,
      (event) => handleEvent(event, url),
      undefined,
      10_000,
      onRelayStatus ? (s) => onRelayStatus({ url, status: s }) : undefined,
    ),
  );

  return () => closers.forEach(c => c());
}

export interface NostrCancelInfo {
  inscriptionId: string;
  inscriptionNumber: string;
  inscriptionUtxo: string;
  originalEventId: string;
  cancelledAt: number;
  sourceRelay: string;
  network: string;
  exchange: string;
  eventId: string;
}

/**
 * Fans out to ALL known relays simultaneously; deduplicates by inscription ID.
 *
 * @param onListing     Called for each unique listing found
 * @param limit         How many events to request per relay (default 20)
 * @param filterUtxo    If set, only return listings for this inscription UTXO
 * @param onRelayStatus Called whenever a relay status changes
 */
export function fetchNostrListings(
  onListing: (order: NostrOrderInfo) => void,
  limit = 20,
  filterUtxo?: string,
  onRelayStatus?: (info: RelayInfo) => void,
): () => void {
  const filter: Record<string, unknown> = {
    kinds: [NOSTR_ORDER_KIND],
    limit,
    ...(filterUtxo ? { '#u': [filterUtxo] } : {}),
  };

  const bestByInscription = new Map<string, NostrOrderInfo>();

  function handleEvent(event: NostrEvent, sourceRelay: string) {
    try {
      const rawInscriptionId = event.tags.find(t => t[0] === 'i')?.[1] ?? '';
      const inscriptionId    = normalizeDoginalInscriptionId(rawInscriptionId);
      const inscriptionNum = event.tags.find(t => t[0] === 'm')?.[1] ?? '';
      const utxo           = event.tags.find(t => t[0] === 'u')?.[1] ?? '';
      const priceStr       = event.tags.find(t => t[0] === 's')?.[1];
      const network        = event.tags.find(t => t[0] === 'n')?.[1] ?? '';
      const exchange       = event.tags.find(t => t[0] === 'x')?.[1] ?? '';

      if (!inscriptionId || !utxo || !priceStr || !event.content) return;

      const order: NostrOrderInfo = {
        inscriptionId,
        inscriptionNumber: inscriptionNum,
        inscriptionUtxo:   utxo,
        priceKoinu:        Number(priceStr),
        psbtBase64:        event.content,
        network,
        exchange,
        eventId:           event.id,
        publishedAt:       event.created_at,
        sourceRelay,
      };

      const existing = bestByInscription.get(inscriptionId);
      if (!shouldReplaceNostrOrder(order, existing)) return;
      bestByInscription.set(inscriptionId, order);
      onListing(order);
    } catch { /* ignore bad events */ }
  }

  // Fan out to all relays simultaneously
  const closers = NOSTR_ALL_RELAYS.map((url) =>
    subscribeRelay(
      url,
      filter,
      (event) => handleEvent(event, url),
      undefined,
      10_000,
      onRelayStatus ? (s) => onRelayStatus({ url, status: s }) : undefined,
    ),
  );

  return () => closers.forEach(c => c());
}

/**
 * Get the lowest‑priced valid listing for a specific inscription UTXO.
 * Resolves with the PSBT base64 string, or null if none found.
 */
export function fetchBestListingForUtxo(utxo: string): Promise<string | null> {
  return new Promise((resolve) => {
    let best: { price: number; psbt: string } | null = null;
    let closed = false;

    const cleanup = subscribeRelay(
      NOSTR_RELAY_URL,
      { kinds: [NOSTR_ORDER_KIND], '#u': [utxo], limit: 20 },
      (event) => {
        if (closed) return;
        const priceStr = event.tags.find(t => t[0] === 's')?.[1];
        if (!priceStr || !event.content) return;
        const price = Number(priceStr);
        if (!best || price < best.price) best = { price, psbt: event.content };
      },
      () => {
        // EOSE — we have everything
        closed = true;
        cleanup();
        resolve(best?.psbt ?? null);
      },
      8000,
    );

    // Safety timeout
    setTimeout(() => {
      if (!closed) {
        closed = true;
        cleanup();
        resolve(best?.psbt ?? null);
      }
    }, 9000);
  });
}

/**
 * Subscribe to live order-book updates (real-time) across all known relays.
 * Returns an unsubscribe function.
 */
export function subscribeNostrOrderBook(
  onListing: (order: NostrOrderInfo) => void,
  onRelayStatus?: (info: RelayInfo) => void,
): () => void {
  const filter = { kinds: [NOSTR_ORDER_KIND], since: Math.floor(Date.now() / 1000) - 86400 };
  /** Same listing mirrored on many relays / republished → multiple event ids; collapse to one row per inscription. */
  const bestByInscription = new Map<string, NostrOrderInfo>();

  function handleEvent(event: NostrEvent, sourceRelay: string) {
    try {
      const rawInscriptionId = event.tags.find(t => t[0] === 'i')?.[1] ?? '';
      const inscriptionId    = normalizeDoginalInscriptionId(rawInscriptionId);
      const inscriptionNum = event.tags.find(t => t[0] === 'm')?.[1] ?? '';
      const utxo           = event.tags.find(t => t[0] === 'u')?.[1] ?? '';
      const priceStr       = event.tags.find(t => t[0] === 's')?.[1];
      const network        = event.tags.find(t => t[0] === 'n')?.[1] ?? '';
      const exchange       = event.tags.find(t => t[0] === 'x')?.[1] ?? '';

      if (!inscriptionId || !utxo || !priceStr || !event.content) return;

      const order: NostrOrderInfo = {
        inscriptionId,
        inscriptionNumber: inscriptionNum,
        inscriptionUtxo:   utxo,
        priceKoinu:        Number(priceStr),
        psbtBase64:        event.content,
        network,
        exchange,
        eventId:           event.id,
        publishedAt:       event.created_at,
        sourceRelay,
      };

      const existing = bestByInscription.get(inscriptionId);
      if (!shouldReplaceNostrOrder(order, existing)) return;
      bestByInscription.set(inscriptionId, order);
      onListing(order);
    } catch { /* ignore */ }
  }

  const closers = NOSTR_ALL_RELAYS.map((url) =>
    subscribeRelay(
      url,
      filter,
      (event) => handleEvent(event, url),
      undefined,
      60_000 * 60, // keep alive 1 hour
      onRelayStatus ? (s) => onRelayStatus({ url, status: s }) : undefined,
    ),
  );

  return () => closers.forEach(c => c());
}
