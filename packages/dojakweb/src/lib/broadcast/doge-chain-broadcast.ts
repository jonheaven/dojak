/**
 * Facade for Dogecoin raw-tx broadcast + confirmation polling (file inscriptions, quantum, etc.).
 * Core relay + verification: `./dogecoinTxBroadcast.ts`. Prefer importing from this file in UIs so
 * stack traces read as chain broadcast, not “OP_RETURN-only”.
 */

export type {
  BroadcastAttemptUpdate,
  BroadcastConfig,
  DogeConfirmationReadSourceId,
  DogeConfirmationReadSourceRow,
  DogeTxVisibilitySource,
} from './dogecoinTxBroadcast';
export {
  broadcastTxWithStatus,
  pollTxForConfirmation,
  getBestDogeTxConfirmations,
  getConfirmationPollIntervalMs,
  getDogeConfirmationReadSourceRows,
  getDogeTxVisibilitySource,
  invalidateDogeTxConfirmationsCache,
  isDogeTxVisibleOnExplorers,
  preflightDogecoinRpcMempoolAccept,
  PROVIDER_LABELS,
  resolveCanonicalDogeTxidFromRelay,
  txidFromRawHex,
  waitForBroadcastPropagationVerified,
} from './dogecoinTxBroadcast';
