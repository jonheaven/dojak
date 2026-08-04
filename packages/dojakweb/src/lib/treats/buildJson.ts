import { TREATS_TICKER_MAX, type TreatsOpKind } from './constants';

function normalizeTicker(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > TREATS_TICKER_MAX || t.length < 1) return null;
  if (!/^[a-zA-Z0-9]+$/.test(t)) return null;
  return t.toLowerCase();
}

function positiveIntString(v: string): string | null {
  const s = v.trim();
  if (!s || !/^[0-9]+$/.test(s)) return null;
  if (s.length > 1 && s.starts_with('0')) return null;
  if (s === '0') return null;
  return s;
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

/** Treats v1.0 compact deploy JSON. */
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
    // Always emit when set (including "0") so UIs are explicit
    obj.dec = d;
  }

  const json = JSON.stringify(obj);
  // Soft 80-byte guard for OP_RETURN script payload headroom
  if (json.length > 72) {
    console.warn('[treats] deploy JSON is long (%d chars) — may approach 80-byte OP_RETURN limit', json.length);
  }
  return json;
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

export function buildTreatsMintJson(tick: string, amt: string, idPrefix?: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  const obj: Record<string, string> = { p: 'dt', op: 'm', t, a };
  if (idPrefix?.trim()) {
    const i = idPrefix.trim().toLowerCase().slice(0, 16);
    if (!/^[0-9a-f]{16}$/.test(i)) return null;
    obj.i = i;
  }
  return JSON.stringify(obj);
}

export type TreatsMintPowFields = {
  challengeId: string;
  nonce: string;
  difficulty: number;
};

export function buildTreatsMintPowJson(
  tick: string,
  amt: string,
  pow: TreatsMintPowFields,
): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  const c = pow.challengeId.trim().toLowerCase();
  const n = pow.nonce.trim();
  const d = pow.difficulty;
  if (!/^[0-9a-f]{16}$/.test(c)) return null;
  if (!/^[0-9]{1,12}$/.test(n) || (n.length > 1 && n.starts_with('0'))) return null;
  if (!Number.isInteger(d) || d < 1 || d > 7) return null;
  return JSON.stringify({ p: 'dt', op: 'm', t, a, d: String(d), c, n });
}

export function buildTreatsTransferJson(tick: string, amt: string, idPrefix?: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  const obj: Record<string, string> = { p: 'dt', op: 't', t, a };
  if (idPrefix?.trim()) {
    const i = idPrefix.trim().toLowerCase().slice(0, 16);
    if (!/^[0-9a-f]{16}$/.test(i)) return null;
    obj.i = i;
  }
  return JSON.stringify(obj);
}

export function treatsIdPrefixFromAssetId(assetId: string): string {
  const base = assetId.split('i', 1)[0].toLowerCase();
  return base.slice(0, 16);
}

export function buildTreatsBurnJson(tick: string, amt: string, idPrefix?: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  const obj: Record<string, string> = { p: 'dt', op: 'b', t, a };
  if (idPrefix?.trim()) {
    const i = idPrefix.trim().toLowerCase().slice(0, 16);
    if (!/^[0-9a-f]{16}$/.test(i)) return null;
    obj.i = i;
  }
  return JSON.stringify(obj);
}

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
      if (fields.powChallengeId && fields.powNonce && fields.powDifficulty) {
        json = buildTreatsMintPowJson(fields.tick ?? '', fields.amt ?? '', {
          challengeId: fields.powChallengeId,
          nonce: fields.powNonce,
          difficulty: Number(fields.powDifficulty),
        });
      } else {
        json = buildTreatsMintJson(fields.tick ?? '', fields.amt ?? '');
      }
      break;
    case 'transfer':
      json = buildTreatsTransferJson(fields.tick ?? '', fields.amt ?? '');
      break;
    case 'burn':
      json = buildTreatsBurnJson(fields.tick ?? '', fields.amt ?? '');
      break;
  }
  return json ? Buffer.from(json, 'utf8') : null;
}
