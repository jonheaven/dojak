/**
 * Charms Service
 * 
 * High-level API for interacting with the Charms protocol.
 * Handles spell creation, verification, and broadcast.
 */

import type {
  CharmsChainId,
  TokenBalanceResponse,
  MintParams,
  PrepareMintResponse,
  BroadcastResponse,
  PrepareTransferResponse,
  TransferTokenParams,
  BeamAssetParams,
  BeamAssetResult,
  ProofBundle,
  TransferPreparePayload,
  BeamPreparePayload,
} from '../lib/charms/types';
import { CHARMS_API_BASE } from '../lib/charms/constants';
import { coerceSignedPsdtToRawTxHex } from '../lib/doginal-psdt';

export interface CharmsWalletSigner {
  signPsdt: (psdt: string) => Promise<string>;
  publicKey?: string;
}

export interface IndexedCharmUtxo {
  txid: string;
  vout: number;
  app_id: string;
  charm_data: Record<string, unknown>;
  spent_by_txid?: string | null;
  spent_by_vin?: number | null;
}

export interface IndexedCharmSpell {
  txid: string;
  vout: number;
  block_height: number;
  block_timestamp: number;
  version: number;
  mock: boolean;
  carrier: string;
  app_ids: string[];
  raw_payload: string;
  proof: string;
  normalized_spell: unknown;
}

interface RequestOptions extends RequestInit {
  signal?: AbortSignal;
}

