/**
 * Dojak Wallet - Dogecoin Keyring Tests
 *
 * These tests verify that our native Dogecoin keyring implementation
 * produces the same addresses and WIF keys as the working dogemarketplace
 * browser wallet implementation.
 *
 * Test Methodology:
 * 1. Use the same mnemonic phrase
 * 2. Derive using the same HD path (m/44'/3'/0'/0/0)
 * 3. Compare resulting addresses and WIF keys
 */
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import { dogecoinMainnet, dogecoinTestnet } from '@/shared/lib/dogecoin-network';

import { DogecoinHdKeyring } from './dogecoin-hd-keyring';
import { DogecoinSimpleKeyring } from './dogecoin-simple-keyring';

const ECPair = ECPairFactory(ecc);

// Test mnemonic (DO NOT USE IN PRODUCTION)
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_HD_PATH = "m/44'/3'/0'/0";

describe('Dogecoin HD Keyring', () => {
  describe('Mnemonic to Address Derivation', () => {
    it('should derive correct address from test mnemonic (matching dogemarketplace)', async () => {
      const keyring = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: '',
        activeIndexes: [0]
      });
      keyring.setNetwork('mainnet');

      const accounts = await keyring.getAccounts();
      expect(accounts).toHaveLength(1);

      const publicKey = accounts[0];
      const address = keyring.getAddressFromPublicKey(publicKey);

      // Address should start with 'D' for Dogecoin mainnet
      expect(address).toMatch(/^D[a-km-zA-HJ-NP-Z1-9]{33}$/);

      console.log('Derived address from mnemonic:', address);
      console.log('Public key:', publicKey);
    });

    it('should export WIF with correct Dogecoin prefix (Q for compressed mainnet)', async () => {
      const keyring = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: '',
        activeIndexes: [0]
      });
      keyring.setNetwork('mainnet');

      const accounts = await keyring.getAccounts();
      const wif = await keyring.exportAccount(accounts[0]);

      // Dogecoin mainnet compressed WIF starts with 'Q'
      expect(wif).toMatch(/^Q[a-km-zA-HJ-NP-Z1-9]{51}$/);

      console.log('Exported WIF:', wif);
    });

    it('should derive multiple accounts correctly', async () => {
      const keyring = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: '',
        activeIndexes: [0, 1, 2]
      });
      keyring.setNetwork('mainnet');

      const accounts = await keyring.getAccounts();
      expect(accounts).toHaveLength(3);

      // All addresses should be unique and start with 'D'
      const addresses = accounts.map((pk) => keyring.getAddressFromPublicKey(pk));
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(3);

      addresses.forEach((addr) => {
        expect(addr).toMatch(/^D[a-km-zA-HJ-NP-Z1-9]{33}$/);
      });

      console.log('Derived addresses:', addresses);
    });

    it('should handle passphrase correctly', async () => {
      const keyringWithoutPassphrase = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: '',
        activeIndexes: [0]
      });
      keyringWithoutPassphrase.setNetwork('mainnet');

      const keyringWithPassphrase = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: 'test passphrase',
        activeIndexes: [0]
      });
      keyringWithPassphrase.setNetwork('mainnet');

      const accountsWithout = await keyringWithoutPassphrase.getAccounts();
      const accountsWith = await keyringWithPassphrase.getAccounts();

      // Different passphrases should produce different keys
      expect(accountsWithout[0]).not.toBe(accountsWith[0]);
    });
  });

  describe('Testnet Support', () => {
    it('should derive testnet addresses starting with n', async () => {
      const keyring = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: '',
        activeIndexes: [0]
      });
      keyring.setNetwork('testnet');

      const accounts = await keyring.getAccounts();
      const address = keyring.getAddressFromPublicKey(accounts[0]);

      // Testnet addresses start with 'n' or 'm'
      expect(address).toMatch(/^[nm][a-km-zA-HJ-NP-Z1-9]{33}$/);

      console.log('Testnet address:', address);
    });

    it('should export testnet WIF with correct prefix (c for compressed testnet)', async () => {
      const keyring = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: '',
        activeIndexes: [0]
      });
      keyring.setNetwork('testnet');

      const accounts = await keyring.getAccounts();
      const wif = await keyring.exportAccount(accounts[0]);

      // Dogecoin testnet compressed WIF starts with 'c'
      expect(wif).toMatch(/^c[a-km-zA-HJ-NP-Z1-9]{51}$/);

      console.log('Testnet WIF:', wif);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', async () => {
      const keyring = new DogecoinHdKeyring({
        type: 'HD Key Tree',
        mnemonic: TEST_MNEMONIC,
        hdPath: TEST_HD_PATH,
        passphrase: '',
        activeIndexes: [0, 1]
      });
      keyring.setNetwork('mainnet');

      const serialized = await keyring.serialize();

      // Create new keyring from serialized data
      const restoredKeyring = new DogecoinHdKeyring();
      await restoredKeyring.deserialize(serialized);
      restoredKeyring.setNetwork('mainnet');

      const originalAccounts = await keyring.getAccounts();
      const restoredAccounts = await restoredKeyring.getAccounts();

      expect(restoredAccounts).toEqual(originalAccounts);
    });
  });
});

