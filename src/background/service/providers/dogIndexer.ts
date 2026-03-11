/**
 * Dog Indexer API Client
 *
 * Typed client for the `dog server` REST API — the Dogecoin Doginals indexer.
 * Covers: inscriptions, Dunes, DRC-20, DNS (.doge), Dogemaps, UTXOs, health.
 *
 * Base URL defaults to http://localhost:8080 (local `dog server`).
 * Override via DOG_INDEXER_URL env var or the DogIndexerClient constructor.
 *
 * All endpoints send `Accept: application/json` to get JSON instead of HTML.
 */

import axios, { AxiosInstance } from 'axios';
import { DuneBalance, DuneInfo, Inscription, RarityTier } from '@/shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_INDEXER_URL = 'http://localhost:8080';
export const INDEXER_TIMEOUT_MS = 15_000;

// ─── Raw response shapes from dog indexer (snake_case) ───────────────────────

export interface RawHealthResponse {
  index_tip: number;
  chain_tip: number;
  lag_blocks: number;
  status: 'synced' | 'syncing' | 'behind';
}

export interface RawInscription {
  id: string;
  number: number;
  address: string | null;
  satpoint: string;
  sat: number | null;
  content_type: string | null;
  effective_content_type: string | null;
  content_length: number | null;
  metaprotocol: string | null;
  charms: string[];
  height: number;
  timestamp: number;
  fee: number;
  value: number;
  parents: string[];
  children: string[];
  child_count: number;
  next: string | null;
  previous: string | null;
}

export interface RawDuneTerms {
  amount: string | null;
  cap: string | null;
  height: [number | null, number | null];
  offset: [number | null, number | null];
}

export interface RawDune {
  spaced_dune: string;
  block: number;
  burned: string;
  divisibility: number;
  etching: string;
  mints: string;
  number: number;
  premine: string;
  symbol: string | null;
  terms: RawDuneTerms | null;
  timestamp: number;
  turbo: boolean;
  mintable: boolean;
  remaining: string | null;
  supply: string | null;
  holders: number | null;
  transactions: number | null;
}

export interface RawOutput {
  address: string | null;
  outpoint: string;
  value: number;
  inscriptions: string[];
  dunes: Record<string, string>;
  indexed: boolean;
  spent: boolean;
  confirmations: number;
  script_pubkey: string;
}

export interface RawAddressInfo {
  address: string;
  outputs: RawOutput[];
  inscriptions: RawInscription[];
  dunes_balances: Record<string, string>;
  inscription_count: number;
  dune_count: number;
}

export interface RawDNSEntry {
  name: string;
  owner_inscription_id: string;
  height: number;
  timestamp: number;
  config: {
    address?: string;
    url?: string;
    avatar?: string;
    content?: string;
    [key: string]: string | undefined;
  };
}

export interface RawDogemapEntry {
  block_number: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  claimed: boolean;
  owner_inscription_id: string | null;
  claim_height: number | null;
  claim_timestamp: number | null;
  block_hash: string;
  tx_count: number;
  svg: string | null;
  metaverse: {
    color_hue: number;
    elevation: number;
    terrain_seed: number;
    activity: number;
    biome: 'desert' | 'tundra' | 'jungle' | 'ocean' | 'volcanic' | 'grassland' | 'canyon' | 'space';
  } | null;
}

export interface RawBlock {
  hash: string;
  height: number;
  best_height: number;
  target: string;
  timestamp: number;
  inscriptions: string[];
  dunes: string[];
}

export interface RawTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    script_sig: string;
    sequence: number;
  }>;
  vout: Array<{
    value: number;
    n: number;
    script_pubkey: string;
    address: string | null;
  }>;
}

// ─── Wallet-facing mapped types ───────────────────────────────────────────────

export interface IndexerHealthStatus {
  indexTip: number;
  chainTip: number;
  lagBlocks: number;
  status: 'synced' | 'syncing' | 'behind';
  isSynced: boolean;
}

export interface IndexerUTXO {
  txid: string;
  vout: number;
  koinu: number;
  scriptPubKey: string;
  address: string | null;
  confirmations: number;
  spent: boolean;
  indexed: boolean;
  inscriptionIds: string[];
  duneBalances: Record<string, string>;
  isCardinal: boolean;
}

export interface IndexerAddressSummary {
  address: string;
  utxos: IndexerUTXO[];
  inscriptions: Inscription[];
  duneBalances: Record<string, string>;
  inscriptionCount: number;
  duneCount: number;
}

