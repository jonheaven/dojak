/**
 * Optional human note on a wallet send.
 *
 * Dogecoin relays one standard OP_RETURN, 80 data bytes, value 0. dogex stores
 * every one of those as a ÐogeTag with the sender address — that is the
 * on-chain “this came from me” line.
 *
 * The note is not a protocol op. Prefixes that dogex (or a cross-chain router)
 * would execute are rejected. Domain gifts use the existing ÐNS memo
 * `dns gift <words>`, which indexers ignore for name ownership.
 */
import { DOGETAG_MESSAGE_MAX_BYTES, estimateOpReturnOutputsTxWeight } from './opReturn';

export const SEND_MEMO_MAX_BYTES = DOGETAG_MESSAGE_MAX_BYTES;

export type CompiledSendMemo =
  | { ok: true; payload: string | null; bytes: number }
  | { ok: false; error: string; bytes: number };

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function normalizeSendMemo(raw: string): string {
  return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function protocolBlock(text: string): string | null {
  if (text.includes('\u0000')) return 'A note cannot contain a null character.';
  if (/[{}]/.test(text)) {
    return 'Curly braces are protocol syntax. Write a plain sentence.';
  }
  if (/^dns\s+offer\b/i.test(text)) {
    return 'That is a ÐNS offer, not a note. Offers are a different action.';
  }
  if (/^dns\s+/i.test(text) && !/^dns\s+gift\b/i.test(text)) {
    return 'Lines that start with “dns” are name commands. Write a plain sentence.';
  }
  if (text.startsWith('Ð:') || /^D:[A-Za-z0-9]/i.test(text)) {
    return 'That prefix is an on-chain protocol, not a note.';
  }
  if (
    /^(?:SWAP:|s:|\+:|ADD:|=:|BOND:|UNBOND:|OUT:|REFUND:|-:|WITHDRAW:|LEAVE:|NOOP\b|DONATE:|RESERVE:|MIGRATE:|RAGNAROK:|TRADE)/i.test(
      text,
    ) ||
    text.toLowerCase().includes(':to:')
  ) {
    return 'That looks like a cross-chain swap memo, not a gift note.';
  }
  return null;
}

/**
 * User words → exact OP_RETURN text.
 * `dnsGift` wraps a domain transfer as `dns gift <words>` (80-byte cap includes the prefix).
 * Blank input is valid and means “no memo output”.
 */
export function compileSendMemo(raw: string, opts?: { dnsGift?: boolean }): CompiledSendMemo {
  const note = normalizeSendMemo(raw);
  if (!note) return { ok: true, payload: null, bytes: 0 };
  const blocked = protocolBlock(note);
  if (blocked) return { ok: false, error: blocked, bytes: utf8Bytes(note) };

  let payload = note;
  if (opts?.dnsGift && !/^dns\s+gift\b/i.test(note)) {
    payload = `dns gift ${note}`;
  }
  const bytes = utf8Bytes(payload);
  if (bytes > SEND_MEMO_MAX_BYTES) {
    const prefix = opts?.dnsGift ? utf8Bytes('dns gift ') : 0;
    const room = Math.max(0, SEND_MEMO_MAX_BYTES - prefix);
    return {
      ok: false,
      error: `Note is ${bytes} bytes. Dogecoin allows ${SEND_MEMO_MAX_BYTES} (about ${room} for your words).`,
      bytes,
    };
  }
  return { ok: true, payload, bytes };
}

/** Tx bytes of one value-0 OP_RETURN carrying `payload` (already compiled). */
export function sendMemoOutputBytes(payload: string): number {
  return estimateOpReturnOutputsTxWeight([Buffer.from(payload, 'utf8')]);
}

/** Receiver-facing sentence. Protocol commands stay out of the gift toast. */
export function displaySendMemo(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/^dns\s+offer\b/i.test(t)) return null;
  const gift = /^dns\s+gift(?:\s+([\s\S]+))?$/i.exec(t);
  if (gift) {
    const note = gift[1]?.trim();
    return note ? note.slice(0, SEND_MEMO_MAX_BYTES) : null;
  }
  if (/^dns\s+/i.test(t)) return null;
  if (t.startsWith('Ð:') || t.startsWith('{')) return null;
  if (/^(?:SWAP:|s:|\+:|ADD:|=:|BOND:|UNBOND:|OUT:|REFUND:|-:|WITHDRAW:|LEAVE:|NOOP\b|DONATE:|RESERVE:|MIGRATE:|RAGNAROK:|TRADE)/i.test(t)) {
    return null;
  }
  return t.slice(0, SEND_MEMO_MAX_BYTES);
}
