/**
 * Local Browser Wallet: decode a PSBT and optionally compare it to host-app claims.
 * Ground truth is always the PSBT — site copy is advisory until it matches.
 */
import * as bitcoin from 'bitcoinjs-lib';
import { DOGE_NETWORK, shibesToDoge, tryParsePsdt } from './doginal-psdt';

export type PsbtHostClaimOutput = {
  /** Expected destination (Dogecoin address). */
  address?: string;
  /** Exact output value in koinu (shibes). Prefer over valueDoge. */
  valueKoinu?: number;
  /** Convenience — converted with Math.round(doge * 1e8). */
  valueDoge?: number;
  /** Soft label used in mismatch copy (e.g. "dummy", "seller payment"). */
  role?: string;
};

export type PsbtHostClaims = {
  outputs?: PsbtHostClaimOutput[];
  /** Warn if output count is outside this range. */
  minOutputs?: number;
  maxOutputs?: number;
  /**
   * When set, any decoded output address not in this list (and not OP_RETURN)
   * is a red-flag mismatch.
   */
  allowedAddresses?: string[];
  /** Soft fee ceiling in koinu — warn if estimated fee exceeds this. */
  maxFeeKoinu?: number;
};

export type PsbtDecodedOutput = {
  index: number;
  address: string | null;
  valueKoinu: number;
  /** true when script could not be decoded as a standard address (OP_RETURN, etc.). */
  nonstandard: boolean;
};

export type PsbtAuditResult = {
  parseOk: boolean;
  parseError?: string;
  inputCount: number;
  outputs: PsbtDecodedOutput[];
  totalOutKoinu: number;
  /** null when input values are incomplete (cannot compute fee). */
  feeKoinu: number | null;
  /** Human rows for the approval sheet (wallet-decoded, not host copy). */
  summaryRows: Array<{ label: string; value: string }>;
  mismatches: string[];
  /** ok = claims match / no claims; warn = soft mismatch; critical = parse fail or hard mismatch */
  risk: 'ok' | 'warn' | 'critical';
};

function claimValueKoinu(c: PsbtHostClaimOutput): number | undefined {
  if (typeof c.valueKoinu === 'number' && Number.isFinite(c.valueKoinu)) {
    return Math.round(c.valueKoinu);
  }
  if (typeof c.valueDoge === 'number' && Number.isFinite(c.valueDoge)) {
    return Math.round(c.valueDoge * 1e8);
  }
  return undefined;
}

function fmtDoge(koinu: number): string {
  const d = shibesToDoge(koinu);
  if (d >= 1) return `${d.toFixed(4)} Ð`;
  if (d >= 0.001) return `${d.toFixed(6)} Ð`;
  return `${d.toFixed(8)} Ð`;
}

