/**
 * DNS — Dogecoin Name System (`.doge` names).
 * Spec: dogenals/spec/protocols/dns/spec.md
 *
 * Names are Doginals inscriptions (not OP_RETURN). Sign with signInscriptionTxs.
 */
import { signInscriptionTxs } from './dogetag/inscribe';
import { broadcastSignedTransaction } from './broadcast/dogecoinTxBroadcast';

export const DNS_MARKER = 'dns';
export const DNS_HERO_NAMESPACE = 'doge';

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const NAMESPACES = new Set([
  'doge',
  'dogecoin',
  'shibe',
  'shib',
  'wow',
  'very',
  'such',
  'much',
  'excite',
  'woof',
  'bark',
  'tail',
  'paws',
  'paw',
  'moon',
  'kabosu',
  'cheems',
  'inu',
  'cook',
  'doggo',
  'boop',
  'zoomies',
  'smol',
  'snoot',
  'pupper',
  'official',
]);
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
  if (!label || !ns || RESERVED.has(label) || !LABEL_RE.test(label) || !NAMESPACES.has(ns)) {
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
  if (!name) throw new Error('Invalid .doge name');
  const body: Record<string, string> = {
    p: DNS_MARKER,
    op: opts.op,
    name,
  };
  const r = opts.records || {};
  if (r.address) body.address = r.address.trim();
  if (r.url) body.url = r.url.trim();
  if (r.site) body.site = r.site.trim().toLowerCase();
  if (r.avatar) body.avatar = r.avatar.trim();
  if (r.content) body.content = r.content.trim().slice(0, 280);
  if (r.cname) body.cname = r.cname.trim().toLowerCase();
  return JSON.stringify(body);
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
  onStatus?: (msg: string) => void;
}): Promise<PublishDnsResult> {
  const text = buildDnsInscriptionJson({
    op: params.op,
    name: params.name,
    records: params.records,
  });
  params.onStatus?.('Signing DNS commit + reveal…');
  const pair = await signInscriptionTxs({
    text,
    fromAddress: params.fromAddress,
    privateKeyWIF: params.privateKeyWIF,
    feeRate: params.feeRate ?? 0,
    contentType: 'application/json',
  });
  params.onStatus?.('Broadcasting commit…');
  await broadcastSignedTransaction(pair.commitTxHex);
  params.onStatus?.('Broadcasting reveal…');
  await broadcastSignedTransaction(pair.revealTxHex);
  return {
    commitTxid: pair.commitTxid,
    revealTxid: pair.revealTxid,
    inscriptionId: `${pair.revealTxid}i0`,
  };
}
