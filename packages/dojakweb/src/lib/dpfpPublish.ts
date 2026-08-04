/**
 * ÐPFP / ÐPFA on-chain bind helpers (identity layer).
 * Spec: dogenals/spec/protocols/dpfp/spec.md v1.0
 *
 * Local prefs: useDogePFP / useDogePFA.
 * Publish: inscribe bind JSON (browser wallet commit-reveal) so dogex resolves
 * the same face for every app.
 */

import { signInscriptionTxs } from './dogetag/inscribe';
import { broadcastSignedTransaction } from './broadcast/dogecoinTxBroadcast';

export type DpfpRole = 'pfp' | 'pfa';

export function buildDpfpBindInscriptionJson(opts: {
  role: DpfpRole;
  op: 'set' | 'clear';
  /** Media inscription id when op=set */
  inscriptionId?: string;
}): string {
  const p = opts.role === 'pfp' ? 'Ð:PFP' : 'Ð:PFA';
  const body: Record<string, string> = {
    p,
    v: '1.0',
    op: opts.op,
    chain: 'dogecoin',
  };
  if (opts.op === 'set') {
    const id = opts.inscriptionId?.trim().toLowerCase();
    if (!id || !id.includes('i')) {
      throw new Error('inscriptionId required for set (e.g. txidi0)');
    }
    body.inscription_id = id;
  }
  return JSON.stringify(body);
}

export type ChainProfile = {
  address: string;
  pfp: {
    inscriptionId?: string | null;
    contentPath?: string | null;
    notHolding?: boolean | null;
  } | null;
  pfa: {
    inscriptionId?: string | null;
    contentPath?: string | null;
    notHolding?: boolean | null;
  } | null;
};

/** Resolve eco-wide profile from dogex (or compatible) indexer. */
export async function fetchChainProfile(
  indexerBase: string,
  address: string,
): Promise<ChainProfile | null> {
  const base = indexerBase.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/profile/${encodeURIComponent(address.trim())}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ChainProfile;
  } catch {
    return null;
  }
}

export function chainContentUrl(
  indexerBase: string,
  inscriptionId: string | null | undefined,
): string | null {
  if (!inscriptionId) return null;
  return `${indexerBase.replace(/\/+$/, '')}/api/doginals/content/${encodeURIComponent(inscriptionId)}`;
}

export type PublishDpfpBindParams = {
  role: DpfpRole;
  op: 'set' | 'clear';
  mediaInscriptionId?: string;
  fromAddress: string;
  privateKeyWIF: string;
  feeRate?: number;
  excludedOutpoints?: string[];
  onProgress?: (msg: string) => void;
};

export type PublishDpfpBindResult = {
  bindInscriptionId: string;
  commitTxid: string;
  revealTxid: string;
  json: string;
};

/**
 * Inscribe a ÐPFP/ÐPFA bind with the local browser wallet (commit + reveal).
 * Requires WIF access — same as Dogetag:inscription.
 */
export async function publishDpfpBindOnChain(
  params: PublishDpfpBindParams,
): Promise<PublishDpfpBindResult> {
  const json = buildDpfpBindInscriptionJson({
    role: params.role,
    op: params.op,
    inscriptionId: params.mediaInscriptionId,
  });

  params.onProgress?.('Building commit/reveal…');
  const plan = await signInscriptionTxs({
    text: json,
    fromAddress: params.fromAddress,
    privateKeyWIF: params.privateKeyWIF,
    feeRate: params.feeRate ?? 100_000,
    contentType: 'application/json',
    metaprotocol: params.role === 'pfp' ? 'Ð:PFP' : 'Ð:PFA',
    excludedOutpoints: params.excludedOutpoints,
  });

  params.onProgress?.('Broadcasting commit…');
  await broadcastSignedTransaction(plan.commitTxHex);

  params.onProgress?.('Waiting briefly, then reveal…');
  // Short delay so relays accept reveal (commit may still be in mempool).
  await new Promise((r) => setTimeout(r, 2500));

  params.onProgress?.('Broadcasting reveal…');
  await broadcastSignedTransaction(plan.revealTxHex);

  return {
    bindInscriptionId: plan.inscriptionId,
    commitTxid: plan.commitTxid,
    revealTxid: plan.revealTxid,
    json,
  };
}
