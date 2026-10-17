/**
 * Incoming DOGE alerts — detect new received txs.
 * ÐNS offers are OP_RETURN pings. A name mint is the inscription body on the
 * 0.001 Ð carrier (plain `label.namespace`, or JSON `{p:"dns",name}`).
 */

export const INCOMING_TX_ALERTS_PREF_KEY = 'dojakweb_incoming_tx_alerts';

export function incomingTxAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(INCOMING_TX_ALERTS_PREF_KEY);
    if (v == null) return true;
    return v !== '0' && v !== 'false' && v !== 'off';
  } catch {
    return true;
  }
}

export function setIncomingTxAlertsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INCOMING_TX_ALERTS_PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function seenKey(address: string): string {
  return `dojakweb:seen-incoming:${address.trim().toLowerCase()}`;
}

export function loadSeenIncomingTxids(address: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(seenKey(address));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string' && /^[0-9a-f]{64}$/i.test(x)));
  } catch {
    return new Set();
  }
}

export function saveSeenIncomingTxids(address: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const list = Array.from(ids).slice(0, 400);
    window.sessionStorage.setItem(seenKey(address), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Pull UTF-8 OP_RETURN payloads from raw tx hex (best-effort scan). */
export function extractOpReturnTexts(txHex: string): string[] {
  const hex = txHex.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]+$/.test(hex) || hex.length < 8) return [];
  const out: string[] = [];
  let i = 0;
  while (i + 4 <= hex.length) {
    if (hex.slice(i, i + 2) !== '6a') {
      i += 2;
      continue;
    }
    i += 2;
    if (i + 2 > hex.length) break;
    const op = Number.parseInt(hex.slice(i, i + 2), 16);
    i += 2;
    let len = 0;
    if (op >= 1 && op <= 75) {
      len = op;
    } else if (op === 0x4c) {
      if (i + 2 > hex.length) break;
      len = Number.parseInt(hex.slice(i, i + 2), 16);
      i += 2;
    } else if (op === 0x4d) {
      if (i + 4 > hex.length) break;
      len = Number.parseInt(hex.slice(i, i + 2), 16) + Number.parseInt(hex.slice(i + 2, i + 4), 16) * 256;
      i += 4;
    } else {
      continue;
    }
    if (len <= 0 || len > 80 || i + len * 2 > hex.length) continue;
    const dataHex = hex.slice(i, i + len * 2);
    i += len * 2;
    try {
      const bytes = new Uint8Array(len);
      for (let b = 0; b < len; b++) {
        bytes[b] = Number.parseInt(dataHex.slice(b * 2, b * 2 + 2), 16);
      }
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, '').trim();
      if (text && /[\x20-\x7e]/.test(text)) out.push(text);
    } catch {
      /* skip */
    }
  }
  return out;
}

export type DnsOfferMemo = {
  name: string;
  amountDoge: number;
  note?: string;
  raw: string;
};

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const n = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(n)) return null;
    out[i] = n;
  }
  return out;
}

function utf8Push(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, '').trim();
}

/** Pushes from `start`, stopping at the first non-push opcode (CHECKSIG and friends). */
function pushesFrom(script: Uint8Array, start: number, maxPushes: number): Uint8Array[] {
  const pushes: Uint8Array[] = [];
  let i = start;
  while (i < script.length && pushes.length < maxPushes) {
    const op = script[i++];
    if (op === 0x00) {
      pushes.push(new Uint8Array(0));
      continue;
    }
    if (op >= 0x01 && op <= 0x4b) {
      if (i + op > script.length) break;
      pushes.push(script.subarray(i, i + op));
      i += op;
      continue;
    }
    if (op === 0x4c) {
      if (i >= script.length) break;
      const n = script[i++]!;
      if (i + n > script.length) break;
      pushes.push(script.subarray(i, i + n));
      i += n;
      continue;
    }
    if (op >= 0x51 && op <= 0x60) {
      pushes.push(new Uint8Array([op - 0x50]));
      continue;
    }
    break;
  }
  return pushes;
}

export type InscriptionText = { contentType?: string; text: string };

function looksLikeDerSig(push: Uint8Array): boolean {
  return push.length >= 68 && push.length <= 74 && push[0] === 0x30;
}

function looksLikeP2shRedeem(push: Uint8Array): boolean {
  if (push.length < 34 || push.length > 520) return false;
  for (let i = 0; i < push.length; i++) {
    const b = push[i];
    if (b === 0xac || b === 0xad) return true;
  }
  return false;
}

function looksLikeCompressedPubkey(push: Uint8Array): boolean {
  return push.length === 33 && (push[0] === 0x02 || push[0] === 0x03);
}

/**
 * Bulk DNS reveals are P2SH: inscription pushes, then a DER sig, then the
 * redeem script (`<pubkey> CHECKSIGVERIFY DROP×n OP_1`). Leaving those on the
 * push list glues binary onto `joshwise.doge` and the name no longer classifies.
 */
function stripTrailingAuth(pushes: Uint8Array[]): Uint8Array[] {
  if (pushes.length >= 2) {
    const sig = pushes[pushes.length - 2]!;
    const tail = pushes[pushes.length - 1]!;
    if (looksLikeDerSig(sig) && (looksLikeP2shRedeem(tail) || looksLikeCompressedPubkey(tail))) {
      return pushes.slice(0, -2);
    }
  }
  if (pushes.length >= 1 && looksLikeDerSig(pushes[pushes.length - 1]!)) {
    return pushes.slice(0, -1);
  }
  return pushes;
}

