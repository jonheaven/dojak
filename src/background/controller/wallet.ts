import { PsbtInput } from 'bip174/src/lib/interfaces';
import { tapleafHash } from 'bitcoinjs-lib/src/payments/bip341';
import { pubkeyInScript } from 'bitcoinjs-lib/src/psbt/psbtutils';
import bitcore from 'bitcore-lib';

import {
  contactBookService,
  keyringService,
  notificationService,
  permissionService,
  preferenceService,
  sessionService,
  walletApiService
} from '@/background/service';
import { psbtFromString } from '@/background/utils/psbt-utils';
import {
  ADDRESS_TYPES,
  AddressFlagType,
  AUTO_LOCK_TIMES,
  BRAND_ALIAN_TYPE_TEXT,
  CHAINS_MAP,
  COIN_NAME,
  COIN_SYMBOL,
  DEFAULT_LOCKTIME_ID,
  EVENTS,
  KEYRING_TYPES,
  NETWORK_TYPES
} from '@/shared/constant';
import eventBus from '@/shared/eventBus';
import { getDogecoinNetwork } from '@/shared/lib/dogecoin-network';
import { dunestone } from '@/shared/lib/dunestone';
import { dunesUtils } from '@/shared/lib/dunes-utils';
import {
  Account,
  AddressUserToSignInput,
  BitcoinBalance,
  DRC20HistoryItem,
  NetworkType,
  PublicKeyUserToSignInput,
  SignPsbtOptions,
  UTXO,
  WalletKeyring
} from '@/shared/types';
import { getChainInfo } from '@/shared/utils';
import { dogecoinPublicKeyToAddress } from '@/ui/utils/bitcoin-utils';
import { ColdWalletKeyring, KeystoneKeyring } from '@unisat/keyring-service';
import { DisplayedKeyring, Keyring, KeyringType, ToSignInput } from '@unisat/keyring-service/types';
import * as txHelpers from '@unisat/tx-helpers';
import { signMessageOfBIP322Simple, UnspentOutput } from '@unisat/tx-helpers';
import { CAT_VERSION } from '@unisat/wallet-api';
import {
  bitcoin,
  eccManager,
  genPsbtOfBIP322Simple,
  getSignatureFromPsbtOfBIP322Simple,
  isValidAddress,
  publicKeyToAddress,
  scriptPkToAddress,
  toXOnly
} from '@unisat/wallet-bitcoin';
import { AddressType, ChainType } from '@unisat/wallet-types';

import { ContactBookItem } from '../service/contactBook';
import { ConnectedSite } from '../service/permission';
import BaseController from './base';

export type AccountAsset = {
  name: string;
  symbol: string;
  amount: string;
  value: string;
};

const caculateTapLeafHash = (input: PsbtInput, pubkey: Buffer) => {
  if (input.tapInternalKey && !input.tapLeafScript) {
    return [];
  }
  const tapLeafHashes = (input.tapLeafScript || [])
    .filter((tapLeaf) => pubkeyInScript(pubkey, tapLeaf.script))
    .map((tapLeaf) => {
      const hash = tapleafHash({
        output: tapLeaf.script,
        version: tapLeaf.leafVersion
      });
      return Object.assign({ hash }, tapLeaf);
    });

  return tapLeafHashes.map((each) => each.hash);
};

export class WalletController extends BaseController {
  timer: any = null;

  constructor(opts: any) {
    super(opts);
  }

  // Override publicKeyToAddress calls for Dogecoin networks
  private dogecoinAwarePublicKeyToAddress(publicKey: string, addressType: AddressType, networkType: NetworkType) {
    // Check if we're on Dogecoin network
    const chainType = this.getChainType();
    const isDogecoin = chainType === ChainType.BITCOIN_MAINNET || chainType === ChainType.BITCOIN_TESTNET;

    if (isDogecoin && addressType === AddressType.P2PKH) {
      // Use our Dogecoin-aware address generation
      return dogecoinPublicKeyToAddress(publicKey, addressType, networkType);
    }

    // Fall back to original unisat function for other networks/chains
    return publicKeyToAddress(publicKey, addressType, networkType);
  }

  /* wallet */
  boot = async (password: string) => {
    console.log('[WalletController] boot() called');
    const result = await keyringService.boot(password);
    console.log('[WalletController] boot() completed, isBooted:', keyringService.isBooted());
    return result;
  };
  isBooted = () => keyringService.isBooted();

  getApproval = notificationService.getApproval;
  resolveApproval = notificationService.resolveApproval;
  rejectApproval = notificationService.rejectApproval;

  hasVault = () => keyringService.hasVault();
  verifyPassword = (password: string) => keyringService.verifyPassword(password);
  changePassword = (password: string, newPassword: string) => keyringService.changePassword(password, newPassword);

  initAlianNames = async () => {
    preferenceService.changeInitAlianNameStatus();
  };

  isReady = () => {
    return true;
  };

  unlock = async (password: string) => {
    const alianNameInited = preferenceService.getInitAlianNameStatus();
    const alianNames = contactBookService.listAlias();
    await keyringService.submitPassword(password);
    sessionService.broadcastEvent('unlock');
    if (!alianNameInited && alianNames.length === 0) {
      this.initAlianNames();
    }

    this._resetTimeout();
  };
  isUnlocked = () => {
    return keyringService.memStore.getState().isUnlocked;
  };

  lockWallet = async () => {
    await keyringService.setLocked();
    sessionService.broadcastEvent('accountsChanged', []);
    sessionService.broadcastEvent('lock');
    eventBus.emit(EVENTS.broadcastToUI, {
      method: 'lock',
      params: {}
    });
  };

  setPopupOpen = (isOpen: boolean) => {
    preferenceService.setPopupOpen(isOpen);
  };

  getAddressBalance = async (address: string) => {
    const data = await walletApiService.bitcoin.getAddressBalance(address);
    preferenceService.updateAddressBalance(address, data);
    return data;
  };

  getAddressBalanceV2 = async (address: string) => {
    const data = await walletApiService.bitcoin.getAddressBalanceV2(address);
    return data;
  };

  getMultiAddressAssets = async (addresses: string) => {
    return walletApiService.bitcoin.getMultiAddressAssets(addresses);
  };

  findGroupAssets = (groups: { type: number; address_arr: string[]; pubkey_arr: string[] }[]) => {
    return walletApiService.bitcoin.findGroupAssets(groups);
  };

  getAddressCacheBalance = (address: string | undefined): BitcoinBalance => {
    const defaultBalance: BitcoinBalance = {
      confirm_amount: '0',
      pending_amount: '0',
      amount: '0',
      usd_value: '0',
      confirm_btc_amount: '0',
      pending_btc_amount: '0',
      btc_amount: '0',
      confirm_inscription_amount: '0',
      pending_inscription_amount: '0',
      inscription_amount: '0'
    };
    if (!address) return defaultBalance;
    return preferenceService.getAddressBalance(address) || defaultBalance;
  };

  getAddressHistory = async (params: { address: string; start: number; limit: number }) => {
    const data = await walletApiService.bitcoin.getAddressRecentHistory(params);
    // preferenceService.updateAddressHistory(address, data);
    // return data;
    //   todo
    return data;
  };

  getAddressInscriptions = async (address: string, cursor: number, size: number) => {
    const data = await walletApiService.inscriptions.getAddressInscriptions(address, cursor, size);
    return data;
  };

  getAddressCacheHistory = (address: string | undefined) => {
    if (!address) return [];
    return preferenceService.getAddressHistory(address);
  };

  getExternalLinkAck = () => {
    preferenceService.getExternalLinkAck();
  };

  setExternalLinkAck = (ack) => {
    preferenceService.setExternalLinkAck(ack);
  };

  getLocale = () => {
    return preferenceService.getLocale();
  };

  setLocale = (locale: string) => {
    preferenceService.setLocale(locale);
  };

  getCurrency = () => {
    return preferenceService.getCurrency();
  };

  setCurrency = (currency: string) => {
    preferenceService.setCurrency(currency);
  };

  /* keyrings */

  clearKeyrings = () => keyringService.clearKeyrings();

