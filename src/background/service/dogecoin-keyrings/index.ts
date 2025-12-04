/**
 * Dojak Wallet - Dogecoin Native Keyrings
 * 
 * Purpose-built Dogecoin keyring implementations using bitcore-lib-doge
 * for correct address derivation, WIF encoding, and message signing.
 */

export { DogecoinHdKeyring } from './dogecoin-hd-keyring';
export { DogecoinSimpleKeyring } from './dogecoin-simple-keyring';
export {
  DogecoinKeyringService,
  MemoryStorageAdapter,
} from './dogecoin-keyring-service';
export type {
  StorageAdapter,
  DisplayedKeyring,
  DogecoinKeyringServiceConfig,
} from './dogecoin-keyring-service';
export * from './types';

