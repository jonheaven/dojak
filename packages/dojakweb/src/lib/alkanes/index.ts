/**
 * Ðalkanes helpers for Dojakweb — build 0xD1 calls + deploy WASM via Doginals chain.
 * Spec: dogenals/spec/protocols/alkanes/
 */
import { signDoginalInscriptionChain } from '../dogetag/doginal-chain';
import {
  broadcastTxWithStatus,
  broadcastSignedTransaction,
  signOpReturnTransaction,
} from '../broadcast/dogecoinTxBroadcast';
import { upsertWalletTxJournalEntry } from '../wallet-tx-journal';

export const ALKANES_MAGIC = 0xd1;
export const ALKANES_VERSION = 0x01;

export type AlkaneMeta = {
  id: string;
  txid: string;
  height: number;
  tx_index: number;
  code_hash: string;
  code_len: number;
  content_type?: string | null;
};

export type AlkaneTemplate = {
  ok: boolean;
  name: string;
  description: string;
  content_type: string;
  code_hash: string;
  wasm_hex: string;
  deploy_body_hex: string;
  ops: Record<string, string>;
  fee_bps?: number;
  domain_tag?: string;
  sign_payload?: string;
};

/** @deprecated use AlkaneTemplate */
export type AmmTemplate = AlkaneTemplate;

export type AlkanesTemplateId =
  | 'amm'
  | 'oracle'
  | 'price-oracle'
  | 'token'
  | 'tax-amm'
  | 'ico'
  | 'prediction'
  | 'custody-amm'
  | 'event-oracle'
  | 'poly-market'
  | 'multi-market';

export async function fetchAlkaneTemplate(
  apiBase: string,
  id: AlkanesTemplateId = 'amm',
): Promise<AlkaneTemplate> {
  const base = apiBase.replace(/\/$/, '');
  const r = await fetch(`${base}/api/alkanes/templates/${id}`);
  const j = (await r.json()) as AlkaneTemplate;
  if (!j?.ok) throw new Error((j as { error?: string }).error || `${id} template fetch failed`);
  return j;
}

export async function fetchAmmTemplate(apiBase: string): Promise<AlkaneTemplate> {
  return fetchAlkaneTemplate(apiBase, 'amm');
}

export async function fetchAlkanesTemplatesList(
  apiBase: string,
): Promise<Array<{ id: string; name: string; path: string }>> {
  const base = apiBase.replace(/\/$/, '');
  const r = await fetch(`${base}/api/alkanes/templates`);
  const j = (await r.json()) as {
    ok?: boolean;
    templates?: Array<{ id: string; name: string; path: string }>;
    error?: string;
  };
  if (j.error && !j.templates) throw new Error(j.error);
  return Array.isArray(j.templates) ? j.templates : [];
}

function encodeLeb128(n: bigint): number[] {
  let v = n < 0n ? 0n : n;
  const out: number[] = [];
  while (true) {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v !== 0n) b |= 0x80;
    out.push(b);
    if (v === 0n) break;
  }
  return out;
}

export function encodeCellpack(params: {
  targetBlock: number | bigint;
  targetTx: number | bigint;
  fuel: number | bigint;
  inputs: Array<number | bigint | string>;
}): Uint8Array {
  const inputs = params.inputs.map((x) => BigInt(x));
  const bytes: number[] = [];
  bytes.push(...encodeLeb128(BigInt(params.targetBlock)));
  bytes.push(...encodeLeb128(BigInt(params.targetTx)));
  bytes.push(...encodeLeb128(BigInt(params.fuel)));
  bytes.push(...encodeLeb128(BigInt(inputs.length)));
  for (const i of inputs) bytes.push(...encodeLeb128(i));
  return new Uint8Array(bytes);
}

function pushData(script: number[], data: Uint8Array) {
  if (data.length <= 75) {
    script.push(data.length);
    script.push(...data);
  } else if (data.length <= 255) {
    script.push(0x4c, data.length);
    script.push(...data);
  } else {
    script.push(0x4d, data.length & 0xff, (data.length >> 8) & 0xff);
    script.push(...data);
  }
}