function shortAddr(a: string): string {
  if (a.length <= 16) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

function decodeOutputAddress(script: Uint8Array | Buffer): { address: string | null; nonstandard: boolean } {
  try {
    const address = bitcoin.address.fromOutputScript(Buffer.from(script), DOGE_NETWORK);
    return { address, nonstandard: false };
  } catch {
    return { address: null, nonstandard: true };
  }
}

function inputValueKoinu(psbt: bitcoin.Psbt, index: number): number | null {
  try {
    const data = psbt.data.inputs[index] as {
      witnessUtxo?: { value: number | bigint };
      nonWitnessUtxo?: Uint8Array | Buffer;
    };
    if (data?.witnessUtxo?.value != null) {
      return Number(data.witnessUtxo.value);
    }
    if (data?.nonWitnessUtxo) {
      const prev = bitcoin.Transaction.fromBuffer(Buffer.from(data.nonWitnessUtxo));
      const vout = psbt.txInputs[index]?.index;
      if (typeof vout !== 'number') return null;
      const out = prev.outs[vout];
      if (!out) return null;
      return Number(out.value);
    }
  } catch {
    /* incomplete */
  }
  return null;
}

function outputMatchesClaim(out: PsbtDecodedOutput, claim: PsbtHostClaimOutput): boolean {
  const wantValue = claimValueKoinu(claim);
  const wantAddr = claim.address?.trim();
  if (wantAddr && out.address !== wantAddr) return false;
  if (wantValue != null && out.valueKoinu !== wantValue) return false;
  // Need at least one concrete constraint
  return wantAddr != null || wantValue != null;
}

/**
 * Decode PSBT bytes and compare optional host claims.
 * Host narrative is never trusted over the decoded transaction.
 */
export function auditPsbtForWalletApproval(
  psbtInput: string,
  claims?: PsbtHostClaims | null,
): PsbtAuditResult {
  const psbt = tryParsePsdt(psbtInput);
  if (!psbt) {
    return {
      parseOk: false,
      parseError: 'Could not parse PSBT/PSDT — wallet cannot verify outputs before signing.',
      inputCount: 0,
      outputs: [],
      totalOutKoinu: 0,
      feeKoinu: null,
      summaryRows: [{ label: 'Decode', value: 'Failed — approve only if you fully trust this site' }],
      mismatches: ['PSBT could not be decoded by the wallet'],
      risk: 'critical',
    };
  }

  const outputs: PsbtDecodedOutput[] = [];
  let totalOutKoinu = 0;
  for (let i = 0; i < psbt.txOutputs.length; i++) {
    const out = psbt.txOutputs[i]!;
    const valueKoinu = Number(out.value);
    totalOutKoinu += valueKoinu;
    const { address, nonstandard } = decodeOutputAddress(out.script);
    outputs.push({ index: i, address, valueKoinu, nonstandard });
  }

  let totalInKoinu = 0;
  let inputsComplete = true;
  for (let i = 0; i < psbt.txInputs.length; i++) {
    const v = inputValueKoinu(psbt, i);
    if (v == null) {
      inputsComplete = false;
      break;
    }
    totalInKoinu += v;
  }
  const feeKoinu = inputsComplete ? Math.max(0, totalInKoinu - totalOutKoinu) : null;

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: 'Inputs', value: String(psbt.txInputs.length) },
    { label: 'Outputs', value: String(outputs.length) },
  ];
  for (const o of outputs) {
    const dest = o.address ? shortAddr(o.address) : o.nonstandard ? 'OP_RETURN / nonstandard' : 'unknown';
    summaryRows.push({
      label: `Out #${o.index}`,
      value: `${fmtDoge(o.valueKoinu)} → ${dest}`,
    });
  }
  if (feeKoinu != null) {
    summaryRows.push({ label: 'Est. miner fee', value: fmtDoge(feeKoinu) });
  } else {
    summaryRows.push({ label: 'Est. miner fee', value: 'unknown (incomplete input values)' });
  }

  const mismatches: string[] = [];
  if (claims) {
    if (typeof claims.minOutputs === 'number' && outputs.length < claims.minOutputs) {
      mismatches.push(`Site implied ≥${claims.minOutputs} outputs; PSBT has ${outputs.length}`);
    }
    if (typeof claims.maxOutputs === 'number' && outputs.length > claims.maxOutputs) {
      mismatches.push(`Site implied ≤${claims.maxOutputs} outputs; PSBT has ${outputs.length}`);
    }
    if (claims.allowedAddresses?.length) {
      const allowed = new Set(claims.allowedAddresses.map((a) => a.trim()).filter(Boolean));
      for (const o of outputs) {
        if (o.nonstandard || !o.address) continue;
        if (!allowed.has(o.address)) {
          mismatches.push(`PSBT sends ${fmtDoge(o.valueKoinu)} to unexpected address ${shortAddr(o.address)}`);
        }
      }
    }
    if (claims.outputs?.length) {
      const used = new Set<number>();
      for (const claim of claims.outputs) {
        const role = claim.role ? ` (${claim.role})` : '';
        const wantValue = claimValueKoinu(claim);
        const wantAddr = claim.address?.trim();
        const hit = outputs.findIndex((o, idx) => !used.has(idx) && outputMatchesClaim(o, claim));
        if (hit < 0) {
          const parts: string[] = [];
          if (wantValue != null) parts.push(fmtDoge(wantValue));
          if (wantAddr) parts.push(`to ${shortAddr(wantAddr)}`);
          mismatches.push(
            `Site claimed output${role} missing in PSBT${parts.length ? `: ${parts.join(' ')}` : ''}`,
          );
        } else {
          used.add(hit);
        }
      }
    }
    if (typeof claims.maxFeeKoinu === 'number' && feeKoinu != null && feeKoinu > claims.maxFeeKoinu) {
      mismatches.push(
        `Est. fee ${fmtDoge(feeKoinu)} exceeds site ceiling ${fmtDoge(claims.maxFeeKoinu)}`,
      );
    }
  }

  let risk: PsbtAuditResult['risk'] = 'ok';
  if (mismatches.length > 0) {
    // Hard: wrong destinations / missing claimed payouts. Soft: fee-only / count soft.
    const hard = mismatches.some(
      (m) =>
        /unexpected address|claimed output|could not be decoded|Failed/i.test(m) ||
        /implied [≥≤]/i.test(m),
    );
    risk = hard ? 'critical' : 'warn';
  }

  return {
    parseOk: true,
    inputCount: psbt.txInputs.length,
    outputs,
    totalOutKoinu,
    feeKoinu,
    summaryRows,
    mismatches,
    risk,
  };
}
