/**
 * DNS — Dogecoin Name System (`.doge` names).
 * Spec: dogenals/spec/protocols/dns/spec.md
 *
 * Names are Doginals inscriptions (not OP_RETURN). Sign with signInscriptionTxs.
 * Studio register MAY attach a 1 DOGE product fee — not required for protocol validity.
 */
import { signInscriptionTxs } from './dogetag/inscribe';
import { broadcastSignedTransaction } from './broadcast/dogecoinTxBroadcast';
import { journalDnsTx } from './wallet-tx-journal';

export const DNS_MARKER = 'dns';
export const DNS_HERO_NAMESPACE = 'doge';

/** Studio registrar fee (product only). Games house wallet. */
export const DNS_REGISTRAR_HOUSE = 'D8XknrqM5nNQnjpMLLTHRh5A3tQ4bWGLkB';
export const DNS_REGISTRAR_FEE_KOINU = 100_000_000;
export const DNS_PARK_INSCRIPTION_ID = '';

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED = new Set([
  'www',
  'mail',
  'ftp',
  'localhost',
  'dns',
  'ns',
  'ns1',
  'ns2',
  'admin',
  'root',
  'api',
  'm',
  'smtp',
]);

export type DnsRecords = {
  address?: string;
  url?: string;
  site?: string;
  avatar?: string;
  content?: string;
  cname?: string;
};

export function normalizeDnsName(raw: string, defaultNs = DNS_HERO_NAMESPACE): string | null {
  const t = raw.trim().toLowerCase().replace(/^\.+/, '');
  if (!t) return null;
  const full = t.includes('.') ? t : `${t}.${defaultNs}`;
  const parts = full.split('.');
  if (parts.length !== 2) return null;
  const [label, ns] = parts;
  if (!label || !ns || RESERVED.has(label) || !LABEL_RE.test(label) || !LABEL_RE.test(ns)) {
    return null;
  }
  if (ns === 'bitmap' || ns === 'dogemap' || ns.startsWith('dogemap')) {
    return null;
  }
  return `${label}.${ns}`;
}

export function isDnsName(input: string): boolean {
  return Boolean(normalizeDnsName(input));
}

export function buildDnsInscriptionJson(opts: {
  op: 'register' | 'config';
  name: string;
  records?: DnsRecords;
}): string {
  const name = normalizeDnsName(opts.name);
  if (!name) throw new Error('Invalid DNS name');
  const body: Record<string, string> = {
    p: DNS_MARKER,
    op: opts.op,
    name,
  };
  const r = opts.records || {};
  if (r.address != null) body.address = r.address.trim();
  if (r.url != null) body.url = r.url.trim();
  if (r.site != null) body.site = r.site.trim().toLowerCase();
  if (r.avatar != null) body.avatar = r.avatar.trim();
  if (r.content != null) body.content = r.content.trim().slice(0, 280);
  if (r.cname != null) body.cname = r.cname.trim().toLowerCase();
  return JSON.stringify(body);
}

export function buildDnsOfferOpReturn(opts: {
  name: string;
  amountDoge: number;
  note?: string;
}): string {
  const name = normalizeDnsName(opts.name);
  if (!name) throw new Error('Invalid DNS name');
  const amt = Number.isFinite(opts.amountDoge) ? String(opts.amountDoge) : '0';
  const note = (opts.note || '').replace(/\s+/g, ' ').trim();
  // Link is derived (dogex.dog/dns/{name}). Do not repeat the name in OP_RETURN.
  const head = `dns offer ${name} ${amt}`;
  const max = 80;
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  if (bytes(head) > max) throw new Error('Name is too long to fit in a Dogecoin offer memo');
  if (!note) return head;
  let fitted = '';
  const room = max - bytes(head) - 1;
  for (const ch of note) {
    const next = fitted + ch;
    if (bytes(next) > room) break;
    fitted = next;
  }
  fitted = fitted.replace(/\s+$/u, '');
  return fitted ? `${head} ${fitted}` : head;
}

export type PublishDnsResult = {
  commitTxid: string;
  revealTxid: string;
  inscriptionId: string;
};

export async function publishDnsOnChain(params: {
  fromAddress: string;
  privateKeyWIF: string;
  op: 'register' | 'config';
  name: string;
  records?: DnsRecords;
  feeRate?: number;
  /** Skip studio 1 DOGE registrar fee. */
  skipRegistrarFee?: boolean;
  onStatus?: (msg: string) => void;
}): Promise<PublishDnsResult> {
  const name = normalizeDnsName(params.name);
  if (!name) throw new Error('Invalid DNS name');
  // The name itself stays plain text. Site, bio, and other records are a later config inscription.
  const plain = params.op === 'register';
  const text = plain
    ? name
    : buildDnsInscriptionJson({ op: 'config', name, records: params.records });
  const fee =
    params.op === 'register' && !params.skipRegistrarFee
      ? [{ address: DNS_REGISTRAR_HOUSE, satoshis: DNS_REGISTRAR_FEE_KOINU }]
      : undefined;
  params.onStatus?.('Signing DNS commit + reveal…');
  const pair = await signInscriptionTxs({
    text,
    fromAddress: params.fromAddress,
    privateKeyWIF: params.privateKeyWIF,
    feeRate: params.feeRate ?? 0,
    contentType: plain ? 'text/plain;charset=utf-8' : 'application/json',
    extraRevealPayments: fee,
  });
  params.onStatus?.('Broadcasting commit…');
  await broadcastSignedTransaction(pair.commitTxHex);
  params.onStatus?.('Broadcasting reveal…');
  await broadcastSignedTransaction(pair.revealTxHex);
  const inscriptionId = `${pair.revealTxid}i0`;
  journalDnsTx({
    txid: pair.revealTxid,
    address: params.fromAddress,
    action: params.op === 'register' ? 'register' : 'config',
    name,
    inscriptionId,
    commitTxid: pair.commitTxid,
  });
  if (pair.commitTxid && pair.commitTxid !== pair.revealTxid) {
    journalDnsTx({
      txid: pair.commitTxid,
      address: params.fromAddress,
      action: 'commit',
      name,
      inscriptionId,
    });
  }
  return {
    commitTxid: pair.commitTxid,
    revealTxid: pair.revealTxid,
    inscriptionId,
  };
}
