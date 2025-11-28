import { eccManager } from '@unisat/wallet-bitcoin';
import logger from 'loglevel';

import { dogecoinMainnet, getDogecoinNetwork } from '@/shared/lib/dogecoin-network';
import { t } from '@unisat/i18n';
import { KeyringService, MemoryStorageAdapter } from '@unisat/keyring-service';
import { KeyringServiceConfig } from '@unisat/keyring-service/types';
import preferenceService from './preference';

/**
 * KeyringService wrapper - similar to the extension but for testing
 * Extends the base KeyringService with extension-like functionality
 */
export class KeyringServiceWrapper extends KeyringService {
  constructor() {
    const storage = new MemoryStorageAdapter();

    const config: KeyringServiceConfig = {
      storage,
      logger,
      t: t,
      network: dogecoinMainnet
    };

    super(config);
  }

  // Override init to ensure storage adapter is properly initialized
  async init(): Promise<void> {
    console.log('[KeyringService] Starting initialization...');

    // Call parent init
    console.log('[KeyringService] Calling parent init...');
    await super.init();

    console.log('[KeyringService] Initialization complete');
  }

  // Override createTmpKeyring to handle Dogecoin private keys correctly
  createTmpKeyring(type: string, privateKeys: string[]) {
    if (type === 'SimpleKeyring' && privateKeys && privateKeys.length > 0) {
      return this._createDogecoinSimpleKeyring(privateKeys[0]);
    }

    // For non-Dogecoin networks or other keyring types, use the default behavior
    return super.createTmpKeyring(type, privateKeys);
  }

  // Override importPrivateKey to handle Dogecoin private keys correctly
  async importPrivateKey(privateKey: string, addressType: string) {
    const chainType = preferenceService.getChainType();

    // Determine if this is a Dogecoin network
    const isDogecoin = chainType === 'BITCOIN_MAINNET' || chainType === 'BITCOIN_TESTNET' ||
                      chainType === 'BITCOIN_TESTNET4';

    if (isDogecoin) {
      return this._createDogecoinSimpleKeyring(privateKey);
    }

    // For non-Dogecoin networks, use the default behavior
    return super.importPrivateKey(privateKey, addressType);
  }

  // Helper method to create Dogecoin SimpleKeyring
  private _createDogecoinSimpleKeyring(privateKey: string) {
    const chainType = preferenceService.getChainType();

    try {
      const network = getDogecoinNetwork(chainType);

          let keyPair;
          // Check if it's a WIF (base58 encoded with version byte)
          // Accept any valid base58 string of typical WIF lengths
          const isWIF = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{51,52}$/.test(privateKey);

          if (isWIF) {
            try {
              // It's WIF — try to decode with Dogecoin network
              keyPair = eccManager.eccPair.fromWIF(privateKey, network);
            } catch (wifError) {
              // If Dogecoin network fails, the WIF might be from Bitcoin network
              // Try with Bitcoin network and re-encode for Dogecoin
              try {
                const bitcoinNetwork = { wif: 0x80, bip32: { public: 0x0488b21e, private: 0x0488ade4 } };
                const tempKeyPair = eccManager.eccPair.fromWIF(privateKey, bitcoinNetwork);
                // Convert the raw private key to Dogecoin WIF
                keyPair = eccManager.eccPair.fromPrivateKey(tempKeyPair.privateKey, { network });
              } catch (bitcoinError) {
                throw new Error('Invalid WIF format. Please ensure it\'s a valid Bitcoin or Dogecoin WIF.');
              }
            }
          } else if (/^[0-9a-fA-F]{64}$/.test(privateKey)) {
            // It's raw hex private key
            const privateKeyBuffer = Buffer.from(privateKey, 'hex');
            keyPair = eccManager.eccPair.fromPrivateKey(privateKeyBuffer, { network });
          } else {
            throw new Error('Invalid private key format. Please provide a WIF (starts with specific characters) or 64-character hex string.');
          }

      // Create a custom SimpleKeyring with the correct key
      const { SimpleKeyring } = require('@unisat/keyring-service');
      const keyring = new SimpleKeyring([keyPair.privateKey!.toString('hex')]);
      return keyring;
    } catch (e) {
      throw new Error('Invalid private key for Dogecoin network. Make sure you\'re using a valid Dogecoin private key (WIF starting with 7 on mainnet, c/d on test networks, or raw hex).');
    }
  }

}

export const keyringService = new KeyringServiceWrapper();
export default keyringService;


