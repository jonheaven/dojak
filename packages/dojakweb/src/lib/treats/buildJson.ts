import { TREATS_MAX_OPRETURN_SCRIPT_BYTES, TREATS_TICKER_MAX, type TreatsOpKind } from './constants';

function normalizeTicker(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > TREATS_TICKER_MAX || t.length < 1) return null;
  if (!/^[a-zA-Z0-9]+$/.test(t)) return null;
  return t.toLowerCase();
}

function positiveIntString(v: string): string | null {
  const s = v.trim();
  if (!s || !/^[0-9]+$/.test(s)) return null;
  if (s.length > 1 && s.startsWith('0')) return null;
  if (s === '0') return null;
  return s;
}

/** Treats ÐA: `{height}:{tx_index}` (no leading zeros except tx `0`). */
export function normalizeTreatsDa(raw: string): string | null {
  const s = raw.trim();
  const m = /^(\d+):(\d+)$/.exec(s);
  if (!m) return null;
  const block = m[1]!;
  const tx = m[2]!;
  if (block.length > 1 && block.startsWith('0')) return null;
  if (tx.length > 1 && tx.startsWith('0')) return null;
  return `${block}:${tx}`;
}

function treatsOpReturnScriptLen(json: string): number {
  const n = Buffer.byteLength(json, 'utf8');
  const push = n <= 75 ? 1 : n <= 255 ? 2 : 3;
  return 1 + push + n;
}

function failClosedScript(json: string): string | null {
  if (treatsOpReturnScriptLen(json) > TREATS_MAX_OPRETURN_SCRIPT_BYTES) return null;
  return json;
}

export type TreatsDeployOptions = {
  lim?: string;
  /** Premine base units → paired dust recipient (v1.0 `pm`) */
  premine?: string;
  /** Deployer-only mint window in blocks (v1.0 `dw`) */
  deployerWindow?: string;
  /** Decimals 0–18 (v1.0 `dec`), default omit = 0 on-chain */
  decimals?: string;
};

/** Treats v1 compact deploy JSON. Fail-closed at 83-byte script. */
export function buildTreatsDeployJson(
  tick: string,
  max: string,
  limOrOpts?: string | TreatsDeployOptions,
): string | null {
  const t = normalizeTicker(tick);
  const x = positiveIntString(max);
  if (!t || !x) return null;

  const opts: TreatsDeployOptions =
    typeof limOrOpts === 'string' || limOrOpts === undefined
      ? { lim: limOrOpts }
      : limOrOpts;

  const obj: Record<string, string> = { p: 'dt', op: 'd', t, x };

  if (opts.lim?.trim()) {
    const l = positiveIntString(opts.lim);
    if (!l) return null;
    const maxN = BigInt(x);
    if (BigInt(l) > maxN) return null;
    obj.l = l;
  }
  if (opts.premine?.trim()) {
    const pm = positiveIntString(opts.premine);
    if (!pm) return null;
    if (BigInt(pm) > BigInt(x)) return null;
    obj.pm = pm;
  }
  if (opts.deployerWindow?.trim()) {
    const dw = positiveIntString(opts.deployerWindow);
    if (!dw) return null;
    obj.dw = dw;
  }
  if (opts.decimals !== undefined && opts.decimals !== '') {
    const d = opts.decimals.trim();
    if (!/^(1[0-8]|[0-9])$/.test(d)) return null;
    obj.dec = d;
  }

  return failClosedScript(JSON.stringify(obj));
}

/** Estimate max supply remaining after premine for UI. */
export function treatsPostPremineRemaining(max: string, premine?: string): string | null {
  const x = positiveIntString(max);
  if (!x) return null;
  const pm = premine?.trim() ? positiveIntString(premine) : '0';
  if (pm === null) return null;
  try {
    const rem = BigInt(x) - BigInt(pm);
    if (rem < 0n) return null;
    return rem.toString();
  } catch {
    return null;
  }
}

export function buildTreatsMintJson(tick: string, amt: string, assetId: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  const i = normalizeTreatsDa(assetId);
  if (!t || !a || !i) return null;
  return failClosedScript(JSON.stringify({ p: 'dt', op: 'm', t, a, i }));
}

export function buildTreatsTransferJson(tick: string, amt: string, assetId: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  const i = normalizeTreatsDa(assetId);
  if (!t || !a || !i) return null;
  return failClosedScript(JSON.stringify({ p: 'dt', op: 't', t, a, i }));
}

export function buildTreatsBurnJson(tick: string, amt: string, assetId: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  const i = normalizeTreatsDa(assetId);
  if (!t || !a || !i) return null;
  return failClosedScript(JSON.stringify({ p: 'dt', op: 'b', t, a, i }));
}

/** Wire `i` is the full ÐA (`block:tx`), not a 16-hex prefix. */
export function treatsDaFromAssetId(assetId: string): string {
  return normalizeTreatsDa(assetId) ?? assetId.trim();
}

/** @deprecated Use {@link treatsDaFromAssetId} */
export const treatsIdPrefixFromAssetId = treatsDaFromAssetId;

export function treatsPayloadBytes(op: TreatsOpKind, fields: Record<string, string>): Buffer | null {
  let json: string | null = null;
  switch (op) {
    case 'deploy':
      json = buildTreatsDeployJson(fields.tick ?? '', fields.max ?? '', {
        lim: fields.lim,
        premine: fields.premine ?? fields.pm,
        deployerWindow: fields.deployerWindow ?? fields.dw,
        decimals: fields.decimals ?? fields.dec,
      });
      break;
    case 'mint':
      json = buildTreatsMintJson(fields.tick ?? '', fields.amt ?? '', fields.assetId ?? fields.i ?? '');
      break;
    case 'transfer':
      json = buildTreatsTransferJson(fields.tick ?? '', fields.amt ?? '', fields.assetId ?? fields.i ?? '');
      break;
    case 'burn':
      json = buildTreatsBurnJson(fields.tick ?? '', fields.amt ?? '', fields.assetId ?? fields.i ?? '');
      break;
  }
  return json ? Buffer.from(json, 'utf8') : null;
}