/** OP_RETURN script hex for a Ðalkanes call. */
export function buildAlkanesCallScriptHex(cellpack: Uint8Array): string {
  const payload = new Uint8Array(2 + cellpack.length);
  payload[0] = ALKANES_MAGIC;
  payload[1] = ALKANES_VERSION;
  payload.set(cellpack, 2);
  const script: number[] = [0x6a];
  pushData(script, payload);
  return script.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/\s/g, '');
  if (h.length % 2) throw new Error('odd hex');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function fetchAlkanesList(apiBase: string, limit = 40): Promise<AlkaneMeta[]> {
  const base = apiBase.replace(/\/$/, '');
  const r = await fetch(`${base}/api/alkanes?limit=${limit}`);
  const j = (await r.json()) as { ok?: boolean; items?: AlkaneMeta[]; error?: string };
  if (j.error && !j.items) throw new Error(j.error);
  return Array.isArray(j.items) ? j.items : [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Full OP_RETURN push body: magic ‖ version ‖ cellpack (must fit ~80 B Dogecoin limit). */
export function buildAlkanesCallPayload(cellpack: Uint8Array): Buffer {
  const payload = Buffer.alloc(2 + cellpack.length);
  payload[0] = ALKANES_MAGIC;
  payload[1] = ALKANES_VERSION;
  Buffer.from(cellpack).copy(payload, 2);
  if (payload.length > 80) {
    throw new Error(`Ðalkanes call payload ${payload.length} B exceeds Dogecoin OP_RETURN ~80 B limit`);
  }
  return payload;
}

export async function broadcastAlkanesCall(params: {
  targetBlock: number;
  targetTx: number;
  inputs: Array<number | bigint | string>;
  fuel?: number;
  fromAddress: string;
  privateKeyWIF: string;
  feeRate?: number;
  /** Extra DOGE output (koinu) — counted as alkane_value via change heuristic. */
  attachSatoshis?: number;
}): Promise<{ txid: string; rawHex: string; scriptHex: string }> {
  const cell = encodeCellpack({
    targetBlock: params.targetBlock,
    targetTx: params.targetTx,
    fuel: params.fuel ?? 200_000,
    inputs: params.inputs,
  });
  const payload = buildAlkanesCallPayload(cell);
  const scriptHex = buildAlkanesCallScriptHex(cell);
  const attach = params.attachSatoshis ?? 0;
  const signed = await signOpReturnTransaction({
    message: '',
    rawPayload: payload,
    fromAddress: params.fromAddress,
    privateKeyWIF: params.privateKeyWIF,
    feeRate: params.feeRate ?? 1000,
    tip:
      attach >= 100_000
        ? { address: params.fromAddress, satoshis: attach }
        : undefined,
  });
  const txid = await broadcastSignedTransaction(signed.rawHex);
  upsertWalletTxJournalEntry({
    txid,
    address: params.fromAddress,
    protocol: 'alkanes',
    action: 'call',
    title: 'Ðalkanes call',
    summary: `target ${params.targetBlock}:${params.targetTx}${
      attach ? ` · attach ${attach} koinu` : ''
    }`,
    status: 'broadcasted',
    metadata: { scriptHex, inputs: params.inputs.map(String), attachSatoshis: attach || undefined },
  });
  return { txid, rawHex: signed.rawHex, scriptHex };
}

export async function deployAlkaneWasm(params: {
  deployBodyHex: string;
  contentType?: string;
  fromAddress: string;
  privateKeyWIF: string;
  feeRate?: number;
  label?: string;
}): Promise<{ commitTxid: string; revealTxid: string; inscriptionId: string }> {
  const content = Buffer.from(hexToBytes(params.deployBodyHex));
  const pair = await signDoginalInscriptionChain({
    content,
    contentType: params.contentType || 'application/wasm',
    fromAddress: params.fromAddress,
    privateKeyWIF: params.privateKeyWIF,
    feeRate: params.feeRate ?? 1000,
  });
  for (let i = 0; i < pair.stages.length; i++) {
    const stage = pair.stages[i]!;
    await broadcastTxWithStatus(stage.txHex);
    if (i + 1 < pair.stages.length) await sleep(900);
  }
  const commitTxid = pair.stages[0]?.txid || '';
  upsertWalletTxJournalEntry({
    txid: pair.revealTxid,
    address: params.fromAddress,
    protocol: 'alkanes',
    action: 'deploy',
    title: params.label || 'Ðalkanes deploy',
    summary: `WASM contract · ${content.length} B`,
    status: 'broadcasted',
  });
  return {
    commitTxid,
    revealTxid: pair.revealTxid,
    inscriptionId: pair.inscriptionId,
  };
}
