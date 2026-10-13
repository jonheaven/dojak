/**
 * Incoming DOGE alerts — detect new received txs (incl. ÐNS offer OP_RETURN pings).
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

/** `dns offer {name} {amt} {link} [note…]` */
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