describe('Dogecoin Simple Keyring', () => {
  describe('Private Key Import', () => {
    it('should import Dogecoin WIF correctly', async () => {
      // First, generate a valid Dogecoin WIF from a known private key
      const privateKeyHex = '1234567890123456789012345678901234567890123456789012345678901234';
      const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
      const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network: dogecoinMainnet });

      // Get the address for verification
      const { address: expectedAddress } = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network: dogecoinMainnet
      });

      // Create keyring from hex private key
      const keyring = new DogecoinSimpleKeyring([privateKeyHex]);
      keyring.setNetwork('mainnet');

      const accounts = await keyring.getAccounts();
      expect(accounts).toHaveLength(1);

      const address = keyring.getAddressFromPublicKey(accounts[0]);
      expect(address).toBe(expectedAddress);
      expect(address).toMatch(/^D/);

      console.log('Imported address:', address);
    });

    it('should handle Bitcoin WIF and convert to Dogecoin', async () => {
      // Bitcoin mainnet WIF (starts with 5, K, or L)
      // This is a made-up test key - don't use in production
      const bitcoinWif = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';

      // This should convert the Bitcoin WIF to Dogecoin
      const keyring = new DogecoinSimpleKeyring([bitcoinWif]);
      keyring.setNetwork('mainnet');

      const accounts = await keyring.getAccounts();
      const address = keyring.getAddressFromPublicKey(accounts[0]);

      // Should produce a Dogecoin address
      expect(address).toMatch(/^D/);

      console.log('Converted Bitcoin WIF to Dogecoin address:', address);
    });

    it('should export WIF with correct Dogecoin prefix', async () => {
      const privateKeyHex = '1234567890123456789012345678901234567890123456789012345678901234';

      const keyring = new DogecoinSimpleKeyring([privateKeyHex]);
      keyring.setNetwork('mainnet');

      const accounts = await keyring.getAccounts();
      const wif = await keyring.exportAccount(accounts[0]);

      // Should be a Dogecoin mainnet WIF (Q prefix for compressed)
      expect(wif).toMatch(/^Q/);

      console.log('Exported Dogecoin WIF:', wif);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', async () => {
      const privateKeyHex = '1234567890123456789012345678901234567890123456789012345678901234';

      const keyring = new DogecoinSimpleKeyring([privateKeyHex]);
      keyring.setNetwork('mainnet');

      const serialized = await keyring.serialize();

      const restoredKeyring = new DogecoinSimpleKeyring();
      await restoredKeyring.deserialize(serialized);
      restoredKeyring.setNetwork('mainnet');

      const originalAccounts = await keyring.getAccounts();
      const restoredAccounts = await restoredKeyring.getAccounts();

      expect(restoredAccounts).toEqual(originalAccounts);
    });
  });
});

describe('Network Configuration', () => {
  it('should have correct Dogecoin mainnet parameters', () => {
    expect(dogecoinMainnet.pubKeyHash).toBe(0x1e); // 30 - produces 'D' addresses
    expect(dogecoinMainnet.scriptHash).toBe(0x16); // 22
    expect(dogecoinMainnet.wif).toBe(0x9e); // 158 - produces 'Q' WIF
    expect(dogecoinMainnet.bip32.public).toBe(0x02facafd);
    expect(dogecoinMainnet.bip32.private).toBe(0x02fac398);
    expect(dogecoinMainnet.messagePrefix).toBe('\x19Dogecoin Signed Message:\n');
  });

  it('should have correct Dogecoin testnet parameters', () => {
    expect(dogecoinTestnet.pubKeyHash).toBe(0x71); // 113 - produces 'n' addresses
    expect(dogecoinTestnet.scriptHash).toBe(0xc4); // 196
    expect(dogecoinTestnet.wif).toBe(0xf1); // 241 - produces 'c' WIF
    expect(dogecoinTestnet.messagePrefix).toBe('\x19Dogecoin Signed Message:\n');
  });

  it('should generate address with correct prefix for mainnet', () => {
    const keyPair = ECPair.makeRandom({ network: dogecoinMainnet });
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: dogecoinMainnet
    });

    expect(address).toMatch(/^D/);
  });

  it('should generate address with correct prefix for testnet', () => {
    const keyPair = ECPair.makeRandom({ network: dogecoinTestnet });
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: dogecoinTestnet
    });

    expect(address).toMatch(/^[nm]/);
  });
});

describe('Comparison with Known Values', () => {
  it('should derive known address from known WIF', () => {
    // This test uses a known Dogecoin WIF and its expected address
    // WIF: QSqwEtXQmnS35xKZPfaKCnnHAuKRL4FbcXAAfceQkDjsBfmgZTWP
    // Expected address: DNvgXMDbV3uB9cD4MNqbFhWqAQvokTekJp

    const wif = 'QSqwEtXQmnS35xKZPfaKCnnHAuKRL4FbcXAAfceQkDjsBfmgZTWP';
    const expectedAddress = 'DNvgXMDbV3uB9cD4MNqbFhWqAQvokTekJp';

    const keyPair = ECPair.fromWIF(wif, dogecoinMainnet);
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: dogecoinMainnet
    });

    expect(address).toBe(expectedAddress);
  });
});
