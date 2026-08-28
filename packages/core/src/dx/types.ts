export type DxActionType = 'tip' | 'link';

export type DxPendingAction = {
  type: DxActionType;
  handle: string;
  postId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: number;
  source: 'x.com';
};

export type DxRegistration = {
  xHandle: string;
  dogeAddress: string;
  txid?: string | null;
  tweetId?: string | null;
  tweetVerified?: boolean | null;
  tweetUrl?: string | null;
  height?: number;
  source?: string;
  linked?: boolean;
};

export type DxLookupKind = 'linked' | 'unlinked' | 'unreachable';

export type DxLookupResult = {
  kind: DxLookupKind;
  handle: string;
  registration: DxRegistration | null;
  dogeAddress?: string | null;
  payUri?: string | null;
  avatarUrl?: string | null;
  explorerTx?: string | null;
  stale?: boolean;
  error?: string;
};

export type DxVerifyTweetResult = {
  ok: boolean;
  tweetId?: string;
  username?: string;
  via?: string;
  error?: string;
};

export const DX_MESSAGE = {
  LOOKUP_HANDLE: 'DX_LOOKUP_HANDLE',
  LOOKUP_ADDRESS: 'DX_LOOKUP_ADDRESS',
  LOOKUP_BATCH: 'DX_LOOKUP_BATCH',
  VERIFY_TWEET: 'DX_VERIFY_TWEET',
  OPEN_ACTION: 'DX_OPEN_ACTION',
  GET_PENDING: 'DX_GET_PENDING',
  CLEAR_PENDING: 'DX_CLEAR_PENDING',
  RECORD_TIP_INTENT: 'DX_RECORD_TIP_INTENT'
} as const;

export type DxMessageType = (typeof DX_MESSAGE)[keyof typeof DX_MESSAGE];

export const DX_PENDING_STORAGE_KEY = 'dojak.dx.pending';
export const DX_PENDING_CHANGED = 'DX_PENDING_CHANGED';
export const DX_CACHE_TTL_MS = 60_000;
export const DX_CACHE_STALE_MS = 30 * 60_000;
export const DX_LOOKUP_TIMEOUT_MS = 8_000;
