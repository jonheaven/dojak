/**
 * Ðclaims helpers — build deploy/claim JSON and envelope options for dogex-compatible
 * parent (tag 3) + metaprotocol (tag 7) inscriptions.
 *
 * Spec: dogenals/spec/dclaims.md
 */

import {
  signInscriptionTxs,
  type RevealPaymentOutput,
  type SignedInscriptionPair,
} from '../dogetag/inscribe';

export const DCLAIMS_P = 'dclaims';
export const DCLAIMS_V = '1';
export const DCLAIMS_CONTENT_TYPE = 'application/json';
export const DEFAULT_PROTOCOL_FEE_BPS = 250;

export interface DclaimRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CreateDclaimDeployParams {
  /** Canvas inscription id (`txid`i`vout`). */
  parent: string;
  width: number;
  height: number;
  creatorAddress: string;
  /** Koinu (1e-8 DOGE). */
  mintPrice: number | string;
  name?: string;
  gridW?: number;
  gridH?: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  protocolFeeBps?: number;
  protocolFeeFlat?: number;
  note?: string;
  attributes?: Record<string, unknown>;
}

export interface CreateDclaimParams extends DclaimRect {
  parent: string;
  deploy?: string;
  note?: string;
  attributes?: Record<string, unknown>;
}

export interface DclaimFeeQuote {
  mintPrice: number;
  protocolFee: number;
  total: number;
  protocolAddress?: string | null;
}

/** Parse `txid i index` → 36-byte parent tag (txid internal order + index BE). */
export function inscriptionIdToParentBytes(inscriptionId: string): Buffer {
  const s = inscriptionId.trim().toLowerCase();
  const i = s.lastIndexOf('i');
  if (i < 0) throw new Error(`Invalid inscription id: ${inscriptionId}`);
  const tx = s.slice(0, i);
  const idx = s.slice(i + 1);
  if (tx.length !== 64 || !/^[0-9a-f]+$/.test(tx)) {
    throw new Error(`Invalid inscription txid: ${inscriptionId}`);
  }
  const index = Number.parseInt(idx, 10);
  if (!Number.isFinite(index) || index < 0) {
    throw new Error(`Invalid inscription index: ${inscriptionId}`);
  }
  const txidInternal = Buffer.from(tx, 'hex').reverse();
  const indexBe = Buffer.alloc(4);
  indexBe.writeUInt32BE(index >>> 0, 0);
  return Buffer.concat([txidInternal, indexBe]);
}

export function protocolFeeAmount(
  mintPrice: number,
  bps: number = DEFAULT_PROTOCOL_FEE_BPS,
  flat: number = 0,
): number {
  const b = Math.min(1000, Math.max(0, Math.floor(bps)));
  return Math.floor((mintPrice * b) / 10_000) + Math.max(0, Math.floor(flat));
}

export function buildDeployPayload(p: CreateDclaimDeployParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    p: DCLAIMS_P,
    v: DCLAIMS_V,
    op: 'deploy',
    parent: p.parent.trim().toLowerCase(),
    width: Math.floor(p.width),
    height: Math.floor(p.height),
    creator_address: p.creatorAddress,
    mint_price: String(p.mintPrice),
  };
  if (p.name) body.name = p.name.slice(0, 80);
  if (p.gridW != null) body.grid_w = Math.floor(p.gridW);
  if (p.gridH != null) body.grid_h = Math.floor(p.gridH);
  if (p.minW != null) body.min_w = Math.floor(p.minW);
  if (p.minH != null) body.min_h = Math.floor(p.minH);
  if (p.maxW != null) body.max_w = Math.floor(p.maxW);
  if (p.maxH != null) body.max_h = Math.floor(p.maxH);
  if (p.protocolFeeBps != null) body.protocol_fee_bps = Math.floor(p.protocolFeeBps);
  if (p.protocolFeeFlat != null) body.protocol_fee_flat = Math.floor(p.protocolFeeFlat);
  if (p.note) body.note = p.note.slice(0, 500);
  if (p.attributes) body.attributes = p.attributes;
  return body;
}