export interface IndexerDNSRecord {
  name: string;
  address: string | null;
  ownerInscriptionId: string;
  height: number;
  timestamp: number;
  url?: string;
  avatar?: string;
  content?: string;
}

export interface IndexerDogemapEntry {
  blockNumber: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  claimed: boolean;
  ownerInscriptionId: string | null;
  claimHeight: number | null;
  claimTimestamp: number | null;
  blockHash: string;
  txCount: number;
  svgData: string | null;
  metaverse: {
    colorHue: number;
    elevation: number;
    terrainSeed: number;
    activity: number;
    biome: string;
  } | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapRarityCharm(charms: string[]): RarityTier | undefined {
  const order: RarityTier[] = [
    RarityTier.MYTHIC,
    RarityTier.LEGENDARY,
    RarityTier.EPIC,
    RarityTier.RARE,
    RarityTier.UNCOMMON,
    RarityTier.COMMON,
  ];
  for (const tier of order) {
    if (charms.includes(tier)) return tier;
  }
  return RarityTier.COMMON;
}

function mapInscription(raw: RawInscription, indexerBaseUrl: string): Inscription {
  const [txid, outputIndexStr] = (raw.satpoint || '::').split(':');
  return {
    inscriptionId: raw.id,
    inscriptionNumber: raw.number,
    address: raw.address || '',
    outputValue: raw.value,
    preview: `${indexerBaseUrl}/inscription/${raw.id}`,
    content: `${indexerBaseUrl}/r/content/${raw.id}`,
    contentType: raw.content_type || '',
    contentLength: raw.content_length || 0,
    timestamp: raw.timestamp,
    genesisTransaction: raw.id.split('i')[0] || txid,
    location: raw.satpoint,
    output: raw.satpoint ? raw.satpoint.slice(0, raw.satpoint.lastIndexOf(':')) : '',
    offset: raw.satpoint ? parseInt(raw.satpoint.split(':')[2] || '0', 10) : 0,
    contentBody: '',
    utxoHeight: raw.height,
    utxoConfirmation: 0,
    parents: raw.parents || [],
    children: raw.children || [],
    rarity: {
      tier: mapRarityCharm(raw.charms || []) as RarityTier,
    },
  };
}

function mapOutput(raw: RawOutput): IndexerUTXO {
  const [txid, voutStr] = raw.outpoint.split(':');
  return {
    txid,
    vout: parseInt(voutStr, 10),
    koinu: raw.value,
    scriptPubKey: raw.script_pubkey,
    address: raw.address,
    confirmations: raw.confirmations,
    spent: raw.spent,
    indexed: raw.indexed,
    inscriptionIds: raw.inscriptions,
    duneBalances: raw.dunes,
    isCardinal: raw.inscriptions.length === 0 && Object.keys(raw.dunes).length === 0,
  };
}

function mapDune(raw: RawDune): DuneInfo {
  const [blockStr, txidxStr] = raw.spaced_dune ? ['0', '0'] : ['0', '0'];
  return {
    duneid: `${raw.block}:${raw.number}`,
    dune: raw.spaced_dune.replace(/[•]/g, ''),
    spacedDune: raw.spaced_dune,
    number: raw.number,
    height: raw.block,
    txidx: raw.number,
    timestamp: raw.timestamp,
    divisibility: raw.divisibility,
    symbol: raw.symbol || '',
    etching: raw.etching,
    premine: raw.premine,
    terms: raw.terms
      ? {
          amount: raw.terms.amount || '0',
          cap: raw.terms.cap || '0',
          heightStart: raw.terms.height[0] || 0,
          heightEnd: raw.terms.height[1] || 0,
          offsetStart: raw.terms.offset[0] || 0,
          offsetEnd: raw.terms.offset[1] || 0,
        }
      : {
          amount: '0',
          cap: '0',
          heightStart: 0,
          heightEnd: 0,
          offsetStart: 0,
          offsetEnd: 0,
        },
    mints: raw.mints,
    burned: raw.burned,
    holders: raw.holders || 0,
    transactions: raw.transactions || 0,
    mintable: raw.mintable,
    remaining: raw.remaining || '0',
    start: raw.terms?.height[0] || 0,
    end: raw.terms?.height[1] || 0,
    supply: raw.supply || raw.premine,
  };
}

function mapDogemap(raw: RawDogemapEntry): IndexerDogemapEntry {
  return {
    blockNumber: raw.block_number,
    rarity: raw.rarity,
    claimed: raw.claimed,
    ownerInscriptionId: raw.owner_inscription_id,
    claimHeight: raw.claim_height,
    claimTimestamp: raw.claim_timestamp,
    blockHash: raw.block_hash,
    txCount: raw.tx_count,
    svgData: raw.svg,
    metaverse: raw.metaverse
      ? {
          colorHue: raw.metaverse.color_hue,
          elevation: raw.metaverse.elevation,
          terrainSeed: raw.metaverse.terrain_seed,
          activity: raw.metaverse.activity,
          biome: raw.metaverse.biome,
        }
      : null,
  };
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class DogIndexerClient {
  private http: AxiosInstance;
  readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_INDEXER_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: INDEXER_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async health(): Promise<IndexerHealthStatus> {
    const { data } = await this.http.get<RawHealthResponse>('/health');
    return {
      indexTip: data.index_tip,
      chainTip: data.chain_tip,
      lagBlocks: data.lag_blocks,
      status: data.status,
      isSynced: data.status === 'synced' || data.status === 'syncing',
    };
  }

  // ── Inscriptions ───────────────────────────────────────────────────────────

  async getInscription(inscriptionId: string): Promise<Inscription> {
    const { data } = await this.http.get<RawInscription>(`/inscription/${inscriptionId}`);
    return mapInscription(data, this.baseUrl);
  }

  async getInscriptionMetadata(inscriptionId: string): Promise<Record<string, unknown> | null> {
    try {
      const { data } = await this.http.get<Record<string, unknown>>(`/r/metadata/${inscriptionId}`);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Returns the URL to fetch raw inscription content.
   * Use this in <img src>, <video src>, fetch(), etc.
   */
  getContentUrl(inscriptionId: string): string {
    return `${this.baseUrl}/r/content/${inscriptionId}`;
  }

  async getInscriptions(page = 0): Promise<{ inscriptions: Inscription[]; more: boolean }> {
    const { data } = await this.http.get<{ inscriptions: RawInscription[]; more: boolean }>(
      `/inscriptions?page=${page}`
    );
    return {
      inscriptions: (data.inscriptions || []).map((r) => mapInscription(r, this.baseUrl)),
      more: data.more || false,
    };
  }

  // ── Address ────────────────────────────────────────────────────────────────

  async getAddressInfo(address: string): Promise<IndexerAddressSummary> {
    const { data } = await this.http.get<RawAddressInfo>(`/address/${address}`);
    return {
      address: data.address,
      utxos: (data.outputs || []).map(mapOutput),
      inscriptions: (data.inscriptions || []).map((r) => mapInscription(r, this.baseUrl)),
      duneBalances: data.dunes_balances || {},
      inscriptionCount: data.inscription_count || 0,
      duneCount: data.dune_count || 0,
    };
  }

  /**
   * Returns only UTXOs that contain no inscriptions or Dune balances.
   * Safe to use for fee payment without risking asset destruction.
   */
  async getCardinalUTXOs(address: string): Promise<IndexerUTXO[]> {
    const { utxos } = await this.getAddressInfo(address);
    return utxos.filter((u) => u.isCardinal && !u.spent);
  }

  async getAddressInscriptions(address: string): Promise<Inscription[]> {
    const { inscriptions } = await this.getAddressInfo(address);
    return inscriptions;
  }

  async getAddressDuneBalances(address: string): Promise<Record<string, string>> {
    const { duneBalances } = await this.getAddressInfo(address);
    return duneBalances;
  }

  /**
   * POST /outputs — batch query for UTXO details.
   * More efficient than individual /output/{outpoint} calls.
   */
  async getOutputsBatch(outpoints: string[]): Promise<IndexerUTXO[]> {
    const { data } = await this.http.post<RawOutput[]>('/outputs', outpoints);
    return (data || []).map(mapOutput);
  }

  async getOutput(outpoint: string): Promise<IndexerUTXO> {
    const { data } = await this.http.get<RawOutput>(`/output/${outpoint}`);
    return mapOutput(data);
  }

  // ── Dunes ──────────────────────────────────────────────────────────────────

  async getDune(spacedDuneName: string): Promise<DuneInfo> {
    const { data } = await this.http.get<RawDune>(`/dune/${encodeURIComponent(spacedDuneName)}`);
    return mapDune(data);
  }

  /**
   * Look up a dune by its block:tx ID (e.g. "4600123:0").
   * The dog indexer /dune/{dune} endpoint accepts both names and IDs,
   * so we try the ID first, then fall back to a name search via /dunes.
   */
  async getDuneById(duneid: string): Promise<DuneInfo> {
    try {
      const { data } = await this.http.get<RawDune>(`/dune/${encodeURIComponent(duneid)}`);
      return mapDune(data);
    } catch {
      // Indexer may not support ID lookup — scan the first few pages for a match
      for (let page = 0; page < 5; page++) {
        const { dunes, more } = await this.getDunes(page);
        const match = dunes.find((d) => d.duneid === duneid);
        if (match) return match;
        if (!more) break;
      }
      throw new Error(`Dune not found: ${duneid}`);
    }
  }

  async getDunes(page = 0): Promise<{ dunes: DuneInfo[]; more: boolean }> {
    const { data } = await this.http.get<{ entries: Array<[string, RawDune]>; more: boolean }>(
      `/dunes?page=${page}`
    );
    return {
      dunes: (data.entries || []).map(([, d]) => mapDune(d)),
      more: data.more || false,
    };
  }

  /**
   * Build DuneBalance[] for a wallet address by merging address dune balances
   * with dune metadata from individual /dune/{name} lookups.
   */
  async getAddressDuneBalancesFull(address: string): Promise<DuneBalance[]> {
    const rawBalances = await this.getAddressDuneBalances(address);
    const entries = Object.entries(rawBalances);
    if (entries.length === 0) return [];

    const results = await Promise.allSettled(
      entries.map(async ([spacedDune, amount]) => {
        let info: DuneInfo | null = null;
        try {
          info = await this.getDune(spacedDune);
        } catch {
          // Dune metadata unavailable; return partial data
        }
        const balance: DuneBalance = {
          duneid: info?.duneid || spacedDune,
          dune: info?.dune || spacedDune.replace(/[•]/g, ''),
          spacedDune,
          symbol: info?.symbol || '',
          divisibility: info?.divisibility ?? 0,
          amount,
        };
        return balance;
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<DuneBalance> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  // ── DNS (.doge names) ──────────────────────────────────────────────────────

  /**
   * Resolve a .doge name to an address.
   * Tries GET /dns/{name} first; falls back to searching inscriptions
   * with metaprotocol=dns and parsing their content.
   */
  async resolveDNS(name: string): Promise<IndexerDNSRecord | null> {
    const normalised = name.trim().toLowerCase();

    // Attempt dedicated /dns/ endpoint (may exist depending on dog server version)
    try {
      const { data } = await this.http.get<RawDNSEntry>(`/dns/${encodeURIComponent(normalised)}`);
      return {
        name: data.name,
        address: data.config.address || null,
        ownerInscriptionId: data.owner_inscription_id,
        height: data.height,
        timestamp: data.timestamp,
        url: data.config.url,
        avatar: data.config.avatar,
        content: data.config.content,
      };
    } catch {
      // Fall through to inscription-search fallback
    }

    // Fallback: search for inscription with metaprotocol=dns whose content
    // declares this name.  The dog indexer exposes content at /r/content/{id}.
    // We scan the first page of inscriptions filtered by metaprotocol.
    try {
      const { data } = await this.http.post<RawInscription[]>('/inscriptions', {
        metaprotocol: 'dns',
      });

      for (const raw of data || []) {
        try {
          const contentRes = await this.http.get<string>(`/r/content/${raw.id}`, {
            headers: { Accept: 'application/json, text/plain' },
          });
          let parsed: any;
          if (typeof contentRes.data === 'string') {
            parsed = JSON.parse(contentRes.data);
          } else {
            parsed = contentRes.data;
          }
          const recordName = (parsed.name || '').trim().toLowerCase();
          if (recordName === normalised) {
            return {
              name: recordName,
              address: parsed.address || null,
              ownerInscriptionId: raw.id,
              height: raw.height,
              timestamp: raw.timestamp,
              url: parsed.url,
              avatar: parsed.avatar,
              content: parsed.content,
            };
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Indexer doesn't support inscription filtering by metaprotocol
    }

    return null;
  }

  // ── Dogemaps ───────────────────────────────────────────────────────────────

  async getDogemapEntry(blockNumber: number): Promise<IndexerDogemapEntry> {
    const { data } = await this.http.get<RawDogemapEntry>(`/dogemap/${blockNumber}`);
    return mapDogemap(data);
  }

  async getDogemaps(page = 0): Promise<{ entries: IndexerDogemapEntry[]; more: boolean }> {
    const { data } = await this.http.get<{ entries: RawDogemapEntry[]; more: boolean }>(
      `/dogemaps?page=${page}`
    );
    return {
      entries: (data.entries || []).map(mapDogemap),
      more: data.more || false,
    };
  }

  /**
   * Returns all Dogemap blocks claimed by a given address.
   *
   * Bitmap/Dogemap spec: the inscription content is plain text with the exact
   * format "{blockNumber}.dogemap" (e.g. "5000000.dogemap").  Content-type must
   * be text/plain.  The block number must have been ≤ the chain tip at the time
   * the inscription landed — the indexer enforces this and marks void claims as
   * unclaimed, so we trust entry.claimed / entry.ownerInscriptionId from the
   * indexer as the source of truth.
   */
  async getAddressDogemaps(address: string): Promise<IndexerDogemapEntry[]> {
    // Bitmap spec: text/plain, content matches /^\d+\.dogemap$/, length < 20
    const DOGEMAP_PATTERN = /^(\d+)\.dogemap$/;

    const inscriptions = await this.getAddressInscriptions(address);
    const results: IndexerDogemapEntry[] = [];

    for (const ins of inscriptions) {
      // Must be plain text
      if (!ins.contentType?.includes('text/plain')) continue;

      try {
        const contentRes = await this.http.get<string>(`/r/content/${ins.inscriptionId}`);
        const content = (typeof contentRes.data === 'string' ? contentRes.data : '').trim();

        // Strict format check — same regex used in DogemapsTab client-side filter
        if (content.length >= 20) continue;
        const match = content.match(DOGEMAP_PATTERN);
        if (!match) continue;

        const blockNum = parseInt(match[1], 10);
        const entry = await this.getDogemapEntry(blockNum);
        results.push(entry);
      } catch {
        continue;
      }
    }

    return results;
  }

  // ── Blocks & Transactions ──────────────────────────────────────────────────

  async getBlock(heightOrHash: number | string): Promise<RawBlock> {
    const { data } = await this.http.get<RawBlock>(`/block/${heightOrHash}`);
    return data;
  }

  async getCurrentBlockHeight(): Promise<number> {
    const { data } = await this.http.get<string>('/r/blockheight');
    return parseInt(data, 10);
  }

  async getTransaction(txid: string): Promise<RawTransaction> {
    const { data } = await this.http.get<RawTransaction>(`/r/tx/${txid}`);
    return data;
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  /** Check whether the indexer is reachable at all. */
  async ping(): Promise<boolean> {
    try {
      await this.http.get('/health', { timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Expose the raw axios instance for one-off requests. */
  get raw(): AxiosInstance {
    return this.http;
  }
}

// ─── Factory & Singleton ──────────────────────────────────────────────────────

let _defaultClient: DogIndexerClient | null = null;

/**
 * Returns the shared default DogIndexerClient instance.
 * The base URL is read from DOG_INDEXER_URL env var or defaults to localhost:8080.
 */
export function getDogIndexerClient(): DogIndexerClient {
  if (!_defaultClient) {
    const url = process.env.DOG_INDEXER_URL || DEFAULT_INDEXER_URL;
    _defaultClient = new DogIndexerClient(url);
  }
  return _defaultClient;
}

/**
 * Reconfigure the shared client (e.g., when user changes indexer URL in settings).
 */
export function setDogIndexerUrl(url: string): void {
  _defaultClient = new DogIndexerClient(url);
}

// ─── Provider-style helpers (matches the pattern in tatum.ts) ──────────────

export const isDogIndexerClient = (client: AxiosInstance): boolean =>
  !!client.defaults.baseURL &&
  (client.defaults.baseURL.includes('localhost:8080') ||
    client.defaults.baseURL.includes('dog-indexer') ||
    client.defaults.baseURL.includes(process.env.DOG_INDEXER_URL || '__never__'));

export const dogIndexerGetAddressInscriptions = async (
  address: string
): Promise<Inscription[]> => getDogIndexerClient().getAddressInscriptions(address);

export const dogIndexerGetDuneBalances = async (
  address: string
): Promise<DuneBalance[]> => getDogIndexerClient().getAddressDuneBalancesFull(address);

export const dogIndexerGetCardinalUTXOs = async (
  address: string
): Promise<IndexerUTXO[]> => getDogIndexerClient().getCardinalUTXOs(address);

export const dogIndexerResolveDNS = async (
  name: string
): Promise<IndexerDNSRecord | null> => getDogIndexerClient().resolveDNS(name);

export const dogIndexerHealth = async (): Promise<IndexerHealthStatus> =>
  getDogIndexerClient().health();