  getPrivateKey = async (password: string, { pubkey, type }: { pubkey: string; type: string }) => {
    await this.verifyPassword(password);
    const keyring = await keyringService.getKeyringForAccount(pubkey, type);
    if (!keyring) return null;
    const privateKey = await keyring.exportAccount(pubkey);
    const networkType = this.getNetworkType();
    const network = getDogecoinNetwork(networkType);
    const hex = privateKey;
    const wif = eccManager.eccPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network }).toWIF();
    return {
      hex,
      wif
    };
  };

  getMnemonics = async (password: string, keyring: WalletKeyring) => {
    await this.verifyPassword(password);
    const originKeyring = keyringService.keyrings[keyring.index];
    const serialized = await originKeyring.serialize();
    return {
      mnemonic: serialized.mnemonic,
      hdPath: serialized.hdPath,
      passphrase: serialized.passphrase
    };
  };

  createKeyringWithPrivateKey = async (data: string, addressType: AddressType, alianName?: string) => {
    let originKeyring: Keyring;
    try {
      originKeyring = await keyringService.importPrivateKey(data, addressType);
    } catch (e) {
      console.log(e);
      throw e;
    }

    const displayedKeyring = await keyringService.displayForKeyring(
      originKeyring,
      addressType,
      keyringService.keyrings.length - 1
    );
    const keyring = this.displayedKeyringToWalletKeyring(displayedKeyring, keyringService.keyrings.length - 1);
    await this.changeKeyring(keyring);
  };

  getPreMnemonics = () => keyringService.getPreMnemonics();
  generatePreMnemonic = async () => {
    console.log('[WalletController] generatePreMnemonic() called');
    console.log('[WalletController] isBooted:', keyringService.isBooted());
    console.log('[WalletController] password set:', !!(keyringService as any).password);
    const result = await keyringService.generatePreMnemonic();
    console.log('[WalletController] generatePreMnemonic() completed, length:', result.length);
    return result;
  };
  removePreMnemonics = () => keyringService.removePreMnemonics();
  createKeyringWithMnemonics = async (
    mnemonic: string,
    hdPath: string,
    passphrase: string,
    addressType: AddressType,
    accountCount: number
  ) => {
    const originKeyring = await keyringService.createKeyringWithMnemonics(
      mnemonic,
      hdPath,
      passphrase,
      addressType,
      accountCount
    );
    keyringService.removePreMnemonics();

    const displayedKeyring = await keyringService.displayForKeyring(
      originKeyring,
      addressType,
      keyringService.keyrings.length - 1
    );
    const keyring = this.displayedKeyringToWalletKeyring(displayedKeyring, keyringService.keyrings.length - 1);
    await this.changeKeyring(keyring);
  };

  createTmpKeyringWithMnemonics = async (
    mnemonic: string,
    hdPath: string,
    passphrase: string,
    addressType: AddressType,
    accountCount = 1
  ) => {
    const activeIndexes: number[] = [];
    for (let i = 0; i < accountCount; i++) {
      activeIndexes.push(i);
    }
    const originKeyring = keyringService.createTmpKeyring('HD Key Tree', {
      mnemonic,
      activeIndexes,
      hdPath,
      passphrase
    });
    const displayedKeyring = await keyringService.displayForKeyring(originKeyring, addressType, -1);
    return this.displayedKeyringToWalletKeyring(displayedKeyring, -1, false);
  };

  createTmpKeyringWithPrivateKey = async (privateKey: string, addressType: AddressType) => {
    const originKeyring = keyringService.createTmpKeyring(KeyringType.SimpleKeyring, [privateKey]);
    const displayedKeyring = await keyringService.displayForKeyring(originKeyring, addressType, -1);
    preferenceService.setShowSafeNotice(false);
    return this.displayedKeyringToWalletKeyring(displayedKeyring, -1, false);
  };

  createTmpKeyringWithKeystone = async (
    urType: string,
    urCbor: string,
    addressType: AddressType,
    hdPath: string,
    accountCount: number
  ) => {
    const tmpKeyring = new KeystoneKeyring();
    await tmpKeyring.initFromUR(urType, urCbor);
    if (hdPath.length >= 13) {
      tmpKeyring.changeChangeAddressHdPath(hdPath);
      tmpKeyring.addAccounts(accountCount);
    } else {
      tmpKeyring.changeHdPath(ADDRESS_TYPES[addressType].hdPath);
      accountCount && tmpKeyring.addAccounts(accountCount);
    }

    const opts = await tmpKeyring.serialize();
    const originKeyring = keyringService.createTmpKeyring(KeyringType.KeystoneKeyring, opts);
    const displayedKeyring = await keyringService.displayForKeyring(originKeyring, addressType, -1);
    preferenceService.setShowSafeNotice(false);
    return this.displayedKeyringToWalletKeyring(displayedKeyring, -1, false);
  };

  createKeyringWithKeystone = async (
    urType: string,
    urCbor: string,
    addressType: AddressType,
    hdPath: string,
    accountCount = 1,
    filterPubkey: string[] = [],
    connectionType: 'USB' | 'QR' = 'USB'
  ) => {
    const originKeyring = await keyringService.createKeyringWithKeystone(
      urType,
      urCbor,
      addressType,
      hdPath,
      accountCount,
      connectionType
    );

    if (filterPubkey !== null && filterPubkey !== undefined && filterPubkey.length > 0) {
      const accounts = await originKeyring.getAccounts();
      accounts.forEach((account) => {
        if (!filterPubkey.includes(account)) {
          originKeyring.removeAccount(account);
        }
      });
    }
    const account = await originKeyring.getAccounts();
    const displayedKeyring = await keyringService.displayForKeyring(
      originKeyring,
      addressType,
      keyringService.keyrings.length - 1
    );
    const keyring = this.displayedKeyringToWalletKeyring(displayedKeyring, keyringService.keyrings.length - 1);
    this.changeKeyring(keyring);
    preferenceService.setShowSafeNotice(false);
  };

  createKeyringWithColdWallet = async (
    xpub: string,
    addressType: AddressType,
    alianName?: string,
    hdPath?: string,
    accountCount = 1
  ) => {
    const accounts = await this.deriveAccountsFromXpub(xpub, addressType, hdPath, accountCount);
    const addresses = accounts.map((acc) => acc.address);
    const publicKeys = accounts.map((acc) => acc.pubkey);

    const coldWalletKeyring = new ColdWalletKeyring({
      xpub,
      addresses,
      connectionType: 'QR',
      hdPath,
      publicKeys
    });

    const originKeyring = await keyringService.addKeyring(coldWalletKeyring, addressType);
    const displayedKeyring = await keyringService.displayForKeyring(
      originKeyring,
      addressType,
      keyringService.keyrings.length - 1
    );

    const keyring = this.displayedKeyringToWalletKeyring(displayedKeyring, keyringService.keyrings.length - 1);

    if (alianName) {
      this.setKeyringAlianName(keyring, alianName);
    }

    this.changeKeyring(keyring);
    preferenceService.setShowSafeNotice(false);

    return keyring;
  };

  /**
   * Derive accounts from extended public key (receive chain level only)
   * For paths like m/84'/0'/0'/0, derives m/84'/0'/0'/0/i addresses
   */
  deriveAccountsFromXpub = async (
    xpub: string,
    addressType: AddressType,
    hdPath?: string,
    accountCount = 1
  ): Promise<{ pubkey: string; address: string }[]> => {
    // Validate xpub format
    const validPrefixes = ['xpub', 'tpub', 'ypub', 'zpub'];
    if (!validPrefixes.some((prefix) => xpub?.startsWith(prefix))) {
      throw new Error('Invalid xpub format');
    }

    const hdPublicKey = new bitcore.HDPublicKey(xpub);
    const networkType = this.getNetworkType();
    const accounts: { pubkey: string; address: string }[] = [];

    // Derive addresses: m/84'/0'/0'/0/i
    for (let i = 0; i < accountCount; i++) {
      const addressKey = hdPublicKey.deriveChild(i);
      const publicKeyHex = addressKey.publicKey.toString('hex');
      const address = this.dogecoinAwarePublicKeyToAddress(publicKeyHex, addressType, networkType);
      accounts.push({ pubkey: publicKeyHex, address });
    }

    return accounts;
  };

  removeKeyring = async (keyring: WalletKeyring) => {
    await keyringService.removeKeyring(keyring.index);
    const keyrings = await this.getKeyrings();
    const nextKeyring = keyrings[keyrings.length - 1];
    if (nextKeyring && nextKeyring.accounts[0]) {
      this.changeKeyring(nextKeyring);
      return nextKeyring;
    }
  };

  getKeyringByType = (type: string) => {
    return keyringService.getKeyringByType(type);
  };

  deriveNewAccountFromMnemonic = async (keyring: WalletKeyring, alianName?: string) => {
    const _keyring = keyringService.keyrings[keyring.index];
    await keyringService.addNewAccount(_keyring);

    const currentKeyring = await this.getCurrentKeyring();
    if (!currentKeyring) throw new Error('no current keyring');
    keyring = currentKeyring;
    this.changeKeyring(keyring, keyring.accounts.length - 1);

    if (alianName) {
      const account = preferenceService.getCurrentAccount() as Account;
      preferenceService.setAccountAlianName(account.key, alianName);
      account.alianName = alianName;
    }
  };

  getAccountsCount = async () => {
    const accounts = await keyringService.getAccounts();
    return accounts.filter((x) => x).length;
  };

  changeKeyring = async (keyring: WalletKeyring, accountIndex = 0) => {
    preferenceService.setCurrentKeyringIndex(keyring.index);
    preferenceService.setCurrentAccount(keyring.accounts[accountIndex]);
    const flag = preferenceService.getAddressFlag(keyring.accounts[accountIndex].address);
    walletApiService.setClientAddress(keyring.accounts[accountIndex].address, flag);
  };

  getAllAddresses = (keyring: WalletKeyring, index: number) => {
    const networkType = this.getNetworkType();
    const addresses: string[] = [];
    const _keyring = keyringService.keyrings[keyring.index];
    if (keyring.type === KeyringType.HdKeyring || keyring.type === KeyringType.KeystoneKeyring) {
      const pathPubkey: { [path: string]: string } = {};
      ADDRESS_TYPES.filter((v) => v.displayIndex >= 0).forEach((v) => {
        let pubkey = pathPubkey[v.hdPath];
        if (!pubkey && _keyring.getAccountByHdPath) {
          pubkey = _keyring.getAccountByHdPath(v.hdPath, index);
        }
        const address = this.dogecoinAwarePublicKeyToAddress(pubkey, v.value, networkType);
        addresses.push(address);
      });
    } else {
      ADDRESS_TYPES.filter((v) => v.displayIndex >= 0 && v.isdojakLegacy === false).forEach((v) => {
        const pubkey = keyring.accounts[index].pubkey;
        const address = this.dogecoinAwarePublicKeyToAddress(pubkey, v.value, networkType);
        addresses.push(address);
      });
    }
    return addresses;
  };

  changeAddressType = async (addressType: AddressType) => {
    const currentAccount = await this.getCurrentAccount();
    const currentKeyringIndex = preferenceService.getCurrentKeyringIndex();
    await keyringService.changeAddressType(currentKeyringIndex, addressType);
    const keyring = await this.getCurrentKeyring();
    if (!keyring) throw new Error('no current keyring');
    this.changeKeyring(keyring, currentAccount?.index);
  };

  formatOptionsToSignInputs = async (_psbt: string | bitcoin.Psbt, options?: SignPsbtOptions) => {
    const account = await this.getCurrentAccount();
    if (!account) throw null;

    let toSignInputs: ToSignInput[] = [];
    if (options && options.toSignInputs) {
      // We expect userToSignInputs objects to be similar to ToSignInput interface,
      // but we allow address to be specified in addition to publicKey for convenience.
      toSignInputs = options.toSignInputs.map((input) => {
        const index = Number(input.index);
        if (isNaN(index)) throw new Error('invalid index in toSignInput');

        if (!(input as AddressUserToSignInput).address && !(input as PublicKeyUserToSignInput).publicKey) {
          throw new Error('no address or public key in toSignInput');
        }

        if ((input as AddressUserToSignInput).address && (input as AddressUserToSignInput).address != account.address) {
          throw new Error('invalid address in toSignInput');
        }

        if (
          (input as PublicKeyUserToSignInput).publicKey &&
          (input as PublicKeyUserToSignInput).publicKey != account.pubkey
        ) {
          throw new Error('invalid public key in toSignInput');
        }

        const sighashTypes = input.sighashTypes?.map(Number);
        if (sighashTypes?.some(isNaN)) throw new Error('invalid sighash type in toSignInput');

        let tapLeafHashToSign: Buffer | undefined;
        if (input.tapLeafHashToSign) {
          if (typeof input.tapLeafHashToSign === 'string') {
            tapLeafHashToSign = Buffer.from(input.tapLeafHashToSign, 'hex');
          } else {
            tapLeafHashToSign = input.tapLeafHashToSign;
          }
        }
        return {
          index,
          publicKey: account.pubkey,
          sighashTypes,
          useTweakedSigner: input.useTweakedSigner,
          disableTweakSigner: input.disableTweakSigner,
          tapLeafHashToSign
        };
      });
    } else {
      const networkType = this.getNetworkType();
      const psbtNetwork = getDogecoinNetwork(networkType);

      const psbt =
        typeof _psbt === 'string'
          ? bitcoin.Psbt.fromHex(_psbt as string, { network: psbtNetwork })
          : (_psbt as bitcoin.Psbt);
      psbt.data.inputs.forEach((v, index) => {
        let script: any = null;
        let value = 0;
        if (v.witnessUtxo) {
          script = v.witnessUtxo.script;
          value = v.witnessUtxo.value;
        } else if (v.nonWitnessUtxo) {
          const tx = bitcoin.Transaction.fromBuffer(v.nonWitnessUtxo);
          const output = tx.outs[psbt.txInputs[index].index];
          script = output.script;
          value = output.value;
        }
        const isSigned = v.finalScriptSig || v.finalScriptWitness || v.tapKeySig || v.partialSig || v.tapScriptSig;
        if (script && !isSigned) {
          const address = scriptPkToAddress(script, networkType);
          if (account.address === address) {
            toSignInputs.push({
              index,
              publicKey: account.pubkey,
              sighashTypes: v.sighashType ? [v.sighashType] : undefined
            });
          }
        }
      });

      if (toSignInputs.length === 0) {
        psbt.data.inputs.forEach((input, index) => {
          // if no toSignInputs, sign all inputs
          toSignInputs.push({
            index: index,
            publicKey: account.pubkey
          });
        });
      }
    }

    return toSignInputs;
  };

  signPsbt = async (psbt: bitcoin.Psbt, toSignInputs: ToSignInput[], autoFinalized: boolean) => {
    const account = await this.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const keyring = await this.getCurrentKeyring();
    if (!keyring) throw new Error('no current keyring');
    const _keyring = keyringService.keyrings[keyring.index];

    const chainType = this.getChainType();
    const psbtNetwork = getDogecoinNetwork(chainType);

    if (!toSignInputs) {
      // Compatibility with legacy code.
      toSignInputs = await this.formatOptionsToSignInputs(psbt);
      if (autoFinalized !== false) autoFinalized = true;
    }

    const isKeystone = keyring.type === KeyringType.KeystoneKeyring;
    const isColdWallet = keyring.type === KeyringType.ColdWalletKeyring;
    let bip32Derivation: any = undefined;

    if (isKeystone) {
      if (!_keyring.mfp) {
        throw new Error('no mfp in keyring');
      }
      bip32Derivation = {
        masterFingerprint: Buffer.from(_keyring.mfp as string, 'hex'),
        path: `${keyring.hdPath}/${account.index}`,
        pubkey: Buffer.from(account.pubkey, 'hex')
      };

      const chainType = this.getChainType();
      const chain = CHAINS_MAP[chainType];

      // use the unknown keyValue to indicate FB tx in psbt for keystone
      if (chain.isFractal && account.type === KeyringType.KeystoneKeyring) {
        const keysString = 'chain';
        // use ff as the keyType in the psbt global unknown
        const key = Buffer.from('ff' + Buffer.from(keysString).toString('hex'), 'hex');
        psbt.addUnknownKeyValToGlobal({ key, value: Buffer.from(chain.unit.toLowerCase()) });
      }
    }

    psbt.data.inputs.forEach((input, index) => {
      const isSigned =
        input.finalScriptSig || input.finalScriptWitness || input.tapKeySig || input.partialSig || input.tapScriptSig;
      if (isSigned) {
        return;
      }

      const isToBeSigned = toSignInputs.some((v) => v.index === index);
      if (!isToBeSigned) {
        return;
      }

      let isP2TR = false;
      try {
        bitcoin.payments.p2tr({ output: input.witnessUtxo?.script, network: psbtNetwork });
        isP2TR = true;
      } catch (e) {
        // skip
      }

      if (isP2TR) {
        // fix p2tr input data
        let isKeyPathP2TR = false;

        try {
          const originXPubkey = toXOnly(Buffer.from(account.pubkey, 'hex')).toString('hex');
          const tapInternalKey = toXOnly(Buffer.from(account.pubkey, 'hex'));
          const { output } = bitcoin.payments.p2tr({
            internalPubkey: tapInternalKey,
            network: psbtNetwork
          });
          if (input.witnessUtxo?.script.toString('hex') == output?.toString('hex')) {
            isKeyPathP2TR = true;
          }
          if (isKeyPathP2TR) {
            input.tapInternalKey = tapInternalKey;
          } else {
            // only keypath p2tr can have tapInternalKey
            delete input.tapInternalKey;
          }

          if (isKeyPathP2TR) {
            // keypath p2tr should be signed with origin signer
          } else {
            const isToBeSigned: any = toSignInputs.find((v) => v.index === index);
            if (isToBeSigned.useTweakedSigner == undefined && isToBeSigned.disableTweakSigner == undefined) {
              if (input.tapLeafScript && input.tapLeafScript.length > 0) {
                const script = input.tapLeafScript[0].script.toString('hex');
                if (script.includes(originXPubkey)) {
                  // if tapLeafScript contains origin pubkey, use origin signer
                  isToBeSigned.useTweakedSigner = false;
                } else {
                  // if tapLeafScript not contains origin pubkey, use tweaked signer
                  isToBeSigned.useTweakedSigner = true;
                }
              } else {
                // if no tapLeafScript, use origin signer
                isToBeSigned.useTweakedSigner = false;
              }
            }
          }
        } catch (e) {
          // skip
        }
      }

      if (isKeystone) {
        if (isP2TR) {
          input.tapBip32Derivation = [
            {
              ...bip32Derivation,
              pubkey: bip32Derivation.pubkey.slice(1),
              leafHashes: caculateTapLeafHash(input, bip32Derivation.pubkey)
            }
          ];
        } else {
          input.bip32Derivation = [bip32Derivation];
        }
      }
    });

    // For Keystone and cold wallets, return the prepared PSBT without actual signing
    if (isKeystone || isColdWallet) {
      return psbt;
    }

    psbt = await keyringService.signTransaction(_keyring, psbt, toSignInputs as any);

    if (autoFinalized) {
      toSignInputs.forEach((v) => {
        // psbt.validateSignaturesOfInput(v.index, validator);
        psbt.finalizeInput(v.index);
      });
    }
    return psbt;
  };

  signPsbtWithHex = async (psbtHex: string, toSignInputs: ToSignInput[], autoFinalized: boolean) => {
    const psbt = psbtFromString(psbtHex);
    await this.signPsbt(psbt, toSignInputs, autoFinalized);
    return psbt.toHex();
  };

  signMessage = async (text: string) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');
    return keyringService.signMessage(account.pubkey, account.type, text);
  };

  signBIP322Simple = async (text: string) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');
    const networkType = this.getNetworkType();
    return signMessageOfBIP322Simple({
      message: text,
      address: account.address,
      networkType,
      wallet: this as any
    });
  };

  signData = async (data: string, type = 'ecdsa') => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');
    return keyringService.signData(account.pubkey, data, type);
  };

  addContact = (data: ContactBookItem) => {
    contactBookService.addContact(data);
  };

  updateContact = (data: ContactBookItem) => {
    contactBookService.updateContact(data);
  };

  getContactByAddress = (address: string) => {
    return contactBookService.getContactByAddress(address);
  };

  getContactByAddressAndChain = (address: string, chain: ChainType) => {
    return contactBookService.getContactByAddressAndChain(address, chain);
  };

  private _generateAlianName = (type: string, index: number) => {
    return `${BRAND_ALIAN_TYPE_TEXT[type]} ${index}`;
  };

  removeContact = (address: string, chain?: ChainType) => {
    if (chain) {
      contactBookService.removeContact(address, chain);
    } else {
      console.warn('removeContact called without chain parameter, using old method');
      const contact = contactBookService.getContactByAddress(address);
      if (contact) {
        contactBookService.removeContact(address, contact.chain);
      }
    }
  };

  listContact = (includeAlias = true) => {
    const list = contactBookService.listContacts();
    if (includeAlias) {
      return list;
    } else {
      return list.filter((item) => !item.isAlias);
    }
  };

  listContacts = () => {
    return contactBookService.listContacts();
  };

  saveContactsOrder = (contacts: ContactBookItem[]) => {
    return contactBookService.saveContactsOrder(contacts);
  };

  getContactsByMap = () => {
    return contactBookService.getContactsByMap();
  };

  getNextAlianName = (keyring: WalletKeyring) => {
    return this._generateAlianName(keyring.type, keyring.accounts.length + 1);
  };

  getHighlightWalletList = () => {
    return preferenceService.getWalletSavedList();
  };

  updateHighlightWalletList = (list) => {
    return preferenceService.updateWalletSavedList(list);
  };

  getAllAlianName = () => {
    return contactBookService.listAlias();
  };

  getInitAlianNameStatus = () => {
    return preferenceService.getInitAlianNameStatus();
  };

  updateInitAlianNameStatus = () => {
    preferenceService.changeInitAlianNameStatus();
  };

  getIsFirstOpen = () => {
    return preferenceService.getIsFirstOpen();
  };

  updateIsFirstOpen = () => {
    return preferenceService.updateIsFirstOpen();
  };

  listChainAssets = async (pubkeyAddress: string) => {
    const balance = await walletApiService.bitcoin.getAddressBalance(pubkeyAddress);
    const assets: AccountAsset[] = [
      { name: COIN_NAME, symbol: COIN_SYMBOL, amount: balance.amount, value: balance.usd_value }
    ];
    return assets;
  };

  reportErrors = (error: string) => {
    console.error('report not implemented');
  };

  getNetworkType = () => {
    const chainType = this.getChainType();
    return CHAINS_MAP[chainType].networkType;
  };

  setNetworkType = async (networkType: NetworkType) => {
    if (networkType === NetworkType.MAINNET) {
      this.setChainType(ChainType.BITCOIN_MAINNET);
    } else {
      this.setChainType(ChainType.BITCOIN_TESTNET);
    }
  };

  getNetworkName = () => {
    const networkType = this.getNetworkType();
    return NETWORK_TYPES[networkType].name;
  };

  getLegacyNetworkName = () => {
    const chainType = this.getChainType();
    if (
      chainType === ChainType.BITCOIN_MAINNET ||
      chainType === ChainType.BITCOIN_TESTNET ||
      chainType === ChainType.BITCOIN_TESTNET4
    ) {
      return NETWORK_TYPES[CHAINS_MAP[chainType].networkType].name;
    } else {
      return 'unknown';
    }
  };

  setChainType = async (chainType: ChainType) => {
    const currentChainType = preferenceService.getChainType();
    if (currentChainType === chainType) {
      return;
    }

    preferenceService.setChainType(chainType);

    // Update the dogecoin keyring service network type based on the new chain
    const networkType = CHAINS_MAP[chainType].networkType;
    const dogecoinNetwork = networkType === NetworkType.TESTNET ? 'testnet' : 'mainnet';
    keyringService.setNetworkType(dogecoinNetwork);

    walletApiService.setEndpoints(CHAINS_MAP[chainType].endpoints);

    const currentAccount = await this.getCurrentAccount();
    const keyring = await this.getCurrentKeyring();
    if (!keyring) throw new Error('no current keyring');
    this.changeKeyring(keyring, currentAccount?.index);

    const chainInfo = getChainInfo(chainType);
    sessionService.broadcastEvent('chainChanged', chainInfo);

    const network = this.getLegacyNetworkName();
    sessionService.broadcastEvent('networkChanged', {
      network
    });

    eventBus.emit(EVENTS.broadcastToUI, {
      method: 'chainChanged',
      params: {
        type: chainType
      }
    });
  };

  getChainType = () => {
    return preferenceService.getChainType();
  };

  getDOGEUtxos = async () => {
    // getDOGEAccount
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const utxos = await walletApiService.bitcoin.getDOGEUtxos(account.address);

    const btcUtxos = utxos.map((v) => {
      return {
        txid: v.txid,
        vout: v.vout,
        satoshis: v.satoshis,
        scriptPk: v.scriptPk,
        addressType: v.addressType,
        pubkey: account.pubkey,
        inscriptions: v.inscriptions,
        atomicals: []
      };
    });
    return btcUtxos;
  };

  sendDOGE = async ({
    to,
    amount,
    feeRate,
    enableRBF,
    btcUtxos,
    memo,
    memos
  }: {
    to: string;
    amount: number;
    feeRate: number;
    enableRBF: boolean;
    btcUtxos?: UnspentOutput[];
    memo?: string;
    memos?: string[];
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const networkType = this.getNetworkType();

    if (!btcUtxos) {
      btcUtxos = await this.getDOGEUtxos();
    }

    if (btcUtxos.length == 0) {
      throw new Error('Insufficient balance.');
    }

    if (!isValidAddress(to, networkType)) {
      throw new Error('Invalid address.');
    }

    // Stub implementation for sendDOGE - needs proper implementation
    const psbt = bitcoin.Psbt.fromHex(
      '020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01000000000000000000000000'
    );
    const toSignInputs: ToSignInput[] = [];

    return this.getSignedResult(psbt, toSignInputs);
  };

  sendAllDOGE = async ({
    to,
    feeRate,
    enableRBF,
    btcUtxos
  }: {
    to: string;
    feeRate: number;
    enableRBF: boolean;
    btcUtxos?: UnspentOutput[];
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const networkType = this.getNetworkType();

    if (!btcUtxos) {
      btcUtxos = await this.getDOGEUtxos();
    }

    if (btcUtxos.length == 0) {
      throw new Error('Insufficient balance.');
    }

    // Stub implementation for sendAllDOGE - needs proper implementation
    const psbt = bitcoin.Psbt.fromHex(
      '020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01000000000000000000000000'
    );
    const toSignInputs: ToSignInput[] = [];
    return this.getSignedResult(psbt, toSignInputs);
  };

  sendDoginalsInscription = async ({
    to,
    inscriptionId,
    feeRate,
    outputValue,
    enableRBF,
    btcUtxos
  }: {
    to: string;
    inscriptionId: string;
    feeRate: number;
    outputValue?: number;
    enableRBF: boolean;
    btcUtxos?: txHelpers.UnspentOutput[];
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const networkType = this.getNetworkType();

    const utxo = await walletApiService.inscriptions.getInscriptionUtxo(inscriptionId);
    if (!utxo) {
      throw new Error('UTXO not found.');
    }

    const assetUtxo = Object.assign(utxo, { pubkey: account.pubkey });

    if (!btcUtxos) {
      btcUtxos = await this.getDOGEUtxos();
    }

    if (btcUtxos.length == 0) {
      throw new Error('Insufficient balance.');
    }

    if (!outputValue) {
      outputValue = assetUtxo.satoshis;
    }

    const { psbt, toSignInputs } = await txHelpers.sendInscription({
      assetUtxo,
      btcUtxos,
      toAddress: to,
      networkType,
      changeAddress: account.address,
      feeRate,
      outputValue: outputValue || assetUtxo.satoshis,
      enableRBF,
      enableMixed: true
    });

    return this.getSignedResult(psbt, toSignInputs);
  };

  sendDoginalsInscriptions = async ({
    to,
    inscriptionIds,
    feeRate,
    enableRBF,
    btcUtxos
  }: {
    to: string;
    inscriptionIds: string[];
    utxos: UTXO[];
    feeRate: number;
    enableRBF: boolean;
    btcUtxos?: txHelpers.UnspentOutput[];
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const networkType = this.getNetworkType();

    const inscription_utxos = await walletApiService.inscriptions.getInscriptionUtxos(inscriptionIds);
    if (!inscription_utxos) {
      throw new Error('UTXO not found.');
    }

    if (inscription_utxos.find((v) => v.inscriptions.length > 1)) {
      throw new Error('Multiple inscriptions are mixed together. Please split them first.');
    }

    const assetUtxos = inscription_utxos.map((v) => {
      return Object.assign(v, { pubkey: account.pubkey });
    });

    const toDust = txHelpers.getAddressUtxoDust(to);

    assetUtxos.forEach((v) => {
      if (v.satoshis < toDust) {
        throw new Error('Unable to send inscriptions to this address in batches, please send them one by one.');
      }
    });

    if (!btcUtxos) {
      btcUtxos = await this.getDOGEUtxos();
    }

    if (btcUtxos.length == 0) {
      throw new Error('Insufficient balance.');
    }

    const { psbt, toSignInputs } = await txHelpers.sendInscriptions({
      assetUtxos,
      btcUtxos,
      toAddress: to,
      networkType,
      changeAddress: account.address,
      feeRate,
      enableRBF
    });

    return this.getSignedResult(psbt, toSignInputs);
  };

  splitDoginalsInscription = async ({
    inscriptionId,
    feeRate,
    outputValue,
    enableRBF,
    btcUtxos
  }: {
    to: string;
    inscriptionId: string;
    feeRate: number;
    outputValue: number;
    enableRBF: boolean;
    btcUtxos?: txHelpers.UnspentOutput[];
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const networkType = this.getNetworkType();

    const utxo = await walletApiService.inscriptions.getInscriptionUtxo(inscriptionId);
    if (!utxo) {
      throw new Error('UTXO not found.');
    }

    const assetUtxo = Object.assign(utxo, { pubkey: account.pubkey });

    if (!btcUtxos) {
      btcUtxos = await this.getDOGEUtxos();
    }

    const { psbt, toSignInputs, splitedCount } = await txHelpers.splitInscriptionUtxo({
      assetUtxo,
      btcUtxos,
      networkType,
      changeAddress: account.address,
      feeRate,
      enableRBF,
      outputValue
    });

    const res = await this.getSignedResult(psbt, toSignInputs);
    return { ...res, splitedCount };
  };

  pushTx = async (txData: string) => {
    let rawtx = txData;
    if (txData.startsWith('70')) {
      // psbthex
      const psbt = psbtFromString(txData);
      try {
        psbt.finalizeAllInputs();
      } catch (e) {
        // skip
      }
      rawtx = psbt.extractTransaction(true).toHex();
    }
    const txid = await walletApiService.bitcoin.pushTx(rawtx);
    return txid;
  };

  getAccounts = async () => {
    const keyrings = await this.getKeyrings();
    const accounts: Account[] = keyrings.reduce<Account[]>((pre, cur) => pre.concat(cur.accounts), []);
    return accounts;
  };

  displayedKeyringToWalletKeyring = (displayedKeyring: DisplayedKeyring, index: number, initName = true) => {
    const networkType = this.getNetworkType();
    const addressType = displayedKeyring.addressType;
    const key = 'keyring_' + index;
    const type = displayedKeyring.type;
    const accounts: Account[] = [];

    for (let j = 0; j < displayedKeyring.accounts.length; j++) {
      let pubkey: string;
      let address: string;

      if (type === KeyringType.ColdWalletKeyring) {
        // For cold wallets, we might not have pubkey, so we use the address directly
        // The account might be just an address string for cold wallets
        if (typeof displayedKeyring.accounts[j] === 'string') {
          address = displayedKeyring.accounts[j] as unknown as string;
          pubkey = '';
        } else {
          const account = displayedKeyring.accounts[j] as any;
          pubkey = account.pubkey || '';
          address = account.address || this.dogecoinAwarePublicKeyToAddress(pubkey, addressType, networkType);
        }
      } else {
        // Use the address already calculated in displayForKeyring
        // This avoids re-initializing ECC and ensures correct Dogecoin addresses
        const account = displayedKeyring.accounts[j] as any;
        pubkey = account.pubkey;
        address = account.address || this.dogecoinAwarePublicKeyToAddress(pubkey, addressType, networkType);
      }

      const accountKey = key + '#' + j;
      const defaultName = this._generateAlianName(type, j + 1);
      const alianName = preferenceService.getAccountAlianName(accountKey, defaultName);
      const flag = preferenceService.getAddressFlag(address);
      accounts.push({
        type,
        pubkey,
        address,
        alianName,
        index: j,
        key: accountKey,
        flag
      });
    }
    const hdPath =
      type === KeyringType.HdKeyring || type === KeyringType.KeystoneKeyring ? displayedKeyring.keyring.hdPath : '';
    const alianName = preferenceService.getKeyringAlianName(
      key,
      initName ? `${KEYRING_TYPES[type].alianName} #${index + 1}` : ''
    );
    const keyring: WalletKeyring = {
      index,
      key,
      type,
      addressType,
      accounts,
      alianName,
      hdPath
    };
    return keyring;
  };

  getKeyrings = async (): Promise<WalletKeyring[]> => {
    const displayedKeyrings = await keyringService.getAllDisplayedKeyrings();
    const keyrings: WalletKeyring[] = [];
    for (let index = 0; index < displayedKeyrings.length; index++) {
      const displayedKeyring = displayedKeyrings[index];
      if (displayedKeyring.type !== KeyringType.Empty) {
        const keyring = this.displayedKeyringToWalletKeyring(displayedKeyring, displayedKeyring.index);
        keyrings.push(keyring);
      }
    }

    return keyrings;
  };

  getCurrentKeyring = async () => {
    let currentKeyringIndex = preferenceService.getCurrentKeyringIndex();
    const displayedKeyrings = await keyringService.getAllDisplayedKeyrings();
    if (currentKeyringIndex === undefined) {
      const currentAccount = preferenceService.getCurrentAccount();
      for (let i = 0; i < displayedKeyrings.length; i++) {
        if (displayedKeyrings[i].type !== currentAccount?.type) {
          continue;
        }
        const found = displayedKeyrings[i].accounts.find((v) => v.pubkey === currentAccount?.pubkey);
        if (found) {
          currentKeyringIndex = i;
          break;
        }
      }
      if (currentKeyringIndex === undefined) {
        currentKeyringIndex = 0;
      }
    }

    if (
      !displayedKeyrings[currentKeyringIndex] ||
      displayedKeyrings[currentKeyringIndex].type === KeyringType.Empty ||
      !displayedKeyrings[currentKeyringIndex].accounts[0]
    ) {
      for (let i = 0; i < displayedKeyrings.length; i++) {
        if (displayedKeyrings[i].type !== KeyringType.Empty) {
          currentKeyringIndex = i;
          preferenceService.setCurrentKeyringIndex(currentKeyringIndex);
          break;
        }
      }
    }
    const displayedKeyring = displayedKeyrings[currentKeyringIndex];
    if (!displayedKeyring) return null;
    return this.displayedKeyringToWalletKeyring(displayedKeyring, currentKeyringIndex);
  };

  getCurrentAccount = async () => {
    const currentKeyring = await this.getCurrentKeyring();
    if (!currentKeyring) return null;
    const account = preferenceService.getCurrentAccount();
    let currentAccount: Account | undefined = undefined;
    currentKeyring.accounts.forEach((v) => {
      if (v.pubkey === account?.pubkey) {
        currentAccount = v;
      }
    });
    if (!currentAccount) {
      currentAccount = currentKeyring.accounts[0];
    }
    if (currentAccount) {
      currentAccount.flag = preferenceService.getAddressFlag(currentAccount.address);
      walletApiService.setClientAddress(currentAccount.address, currentAccount.flag);
    }

    return currentAccount;
  };

  getEditingKeyring = async () => {
    const editingKeyringIndex = preferenceService.getEditingKeyringIndex();
    const displayedKeyrings = await keyringService.getAllDisplayedKeyrings();
    const displayedKeyring = displayedKeyrings[editingKeyringIndex];
    return this.displayedKeyringToWalletKeyring(displayedKeyring, editingKeyringIndex);
  };

  setEditingKeyring = async (index: number) => {
    preferenceService.setEditingKeyringIndex(index);
  };

  getEditingAccount = async () => {
    const account = preferenceService.getEditingAccount();
    return account;
  };

  setEditingAccount = async (account: Account) => {
    preferenceService.setEditingAccount(account);
  };

  queryDomainInfo = async (domain: string) => {
    const data = await walletApiService.domain.getDomainInfo(domain);
    return data;
  };

  getInscriptionSummary = async () => {
    const data = await walletApiService.inscriptions.getInscriptionSummary();
    return data;
  };

  getAppSummary = async () => {
    const appTab = preferenceService.getAppTab();
    try {
      const data = await walletApiService.utility.getAppSummary();
      const readTabTime = appTab.readTabTime;
      data.apps.forEach((w) => {
        const readAppTime = appTab.readAppTime[w.id];
        if (w.time) {
          if (Date.now() > w.time + 1000 * 60 * 60 * 24 * 7) {
            w.new = false;
          } else if (readAppTime && readAppTime > w.time) {
            w.new = false;
          } else {
            w.new = true;
          }
        } else {
          w.new = false;
        }
      });
      data.readTabTime = readTabTime;
      preferenceService.setAppSummary(data);
      return data;
    } catch (e) {
      console.log('getAppSummary error:', e);
      return appTab.summary;
    }
  };

  readTab = async () => {
    return preferenceService.setReadTabTime(Date.now());
  };

  readApp = async (appid: number) => {
    return preferenceService.setReadAppTime(appid, Date.now());
  };

  getAddressUtxo = async (address: string) => {
    const data = await walletApiService.bitcoin.getDOGEUtxos(address);
    return data;
  };

  getConnectedSites = () => {
    const data = permissionService.getConnectedSites();
    return data;
  };
  setRecentConnectedSites = (sites: ConnectedSite[]) => {
    permissionService.setRecentConnectedSites(sites);
  };
  getRecentConnectedSites = () => {
    return permissionService.getRecentConnectedSites();
  };
  getCurrentSite = (tabId: number): ConnectedSite | null => {
    const { origin, name, icon } = sessionService.getSession(tabId) || {};
    if (!origin) {
      return null;
    }
    const site = permissionService.getSite(origin);
    if (site) {
      return site;
    }
    return {
      origin,
      name,
      icon,
      chain: ChainType.BITCOIN_MAINNET,
      isConnected: false,
      isSigned: false,
      isTop: false
    };
  };
  getCurrentConnectedSite = (tabId: number) => {
    const { origin } = sessionService.getSession(tabId) || {};
    return permissionService.getWithoutUpdate(origin);
  };
  setSite = (data: ConnectedSite) => {
    permissionService.setSite(data);
    if (data.isConnected) {
      const network = this.getLegacyNetworkName();
      sessionService.broadcastEvent(
        'networkChanged',
        {
          network
        },
        data.origin
      );
    }
  };
  updateConnectSite = (origin: string, data: ConnectedSite) => {
    permissionService.updateConnectSite(origin, data);
    const network = this.getLegacyNetworkName();
    sessionService.broadcastEvent(
      'networkChanged',
      {
        network
      },
      data.origin
    );
  };

  removeConnectedSite = (origin: string) => {
    sessionService.broadcastEvent('accountsChanged', [], origin);
    permissionService.removeConnectedSite(origin);
  };

  setKeyringAlianName = (keyring: WalletKeyring, name: string) => {
    preferenceService.setKeyringAlianName(keyring.key, name);
    keyring.alianName = name;
    return keyring;
  };

  setAccountAlianName = (account: Account, name: string) => {
    preferenceService.setAccountAlianName(account.key, name);
    account.alianName = name;
    return account;
  };

  addAddressFlag = (account: Account, flag: AddressFlagType) => {
    account.flag = preferenceService.addAddressFlag(account.address, flag);
    walletApiService.setClientAddress(account.address, account.flag);
    return account;
  };
  removeAddressFlag = (account: Account, flag: AddressFlagType) => {
    account.flag = preferenceService.removeAddressFlag(account.address, flag);
    walletApiService.setClientAddress(account.address, account.flag);
    return account;
  };

  getFeeSummary = async () => {
    return walletApiService.bitcoin.getFeeSummary();
  };

  getCoinPrice = async () => {
    return walletApiService.market.getCoinPrice();
  };

  getDrc20sPrice = async (ticks: string[]) => {
    return walletApiService.market.getDrc20sPrice(ticks);
  };

  getDunesPrice = async (ticks: string[]) => {
    return walletApiService.market.getDunesPrice(ticks);
  };

  getCharmsPrice = async (charmsids: string[]) => {
    return walletApiService.market.getCharmsPrice(charmsids);
  };

  inscribeDRC20Transfer = (address: string, tick: string, amount: string, feeRate: number, outputValue: number) => {
    return walletApiService.drc20.inscribeDRC20Transfer(address, tick, amount, feeRate, outputValue);
  };

  getInscribeResult = (orderId: string) => {
    return walletApiService.drc20.getInscribeResult(orderId);
  };

  decodePsbt = (psbtHex: string, website: string) => {
    return walletApiService.bitcoin.decodePsbt(psbtHex, website);
  };

  decodeContracts = (contracts: any[], account) => {
    return walletApiService.bitcoin.decodeContracts(contracts, account);
  };

  getDRC20List = async (address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;

    const uiCachedData = preferenceService.getUICachedData(address);
    if (uiCachedData.drc20List[currentPage]) {
      return uiCachedData.drc20List[currentPage];
    }

    const { total, list } = await walletApiService.drc20.getDRC20List(address, cursor, size);
    uiCachedData.drc20List[currentPage] = {
      currentPage,
      pageSize,
      total,
      list
    };
    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getAllInscriptionList = async (address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;

    const uiCachedData = preferenceService.getUICachedData(address);
    if (uiCachedData.allInscriptionList[currentPage]) {
      return uiCachedData.allInscriptionList[currentPage];
    }

    const { total, list } = await walletApiService.inscriptions.getAddressInscriptions(address, cursor, size);
    uiCachedData.allInscriptionList[currentPage] = {
      currentPage,
      pageSize,
      total,
      list
    };
    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getDRC20Summary = async (address: string, ticker: string) => {
    const uiCachedData = preferenceService.getUICachedData(address);
    if (uiCachedData.drc20Summary[ticker]) {
      return uiCachedData.drc20Summary[ticker];
    }

    const tokenSummary = await walletApiService.drc20.getAddressTokenSummary(address, ticker);
    uiCachedData.drc20Summary[ticker] = tokenSummary;
    return tokenSummary;
  };

  getDRC20TransferableList = async (address: string, ticker: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;

    const uiCachedData = preferenceService.getUICachedData(address);
    if (uiCachedData.drc20TransferableList[ticker] && uiCachedData.drc20TransferableList[ticker][currentPage]) {
      return uiCachedData.drc20TransferableList[ticker][currentPage];
    }
    if (!uiCachedData.drc20TransferableList[ticker]) {
      uiCachedData.drc20TransferableList[ticker] = [];
    }

    const { total, list } = await walletApiService.drc20.getTokenTransferableList(address, ticker, cursor, size);
    uiCachedData.drc20TransferableList[ticker][currentPage] = {
      currentPage,
      pageSize,
      total,
      list
    };
    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  expireUICachedData = (address: string) => {
    return preferenceService.expireUICachedData(address);
  };

  getWalletConfig = () => {
    return walletApiService.config.getWalletConfig();
  };

  getSkippedVersion = () => {
    return preferenceService.getSkippedVersion();
  };

  setSkippedVersion = (version: string) => {
    return preferenceService.setSkippedVersion(version);
  };

  getInscriptionUtxoDetail = async (inscriptionId: string) => {
    const utxo = await walletApiService.inscriptions.getInscriptionUtxoDetail(inscriptionId);
    if (!utxo) {
      throw new Error('UTXO not found.');
    }
    return utxo;
  };

  getUtxoByInscriptionId = async (inscriptionId: string) => {
    const utxo = await walletApiService.inscriptions.getInscriptionUtxo(inscriptionId);
    if (!utxo) {
      throw new Error('UTXO not found.');
    }
    return utxo;
  };

  getInscriptionInfo = async (inscriptionId: string) => {
    const utxo = await walletApiService.inscriptions.getInscriptionInfo(inscriptionId);
    if (!utxo) {
      throw new Error('Inscription not found.');
    }
    return utxo;
  };

  /**
   * Check if a website is a known phishing site
   * @param website Website URL or origin to check
   * @returns Object containing check results with isScammer flag and optional warning message
   */
  checkWebsite = async (
    website: string
  ): Promise<{ isScammer: boolean; warning: string; allowQuickMultiSign?: boolean }> => {
    let isLocalPhishing = false;

    try {
      let hostname = '';
      try {
        hostname = new URL(website).hostname;
      } catch (e) {
        hostname = website;
      }

      const phishingService = await import('@/background/service/phishing');
      isLocalPhishing = phishingService.default.checkPhishing(hostname);
    } catch (error) {
      console.error('[Phishing] Local check error:', error);
    }

    const apiResult = await walletApiService.utility.checkWebsite(website);

    if (isLocalPhishing) {
      return {
        ...apiResult,
        isScammer: true
      };
    }

    return apiResult;
  };

  getDoginalsInscriptions = async (address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;

    const { total, list } = await walletApiService.inscriptions.getDoginalsInscriptions(address, cursor, size);
    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getDoginals = async (address: string, cursor?: string, size = 20) => {
    return await walletApiService.doginals.getAddressDoginals(address, cursor, size);
  };

  createDoginalInscription = async (content: string, feeRate: number) => {
    return await walletApiService.doginals.createDoginalInscription(content, feeRate);
  };

  getAddressSummary = async (address: string) => {
    const data = await walletApiService.bitcoin.getAddressSummary(address);
    // preferenceService.updateAddressBalance(address, data);
    return data;
  };

  getMultiAssetBalance = async (address: string) => {
    return await walletApiService.marketplace.getBalance(address);
  };

  getMarketplaceListings = async (cursor?: string, size = 20, filters?: any) => {
    return await walletApiService.marketplace.getListings(cursor, size, filters);
  };

  getMarketplaceListing = async (listingId: string) => {
    return await walletApiService.marketplace.getListing(listingId);
  };

  createMarketplaceListing = async (doginalId: string, price: number, sellerAddress: string) => {
    return await walletApiService.marketplace.createListing(doginalId, price, sellerAddress);
  };

  buyMarketplaceListing = async (listingId: string, buyerAddress: string) => {
    return await walletApiService.marketplace.buyListing(listingId, buyerAddress);
  };

  resolveDNS = async (name: string) => {
    return await walletApiService.dns.resolve(name);
  };

  reverseResolveDNS = async (address: string) => {
    return await walletApiService.dns.reverseResolve(address);
  };

  getDNSAvatar = async (name: string) => {
    return await walletApiService.dns.getAvatar(name);
  };

  getDNSConfig = async (name: string) => {
    return await walletApiService.dns.getConfig(name);
  };

  setPsbtSignNonSegwitEnable(psbt: bitcoin.Psbt, enabled: boolean) {
    //@ts-ignore
    psbt.__CACHE.__UNSAFE_SIGN_NONSEGWIT = enabled;
  }

  getShowSafeNotice = () => {
    return preferenceService.getShowSafeNotice();
  };

  setShowSafeNotice = (show: boolean) => {
    return preferenceService.setShowSafeNotice(show);
  };

  getVersionDetail = (version: string) => {
    return walletApiService.getVersionDetail(version);
  };

  checkKeyringMethod = async (method: string) => {
    const account = await this.getCurrentAccount();
    if (!account) throw new Error('no current account');
    const keyring = await keyringService.getKeyringForAccount(account.pubkey);
    if (!keyring) {
      throw new Error('keyring does not exist');
    }
    if (!keyring[method]) {
      throw new Error(`keyring does not have ${method} method`);
    }
    return { account, keyring };
  };

  // Keystone related functions
  // genSignPsbtUr, parseSignPsbtUr, genSignMsgUr, parseSignMsgUr, getKeystoneConnectionType
  genSignPsbtUr = async (psbtHex: string) => {
    const { keyring } = await this.checkKeyringMethod('genSignPsbtUr');
    return await keyring.genSignPsbtUr!(psbtHex);
  };

  parseSignPsbtUr = async (type: string, cbor: string, isFinalize = true) => {
    const { keyring } = await this.checkKeyringMethod('parseSignPsbtUr');
    const psbtHex = await keyring.parseSignPsbtUr!(type, cbor);
    const psbt = bitcoin.Psbt.fromHex(psbtHex);
    isFinalize && psbt.finalizeAllInputs();
    return {
      psbtHex: psbt.toHex(),
      rawtx: isFinalize ? psbt.extractTransaction().toHex() : undefined
    };
  };

  genSignMsgUr = async (text: string, msgType?: string) => {
    if (msgType === 'bip322-simple') {
      const account = await this.getCurrentAccount();
      if (!account) throw new Error('no current account');
      const psbt = genPsbtOfBIP322Simple({
        message: text,
        address: account.address,
        networkType: this.getNetworkType()
      });
      const toSignInputs = await this.formatOptionsToSignInputs(psbt);
      await this.signPsbt(psbt, toSignInputs, false);
      return await this.genSignPsbtUr(psbt.toHex());
    }
    const { account, keyring } = await this.checkKeyringMethod('genSignMsgUr');
    return await keyring.genSignMsgUr!(account.pubkey, text);
  };

  parseSignMsgUr = async (type: string, cbor: string, msgType: string) => {
    if (msgType === 'bip322-simple') {
      const res = await this.parseSignPsbtUr(type, cbor, false);
      const psbt = bitcoin.Psbt.fromHex(res.psbtHex);
      psbt.finalizeAllInputs();
      return {
        signature: getSignatureFromPsbtOfBIP322Simple(psbt)
      };
    }
    const { keyring } = await this.checkKeyringMethod('parseSignMsgUr');
    const sig = await keyring.parseSignMsgUr!(type, cbor);
    sig.signature = Buffer.from(sig.signature, 'hex').toString('base64');

    return sig;
  };

  getKeystoneConnectionType = async () => {
    const { keyring } = await this.checkKeyringMethod('getConnectionType');
    return keyring.getConnectionType!();
  };

  getEnableSignData = async () => {
    return preferenceService.getEnableSignData();
  };

  setEnableSignData = async (enable: boolean) => {
    return preferenceService.setEnableSignData(enable);
  };

  getDunesList = async (address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;
    const { total, list } = await walletApiService.dunes.getDunesList(address, cursor, size);

    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getAssetUtxosDunes = async (duneid: string) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');
    const dunes_utxos = await walletApiService.dunes.getDunesUtxos(account.address, duneid);

    const assetUtxos = dunes_utxos.map((v) => {
      return Object.assign(v, { pubkey: account.pubkey });
    });

    assetUtxos.forEach((v) => {
      v.inscriptions = [];
    });

    assetUtxos.sort((a, b) => {
      const bAmount = b.dunes.find((v) => v.duneid == duneid)?.amount || '0';
      const aAmount = a.dunes.find((v) => v.duneid == duneid)?.amount || '0';
      return dunesUtils.compareAmount(bAmount, aAmount);
    });

    return assetUtxos;
  };

  getAddressDunesTokenSummary = async (address: string, duneid: string) => {
    const tokenSummary = await walletApiService.dunes.getAddressDunesTokenSummary(address, duneid);
    return tokenSummary;
  };

  sendDunes = async ({
    to,
    duneid,
    duneAmount,
    feeRate,
    enableRBF,
    btcUtxos,
    assetUtxos,
    outputValue
  }: {
    to: string;
    duneid: string;
    duneAmount: string;
    feeRate: number;
    enableRBF: boolean;
    btcUtxos?: UnspentOutput[];
    assetUtxos?: UnspentOutput[];
    outputValue?: number;
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const networkType = this.getNetworkType();

    if (!assetUtxos) {
      assetUtxos = await this.getAssetUtxosDunes(duneid);
    }

    const _assetUtxos: UnspentOutput[] = [];

    // find the utxo that has the exact amount to split
    for (let i = 0; i < assetUtxos.length; i++) {
      const v = assetUtxos[i];
      if (v.dunes && v.dunes.length > 1) {
        const balance = v.dunes.find((r) => r.duneid == duneid);
        if (balance && balance.amount == duneAmount) {
          _assetUtxos.push(v);
          break;
        }
      }
    }

    if (_assetUtxos.length == 0) {
      for (let i = 0; i < assetUtxos.length; i++) {
        const v = assetUtxos[i];
        if (v.dunes) {
          const balance = v.dunes.find((r) => r.duneid == duneid);
          if (balance && balance.amount == duneAmount) {
            _assetUtxos.push(v);
            break;
          }
        }
      }
    }

    if (_assetUtxos.length == 0) {
      let total = BigInt(0);
      for (let i = 0; i < assetUtxos.length; i++) {
        const v = assetUtxos[i];
        v.dunes?.forEach((r) => {
          if (r.duneid == duneid) {
            total = total + BigInt(r.amount);
          }
        });
        _assetUtxos.push(v);
        if (total >= BigInt(duneAmount)) {
          break;
        }
      }
    }

    assetUtxos = _assetUtxos;

    if (!btcUtxos) {
      btcUtxos = await this.getDOGEUtxos();
    }

    // Stub implementation for sendDunes - needs proper implementation
    const psbt = bitcoin.Psbt.fromHex(
      '020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01000000000000000000000000'
    );
    const toSignInputs: ToSignInput[] = [];

    return this.getSignedResult(psbt, toSignInputs);
  };

  prepareMintDunes = async ({
    duneid,
    numMints,
    feeRate,
    enableRBF,
    btcUtxos,
    destination
  }: {
    duneid: string;
    numMints: number;
    feeRate: number;
    enableRBF: boolean;
    btcUtxos?: UnspentOutput[];
    destination?: string;
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const networkType = this.getNetworkType();
    const network = getDogecoinNetwork(networkType);

    // Parse the duneid (format: "block:tx")
    const duneId = dunestone.parseDuneId(duneid);

    // Get destination address (use current address if not specified)
    const toAddress = destination || account.address;

    if (!txHelpers.isValidAddress(toAddress, networkType)) {
      throw new Error('Invalid destination address');
    }

    if (!btcUtxos) {
      btcUtxos = await this.getDOGEUtxos();
    }

    if (btcUtxos.length === 0) {
      throw new Error('Insufficient balance for transaction fees');
    }

    // Create the dunestone for minting
    // pointer: 1 means the minted dunes go to output index 1 (the destination output)
    const dunestoneScript = dunestone.createMintDunestone(duneId, 1);

    // Validate dunestone size
    if (dunestoneScript.length > dunestone.MAX_STANDARD_OP_RETURN_SIZE) {
      throw new Error(
        `Dunestone exceeds maximum size: ${dunestoneScript.length} > ${dunestone.MAX_STANDARD_OP_RETURN_SIZE}`
      );
    }

    // Create PSBT
    const psbt = new bitcoin.Psbt({ network });

    // Output 0: Dunestone OP_RETURN (no value)
    psbt.addOutput({
      script: dunestoneScript,
      value: 0
    });

    // Output 1: Destination address (receives minted dunes)
    // Use 10000 koinu (0.0001 DOGE) as postage - standard for dunes
    const postage = 10000;
    psbt.addOutput({
      address: toAddress,
      value: postage
    });

    // Calculate required funding
    // We need enough for: postage + fees
    // Estimate: ~200 vbytes for a simple mint transaction
    const estimatedSize = 200;
    const estimatedFee = Math.ceil(estimatedSize * feeRate);
    const totalNeeded = postage + estimatedFee;

    // Select UTXOs to fund the transaction
    let selectedValue = 0;
    const selectedUtxos: UnspentOutput[] = [];
    const toSignInputs: ToSignInput[] = [];

    for (const utxo of btcUtxos) {
      if (selectedValue >= totalNeeded) {
        break;
      }

      selectedUtxos.push(utxo);
      selectedValue += utxo.satoshis;

      // Add input to PSBT
      const input: any = {
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(utxo.scriptPk, 'hex'),
          value: utxo.satoshis
        }
      };

      // TODO: Add proper input handling for different address types
      // For now, this assumes P2PKH addresses (most common for Dogecoin)
      
      psbt.addInput(input);

      toSignInputs.push({
        index: psbt.inputCount - 1,
        address: account.address,
        publicKey: account.pubkey
      });
    }

    if (selectedValue < totalNeeded) {
      throw new Error(`Insufficient balance. Need ${totalNeeded} koinu, have ${selectedValue} koinu`);
    }

    // Add change output if needed
    const actualFee = estimatedFee;
    const change = selectedValue - postage - actualFee;
    
    if (change > txHelpers.getAddressUtxoDust(account.address)) {
      psbt.addOutput({
        address: account.address,
        value: change
      });
    }

    // Set RBF if enabled
    if (enableRBF) {
      psbt.txInputs.forEach((_, index) => {
        psbt.setInputSequence(index, 0xfffffffd);
      });
    }

    // Set locktime to current block height for security
    psbt.setLocktime(0);

    // Calculate actual fee
    const fee = selectedValue - postage - change;

    return {
      psbt,
      toSignInputs,
      fee,
      estimatedFee: actualFee,
      postage,
      duneid,
      numMints,
      destination: toAddress
    };
  };

  getSignedResult = async (psbt: bitcoin.Psbt, toSignInputs: ToSignInput[]) => {
    this.setPsbtSignNonSegwitEnable(psbt, true);
    await this.signPsbt(psbt, toSignInputs, true);
    this.setPsbtSignNonSegwitEnable(psbt, false);

    const psbtHex = psbt.toHex();
    let rawtx = '';
    let fee = 0;
    try {
      rawtx = psbt.extractTransaction(true).toHex();
      fee = psbt.getFee();
    } catch (e) {
      // ignore
    }

    return {
      psbtHex,
      rawtx,
      fee
    };
  };

  getAutoLockTimeId = () => {
    return preferenceService.getAutoLockTimeId();
  };

  setAutoLockTimeId = (timeId: number) => {
    preferenceService.setAutoLockTimeId(timeId);
    this._resetTimeout();
  };

  getOpenInSidePanel = () => {
    return preferenceService.getOpenInSidePanel();
  };

  getDeveloperMode = () => {
    return preferenceService.getDeveloperMode();
  };

  setDeveloperMode = (developerMode: boolean) => {
    preferenceService.setDeveloperMode(developerMode);
  };

  setTheme = (theme: 'light' | 'dark') => {
    preferenceService.setTheme(theme);
  };

  setOpenInSidePanel = (openInSidePanel: boolean) => {
    preferenceService.setOpenInSidePanel(openInSidePanel);

    try {
      const chromeWithSidePanel = chrome as any;
      if (chromeWithSidePanel.sidePanel) {
        chromeWithSidePanel.sidePanel.setPanelBehavior({ openPanelOnActionClick: openInSidePanel });
      }
    } catch (error) {
      console.error('Failed to update side panel behavior:', error);
    }
  };

  setLastActiveTime = () => {
    this._resetTimeout();
  };

  _resetTimeout = async () => {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    const timeId = preferenceService.getAutoLockTimeId();
    const timeConfig = AUTO_LOCK_TIMES[timeId] || AUTO_LOCK_TIMES[DEFAULT_LOCKTIME_ID];
    this.timer = setTimeout(() => {
      this.lockWallet();
    }, timeConfig.time);
  };

  getAppList = async () => {
    const data = await walletApiService.utility.getAppList();
    return data;
  };

  getBannerList = async () => {
    const data = await walletApiService.utility.getBannerList();
    return data;
  };

  getBlockActiveInfo = () => {
    return walletApiService.utility.getBlockActiveInfo();
  };

  getCAT721List = async (version: CAT_VERSION, address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;
    const { total, list } = await walletApiService.cat.getCAT721CollectionList(version, address, cursor, size);

    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getAddressCAT721CollectionSummary = async (version: CAT_VERSION, address: string, collectionId: string) => {
    const collectionSummary = await walletApiService.cat.getAddressCAT721CollectionSummary(
      version,
      address,
      collectionId
    );
    return collectionSummary;
  };

  transferCAT721Step1 = async (
    version: CAT_VERSION,
    to: string,
    collectionId: string,
    localId: string,
    feeRate: number
  ) => {
    const currentAccount = await this.getCurrentAccount();
    if (!currentAccount) {
      return;
    }

    const _res = await walletApiService.cat.transferCAT721Step1(
      version,
      currentAccount.address,
      currentAccount.pubkey,
      to,
      collectionId,
      localId,
      feeRate
    );
    return _res;
  };

  transferCAT721Step2 = async (
    version: CAT_VERSION,
    transferId: string,
    commitTx: string,
    toSignInputs: ToSignInput[]
  ) => {
    const chainType = this.getChainType();
    const psbtNetwork = getDogecoinNetwork(chainType);
    const psbt = bitcoin.Psbt.fromBase64(commitTx, { network: psbtNetwork });
    await this.signPsbt(psbt, toSignInputs, true);
    const _res = await walletApiService.cat.transferCAT721Step2(version, transferId, psbt.toBase64());
    return _res;
  };

  transferCAT721Step3 = async (
    version: CAT_VERSION,
    transferId: string,
    revealTx: string,
    toSignInputs: ToSignInput[]
  ) => {
    const chainType = this.getChainType();
    const psbtNetwork = getDogecoinNetwork(chainType);
    const psbt = bitcoin.Psbt.fromBase64(revealTx, { network: psbtNetwork });
    await this.signPsbt(psbt, toSignInputs, false);
    const _res = await walletApiService.cat.transferCAT721Step3(version, transferId, psbt.toBase64());
    return _res;
  };

  getBuyCoinChannelList = async (coin: 'FB' | 'DOGE') => {
    return walletApiService.utility.getBuyCoinChannelList(coin);
  };

  createBuyCoinPaymentUrl = (coin: 'FB' | 'DOGE', address: string, channel: string) => {
    return walletApiService.utility.createBuyCoinPaymentUrl(coin, address, channel);
  };

  claimFaucet = async (address: string, amount?: number) => {
    return walletApiService.faucet.claim(address, amount);
  };

  //  ----------- cosmos support --------

  singleStepTransferDRC20Step1 = async (params: {
    userAddress: string;
    userPubkey: string;
    receiver: string;
    ticker: string;
    amount: string;
    feeRate: number;
  }) => {
    return walletApiService.drc20.singleStepTransferDRC20Step1(params);
  };

  singleStepTransferDRC20Step2 = async (params: { orderId: string; commitTx: string; toSignInputs: ToSignInput[] }) => {
    const chainType = this.getChainType();
    const psbtNetwork = getDogecoinNetwork(chainType);
    const psbt = bitcoin.Psbt.fromHex(params.commitTx, { network: psbtNetwork });
    await this.signPsbt(psbt, params.toSignInputs, true);

    return walletApiService.drc20.singleStepTransferDRC20Step2({ orderId: params.orderId, psbt: psbt.toBase64() });
  };

  singleStepTransferDRC20Step3 = async (params: { orderId: string; revealTx: string; toSignInputs: ToSignInput[] }) => {
    const chainType = this.getChainType();
    const psbtNetwork = getDogecoinNetwork(chainType);
    const psbt = bitcoin.Psbt.fromHex(params.revealTx, { network: psbtNetwork });
    await this.signPsbt(psbt, params.toSignInputs, true);
    return walletApiService.drc20.singleStepTransferDRC20Step3({ orderId: params.orderId, psbt: psbt.toBase64() });
  };

  sendCoinBypassHeadOffsets = async (tos: { address: string; satoshis: number }[], feeRate: number) => {
    const currentAccount = await this.getCurrentAccount();
    if (!currentAccount) {
      return;
    }

    const { psbtBase64, toSignInputs } = await walletApiService.bitcoin.createSendCoinBypassHeadOffsets(
      currentAccount.address,
      currentAccount.pubkey,
      tos,
      feeRate
    );

    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    return this.getSignedResult(psbt, toSignInputs);
  };
  // createSteakDeposit = async (amount: string) => {};

  getCharmsList = async (address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;
    const { total, list } = await walletApiService.Charms.getCharmsList(address, cursor, size);

    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getAssetUtxosCharms = async (charmsid: string) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');
    const dunes_utxos = await walletApiService.Charms.getCharmsUtxos(account.address, charmsid);

    const assetUtxos = dunes_utxos.map((v) => {
      return Object.assign(v, { pubkey: account.pubkey });
    });

    assetUtxos.forEach((v) => {
      v.inscriptions = [];
    });

    return assetUtxos;
  };

  getAddressCharmsTokenSummary = async (address: string, runeid: string, fetchAvailable: boolean) => {
    const tokenSummary = await walletApiService.Charms.getAddressCharmsTokenSummary(address, runeid, fetchAvailable);
    return tokenSummary;
  };

  createCharmsSendTx = async (params: {
    userAddress: string;
    userPubkey: string;
    receiver: string;
    charmsid: string;
    amount: string;
    feeRate: number;
  }) => {
    return walletApiService.Charms.createCharmsSendTx(params);
  };

  signCharmsSendTx = async (params: { commitTx: string; toSignInputs: ToSignInput[] }) => {
    const chainType = this.getChainType();
    const psbtNetwork = getDogecoinNetwork(chainType);
    const psbt = bitcoin.Psbt.fromHex(params.commitTx, { network: psbtNetwork });
    await this.signPsbt(psbt, params.toSignInputs, true);

    const rawtx = psbt.extractTransaction(true).toHex();
    const txid = await this.pushTx(rawtx);
    return { txid };
  };

  sendCharms = async ({
    to,
    charmsid,
    amount,
    feeRate,
    enableRBF,
    btcUtxos,
    assetUtxos
  }: {
    to: string;
    charmsid: string;
    amount: string;
    feeRate: number;
    enableRBF: boolean;
    btcUtxos?: UnspentOutput[];
    assetUtxos?: UnspentOutput[];
  }) => {
    const account = preferenceService.getCurrentAccount();
    if (!account) throw new Error('no current account');

    const txData = await this.createCharmsSendTx({
      userAddress: account.address,
      userPubkey: account.pubkey,
      receiver: to,
      charmsid,
      amount,
      feeRate
    });

    const result = await this.signCharmsSendTx({ commitTx: txData.psbtHex, toSignInputs: txData.toSignInputs as any });
    return result.txid;
  };

  getCharmsCollectionList = async (address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;
    const { total, list } = await walletApiService.Charms.getCharmsCollectionList(address, cursor, size);

    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getCharmsCollectionItems = async (address: string, collectionId: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;
    const { total, list } = await walletApiService.Charms.getCharmsCollectionItems(address, collectionId, cursor, size);

    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  getDRC20RecentHistory(address: string, ticker: string): Promise<DRC20HistoryItem[]> {
    return walletApiService.drc20.getDRC20RecentHistory(address, ticker);
  }

  getDRC20ProgList = async (address: string, currentPage: number, pageSize: number) => {
    const cursor = (currentPage - 1) * pageSize;
    const size = pageSize;
    const { total, list } = await walletApiService.drc20.getDRC20ProgList(address, cursor, size);

    return {
      currentPage,
      pageSize,
      total,
      list
    };
  };

  // Enhanced Charms methods for indexer integration
  getCharmsStats = async () => {
    return await walletApiService.Charms.getCharmsStats();
  };

  getCharmsByUtxo = async (utxo: string) => {
    return await walletApiService.Charms.getCharmsByUtxo(utxo);
  };

  getCharmsByApp = async (app: string, limit = 100) => {
    return await walletApiService.Charms.getCharmsByApp(app, limit);
  };

  // Real-time update subscriptions
  subscribeToAddressEvents = (address: string, onEvent: (event: any) => void, onError?: (error: any) => void) => {
    return walletApiService.realtime.subscribeToAddressEvents(address, onEvent, onError);
  };

  subscribeToMarketplaceEvents = (onEvent: (event: any) => void, onError?: (error: any) => void) => {
    return walletApiService.realtime.subscribeToMarketplaceEvents(onEvent, onError);
  };

  subscribeToNewBlocks = (onEvent: (event: any) => void, onError?: (error: any) => void) => {
    return walletApiService.realtime.subscribeToNewBlocks(onEvent, onError);
  };

  // Advanced search and filtering
  searchDoginals = async (filters: any) => {
    return await walletApiService.query.searchDoginals(filters);
  };

  searchTokens = async (filters: any) => {
    return await walletApiService.query.searchTokens(filters);
  };

  searchByContent = async (searchTerm: string, contentType?: string, limit?: number) => {
    return await walletApiService.query.searchByContent(searchTerm, contentType, limit);
  };

  // Local RPC configuration
  getLocalRpcConfig = () => {
    return preferenceService.getLocalRpcConfig();
  };

  saveLocalRpcConfig = (config: { host: string; port: string; username: string; password: string; testnet: boolean }) => {
    preferenceService.setLocalRpcConfig(config);
    walletApiService.updateLocalRpcProvider(config);
  };

  clearLocalRpcConfig = () => {
    preferenceService.setLocalRpcConfig(undefined);
    walletApiService.updateLocalRpcProvider(undefined);
  };
}
export default new WalletController();