export function buildClaimPayload(p: CreateDclaimParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    p: DCLAIMS_P,
    v: DCLAIMS_V,
    op: 'claim',
    parent: p.parent.trim().toLowerCase(),
    x: Math.floor(p.x),
    y: Math.floor(p.y),
    w: Math.floor(p.w),
    h: Math.floor(p.h),
  };
  if (p.deploy) body.deploy = p.deploy.trim().toLowerCase();
  if (p.note) body.note = p.note.slice(0, 200);
  if (p.attributes) {
    body.attributes = p.attributes;
    // Promote common link keys for indexers that store top-level `uri`.
    const uri =
      (typeof p.attributes.uri === 'string' && p.attributes.uri) ||
      (typeof p.attributes.url === 'string' && p.attributes.url) ||
      (typeof p.attributes.website === 'string' && p.attributes.website) ||
      '';
    if (uri.trim()) body.uri = String(uri).trim().slice(0, 500);
  }
  return body;
}

export interface DclaimInscribeOptions {
  fromAddress: string;
  privateKeyWIF: string;
  feeRate?: number;
  excludedOutpoints?: string[];
  inscriptionReceiveAddress?: string;
  /** Extra same-tx payments (creator mint + protocol fee). */
  extraRevealPayments?: RevealPaymentOutput[];
}

/**
 * Inscribe a dclaims deploy (parent tag = canvas).
 */
export async function createDclaimDeploy(
  deploy: CreateDclaimDeployParams,
  wallet: DclaimInscribeOptions,
): Promise<SignedInscriptionPair & { payload: Record<string, unknown> }> {
  const payload = buildDeployPayload(deploy);
  const text = JSON.stringify(payload);
  const pair = await signInscriptionTxs({
    text,
    fromAddress: wallet.fromAddress,
    privateKeyWIF: wallet.privateKeyWIF,
    feeRate: wallet.feeRate,
    excludedOutpoints: wallet.excludedOutpoints,
    inscriptionReceiveAddress: wallet.inscriptionReceiveAddress,
    contentType: DCLAIMS_CONTENT_TYPE,
    parents: [deploy.parent],
    metaprotocol: DCLAIMS_P,
    extraRevealPayments: wallet.extraRevealPayments,
  });
  return { ...pair, payload };
}

/**
 * Inscribe a dclaims claim (parent tag = canvas) with optional fee outputs.
 */
export async function createDclaim(
  claim: CreateDclaimParams,
  wallet: DclaimInscribeOptions,
  fees?: {
    mintPrice: number;
    creatorAddress: string;
    protocolFee: number;
    protocolAddress?: string | null;
  },
): Promise<SignedInscriptionPair & { payload: Record<string, unknown> }> {
  const payload = buildClaimPayload(claim);
  const text = JSON.stringify(payload);
  const payments: RevealPaymentOutput[] = [...(wallet.extraRevealPayments ?? [])];
  if (fees) {
    if (fees.mintPrice > 0 && fees.creatorAddress) {
      payments.push({ address: fees.creatorAddress, satoshis: fees.mintPrice });
    }
    if (fees.protocolFee > 0 && fees.protocolAddress) {
      payments.push({ address: fees.protocolAddress, satoshis: fees.protocolFee });
    }
  }
  const pair = await signInscriptionTxs({
    text,
    fromAddress: wallet.fromAddress,
    privateKeyWIF: wallet.privateKeyWIF,
    feeRate: wallet.feeRate,
    excludedOutpoints: wallet.excludedOutpoints,
    inscriptionReceiveAddress: wallet.inscriptionReceiveAddress,
    contentType: DCLAIMS_CONTENT_TYPE,
    parents: [claim.parent],
    metaprotocol: DCLAIMS_P,
    extraRevealPayments: payments.length ? payments : undefined,
  });
  return { ...pair, payload };
}

export function quoteDclaimMint(params: {
  mintPrice: number;
  protocolFeeBps?: number;
  protocolFeeFlat?: number;
  protocolAddress?: string | null;
}): DclaimFeeQuote {
  const mintPrice = Math.max(0, Math.floor(params.mintPrice));
  const protocolFee = protocolFeeAmount(
    mintPrice,
    params.protocolFeeBps ?? DEFAULT_PROTOCOL_FEE_BPS,
    params.protocolFeeFlat ?? 0,
  );
  return {
    mintPrice,
    protocolFee,
    total: mintPrice + protocolFee,
    protocolAddress: params.protocolAddress ?? null,
  };
}