/**
 * Normalize a spell (JSON) and compute its hash
 */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hash}`;
}

async function normaliseSpell(spell: unknown): Promise<{ canonical: string; hash: string }> {
  const canonical = typeof spell === 'string' ? spell : JSON.stringify(spell);
  const hash = (await sha256Hex(canonical)).toLowerCase();
  return { canonical, hash };
}

/**
 * Resolve spell hash from proof bundle
 */
function resolveBundleSpellHash(
  bundle: { spell_hash?: unknown; public_inputs?: Record<string, unknown> },
): string | null {
  const direct = typeof bundle.spell_hash === 'string' ? bundle.spell_hash : null;
  if (direct && direct.length > 0) {
    return direct.toLowerCase();
  }
  const publicInputHash =
    typeof bundle.public_inputs?.spell_hash === 'string'
      ? (bundle.public_inputs.spell_hash as string)
      : null;
  return publicInputHash ? publicInputHash.toLowerCase() : null;
}

/**
 * Verify spell hash matches proof bundle
 */
function assertSpellHashMatch(computed: string, bundleHash: string | null, context: string): void {
  if (!bundleHash) {
    throw new Error(`Missing spell hash for ${context} verification`);
  }
  if (computed.toLowerCase() !== bundleHash.toLowerCase()) {
    throw new Error(
      `Spell hash mismatch for ${context}. Expected ${bundleHash}, computed ${computed}`,
    );
  }
}

/**
 * Generic API request handler
 */
async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const baseUrl = CHARMS_API_BASE;
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request to ${url} failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

/**
 * Main Charms service class
 */
export class CharmsService {
  constructor(private readonly network: string = 'testnet4') {}

  /**
   * Get token balance for an address
   */
  async getTokenBalance(chainId: CharmsChainId, ticker: string, address: string) {
    const searchParams = new URLSearchParams({
      chainId,
      ticker,
      address,
    });

    const data = await request<TokenBalanceResponse>(`/balance?${searchParams.toString()}`);

    return {
      ticker: data.ticker,
      balance: BigInt(data.balance),
      chainId: data.chainId,
      address: data.address,
      charms: data.charms,
      lastUpdated: new Date(data.lastUpdated),
    };
  }

  /**
   * Get balance (confirmed and pending)
   */
  async getBalance(
    chainId: CharmsChainId,
    ticker: string,
    address: string,
    options?: { utxos?: Array<{ value: string; status: { confirmed: boolean } }> },
  ): Promise<{ confirmed: bigint; pending: bigint }> {
    if (options?.utxos && options.utxos.length > 0) {
      const confirmed = options.utxos
        .filter((utxo) => utxo.status.confirmed)
        .reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
      const pending = options.utxos
        .filter((utxo) => !utxo.status.confirmed)
        .reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
      return { confirmed, pending };
    }
    const fallback = await this.getTokenBalance(chainId, ticker, address);
    return { confirmed: fallback.balance, pending: 0n };
  }

  /**
   * Prepare a mint transaction
   */
  async prepareMint(params: {
    ticker: string;
    supply: bigint;
    decimals: number;
    chainId: CharmsChainId;
    address: string;
    metadata?: Record<string, unknown>;
  }): Promise<PrepareMintResponse> {
    const payload = {
      ticker: params.ticker,
      supply: params.supply.toString(),
      decimals: params.decimals,
      chainId: params.chainId,
      address: params.address,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    };

    return request<PrepareMintResponse>('/mint/prepare', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Prepare, sign, and broadcast a new Charms token launch/mint.
   */
  async mintToken(params: {
    ticker: string;
    supply: bigint;
    decimals: number;
    chainId: CharmsChainId;
    address: string;
    metadata?: Record<string, unknown>;
    signer: CharmsWalletSigner;
  }): Promise<string> {
    const response = await this.prepareMint(params);
    const signedPayload = await params.signer.signPsdt(response.unsignedTxHex);
    const signedTxHex = coerceSignedPsdtToRawTxHex(signedPayload);
    const broadcast = await this.broadcastSignedTx({
      signedTxHex,
      chainId: params.chainId,
      publicKey: params.signer.publicKey,
    });
    return broadcast.txid;
  }

  /**
   * Broadcast a signed transaction
   */
  async broadcastSignedTx(params: {
    signedTxHex: string;
    chainId: CharmsChainId;
    publicKey?: string;
    spellHash?: string;
  }): Promise<BroadcastResponse> {
    const payload = {
      signedTxHex: params.signedTxHex,
      chainId: params.chainId,
      ...(params.publicKey ? { publicKey: params.publicKey } : {}),
      ...(params.spellHash ? { spell_hash: params.spellHash } : {}),
    };

    return request<BroadcastResponse>('/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Indexer lookup per UTXO. command.dog may return 404/501 until the route is fully wired — treat as “no charms here”
   * so wallet refresh does not fail the whole Charms tab.
   */
  async getCharmsByUtxo(txid: string, vout: number): Promise<IndexedCharmUtxo[]> {
    const baseUrl = CHARMS_API_BASE.replace(/\/$/, '');
    const url = `${baseUrl}/utxos/${encodeURIComponent(txid)}/${Number(vout)}`;
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.status === 404 || response.status === 501 || response.status === 502) {
        return [];
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && typeof (data as { error: string }).error === 'string'
            ? (data as { error: string }).error
            : `Request to ${url} failed with status ${response.status}`;
        throw new Error(message);
      }
      if (!Array.isArray(data)) return [];
      return data as IndexedCharmUtxo[];
    } catch (e) {
      if (e instanceof TypeError) {
        return [];
      }
      throw e;
    }
  }

  async getCharmsByApp(appId: string): Promise<IndexedCharmUtxo[]> {
    return request<IndexedCharmUtxo[]>(`/apps/${encodeURIComponent(appId)}`);
  }

  async getSpellsByTxid(txid: string): Promise<IndexedCharmSpell[]> {
    return request<IndexedCharmSpell[]>(`/spells/${txid}`);
  }

  /**
   * Prepare a transfer transaction
   */
  async prepareTransfer(params: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    ticker: string;
    chainId: CharmsChainId;
    changeAddress?: string;
  }): Promise<PrepareTransferResponse> {
    const payload = {
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      amount: params.amount,
      ticker: params.ticker,
      chainId: params.chainId,
      ...(params.changeAddress ? { changeAddress: params.changeAddress } : {}),
    };

    return request<PrepareTransferResponse>('/transfer/prepare', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Transfer tokens between addresses
   */
  async transferToken(
    params: TransferTokenParams & { walletId?: number; accountId?: number; signer?: CharmsWalletSigner },
  ): Promise<string> {
    const preparePayload = {
      ticker: params.ticker,
      from_utxo: params.fromUtxo,
      from_address: params.fromAddress,
      to_address: params.toAddress,
      amount: params.amount.toString(),
      chainId: params.chainId,
      ...(params.identityOverride ? { identity: params.identityOverride } : {}),
      ...(params.verificationKeyOverride ? { vk: params.verificationKeyOverride } : {}),
      ...(params.changeAddress ? { change_address: params.changeAddress } : {}),
    };

    const response = await request<TransferPreparePayload>('/transfer/prepare', {
      method: 'POST',
      body: JSON.stringify(preparePayload),
    });

    const parsedSpell = JSON.parse(response.spellJson);
    const { hash: computedHash } = await normaliseSpell(parsedSpell);
    const bundleHash = resolveBundleSpellHash(response.proofBundle);
    assertSpellHashMatch(computedHash, bundleHash, 'transfer');

    if (!params.signer) {
      throw new Error('A connected wallet signer is required to transfer Charms');
    }

    const signedPayload = await params.signer.signPsdt(response.unsignedTxHex);
    const signedTxHex = coerceSignedPsdtToRawTxHex(signedPayload);

    const broadcast = await this.broadcastSignedTx({
      signedTxHex,
      chainId: params.chainId,
      publicKey: params.signer.publicKey,
      spellHash: bundleHash ?? computedHash,
    });

    return broadcast.txid;
  }

  /**
   * Beam asset to another chain
   */
  async beamAsset(params: BeamAssetParams & { walletId?: number; accountId?: number; signer?: CharmsWalletSigner }): Promise<BeamAssetResult> {
    const placeholderTxid = (await sha256Hex(`${params.destAddress}:${Date.now()}`))
      .replace(/^0x/, '')
      .slice(0, 64);
    const destUtxoId = `${placeholderTxid}:0`;
    const destUtxoHash = await sha256Hex(destUtxoId);

    const preparePayload = {
      ticker: params.ticker,
      asset_utxo: params.assetUtxo,
      to_chain: params.toChain,
      dest_utxo_hash: destUtxoHash,
      amount: params.amount.toString(),
      chainId: params.fromChain,
      ...(params.identityOverride ? { identity: params.identityOverride } : {}),
      ...(params.verificationKeyOverride ? { vk: params.verificationKeyOverride } : {}),
    };

    const prepareResponse = await request<BeamPreparePayload>('/beam/prepare', {
      method: 'POST',
      body: JSON.stringify(preparePayload),
    });

    const parsedSpell = JSON.parse(prepareResponse.source_spell_json);
    const { hash: computedHash } = await normaliseSpell(parsedSpell);
    const bundleHash = resolveBundleSpellHash(prepareResponse.proofBundle);
    assertSpellHashMatch(computedHash, bundleHash, 'beam');

    if (!params.signer) {
      throw new Error('A connected wallet signer is required to beam Charms');
    }

    const unsignedPayload = prepareResponse.placeholder_tx_hex;
    if (!unsignedPayload) {
      throw new Error('Charms beam prepare did not return an unsigned Dogecoin transaction');
    }
    const signedPayload = await params.signer.signPsdt(unsignedPayload);
    const signedTxHex = coerceSignedPsdtToRawTxHex(signedPayload);

    const broadcast = await this.broadcastSignedTx({
      signedTxHex,
      chainId: params.fromChain,
      publicKey: params.signer.publicKey,
      spellHash: bundleHash ?? computedHash,
    });

    return {
      placeholderTxid,
      sourceTxid: broadcast.txid,
      fromChain: params.fromChain,
      toChain: params.toChain,
      ticker: params.ticker,
      amount: params.amount,
      destAddress: params.destAddress,
    };
  }
}

// Export singleton instance
export const charmsService = new CharmsService();