/**
 * Short text bodies from era-1 `ord` envelopes in a raw tx.
 * Single mints and bulk-cart reveals share one chunk layout:
 * ord, part count, MIME, countdown, body — then the P2SH signature.
 */
export function extractInscriptionTexts(txHex: string): InscriptionText[] {
  const hex = txHex.trim().toLowerCase().replace(/^0x/, '');
  const bytes = hexToBytes(hex);
  if (!bytes) return [];
  const out: InscriptionText[] = [];
  for (let i = 0; i + 4 < bytes.length; i++) {
    if (bytes[i] !== 0x03 || bytes[i + 1] !== 0x6f || bytes[i + 2] !== 0x72 || bytes[i + 3] !== 0x64) {
      continue;
    }
    const pushes = pushesFrom(bytes, i, 16);
    if (utf8Push(pushes[0] ?? new Uint8Array()) !== 'ord') continue;
    let contentType: string | undefined;
    const chunks: Uint8Array[] = [];
    for (const p of stripTrailingAuth(pushes.slice(1))) {
      if (looksLikeDerSig(p) || looksLikeCompressedPubkey(p) || looksLikeP2shRedeem(p)) break;
      if (p.length === 0 || (p.length === 1 && p[0]! <= 16)) continue;
      const u = utf8Push(p);
      if (!contentType && /^[\w.+-]+\/[\w.+-]+/.test(u) && u.length < 80) {
        contentType = u.split(';')[0]?.trim();
        continue;
      }
      if (p.length <= 800) chunks.push(p);
    }
    const text = chunks.map(utf8Push).join('').trim();
    if (!text || text.length > 800) continue;
    out.push({ contentType, text });
    i += 3;
  }
  return out;
}

export type RevealHistoryLabel = {
  protocol: 'dns' | 'doginals';
  action: string;
  actionLabel: string;
  title: string;
  summary: string;
  name?: string;
  contentType?: string;
  contentPreview: string;
};

/** Wallet history label for a Doginals reveal. Plain `label.namespace` is a DNS register. */
export function revealHistoryFromHex(txHex: string): RevealHistoryLabel | null {
  const bodies = extractInscriptionTexts(txHex);
  for (const body of bodies) {
    const dns = classifyDnsInscription(body.text, body.contentType);
    if (!dns) continue;
    const action = dns.kind === 'config' || dns.kind === 'primary' ? dns.kind : 'register';
    const actionLabel = action === 'config' ? 'Config' : action === 'primary' ? 'Primary' : 'Register';
    return {
      protocol: 'dns',
      action,
      actionLabel,
      title: dns.name,
      summary: 'Received doginal',
      name: dns.name,
      contentType: body.contentType || 'text/plain',
      contentPreview: dns.name,
    };
  }
  const hit = bodies.find((body) => body.text.trim());
  if (!hit) return null;
  const preview = hit.text.trim().slice(0, 80);
  return {
    protocol: 'doginals',
    action: 'receive',
    actionLabel: 'Receive',
    title: 'Received doginal',
    summary: preview,
    contentType: hit.contentType,
    contentPreview: preview,
  };
}

/** One dot, two sides, not a bitmap/dogemap carve-out. Emoji labels stay. */
export function plainDnsName(text: string): string | null {
  const t = text.trim();
  if (!t || t.length > 140 || /[\s\u0000-\u001f]/.test(t)) return null;
  const dot = t.indexOf('.');
  if (dot <= 0 || t.indexOf('.', dot + 1) !== -1) return null;
  const label = t.slice(0, dot);
  const ns = t.slice(dot + 1);
  if (!label || !ns || [...label].length > 63 || [...ns].length > 63) return null;
  const nsKey = ns.toLowerCase();
  if (nsKey === 'bitmap' || nsKey === 'dogemap' || nsKey.startsWith('dogemap')) return null;
  if (/[/:\\"']/.test(t)) return null;
  return t;
}

export type DnsInscriptionHit = {
  name: string;
  kind: 'name' | 'register' | 'config' | 'primary';
};

/** Plain-text name body, or JSON `{p:"dns",op,name}`. */
export function classifyDnsInscription(text: string, contentType?: string): DnsInscriptionHit | null {
  const mime = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  if (mime && mime !== 'text/plain' && mime !== 'application/json' && mime !== 'text/json') return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { p?: unknown; op?: unknown; name?: unknown };
      if (!parsed || parsed.p !== 'dns' || typeof parsed.name !== 'string') return null;
      const name = plainDnsName(parsed.name) ?? parsed.name.trim().slice(0, 80);
      if (!name) return null;
      const kind =
        parsed.op === 'config' || parsed.op === 'primary' || parsed.op === 'register'
          ? parsed.op
          : 'register';
      return { name, kind };
    } catch {
      return null;
    }
  }
  const name = plainDnsName(trimmed);
  return name ? { name, kind: 'name' } : null;
}

/** `dns offer {name} {amt} [note…]`. A leading https URL in the tail is a legacy link and is ignored. */
export function parseDnsOfferMemo(text: string): DnsOfferMemo | null {
  const t = text.trim();
  const m = t.match(/^dns\s+offer\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)\b(.*)$/i);
  if (!m) return null;
  const name = m[1]!;
  const amountDoge = Number(m[2]);
  if (!Number.isFinite(amountDoge)) return null;
  const rest = (m[3] || '').trim();
  // Drop leading URL if present; leftover is optional note.
  const withoutUrl = rest.replace(/^https?:\/\/\S+\s*/i, '').trim();
  return {
    name,
    amountDoge,
    note: withoutUrl || undefined,
    raw: t,
  };
}
