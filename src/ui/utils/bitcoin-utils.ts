import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';

import { getDogecoinNetwork } from '@/shared/lib/dogecoin-network';
import { AddressType, NetworkType } from '@unisat/wallet-types';

export function getAddressType(address: string, networkType?: NetworkType) {
  // Use bitcoinjs-lib to properly validate addresses with Dogecoin networks
  try {
    // Get the appropriate Dogecoin network based on networkType
    const dogecoinNetwork =
      networkType === NetworkType.TESTNET
        ? getDogecoinNetwork(1) // testnet
        : getDogecoinNetwork(0); // mainnet

    // Try to decode the address
    bitcoin.address.toOutputScript(address, dogecoinNetwork);
    return AddressType.P2PKH; // Dogecoin only supports P2PKH
  } catch (e) {
    return AddressType.UNKNOWN;
  }
}

export function isValidAddress(address: string, networkType?: NetworkType) {
  try {
    // Get the appropriate Dogecoin network
    const dogecoinNetwork =
      networkType === NetworkType.TESTNET
        ? getDogecoinNetwork(1) // testnet
        : getDogecoinNetwork(0); // mainnet

    // Validate address using bitcoinjs-lib
    bitcoin.address.toOutputScript(address, dogecoinNetwork);
    return true;
  } catch (e) {
    return false;
  }
}

export function getAddressUtxoDust(address: string) {
  const addressType = getAddressType(address);
  // Dogecoin only supports P2PKH addresses with dust amount of 546 koinu
  if (addressType === AddressType.P2PKH) {
    return 546;
  } else {
    return 546; // Default to P2PKH dust amount
  }
}

export function dogecoinPublicKeyToAddress(publicKey: string, addressType: AddressType, networkType?: NetworkType) {
  // Get the appropriate Dogecoin network
  const dogecoinNetwork =
    networkType === NetworkType.TESTNET
      ? getDogecoinNetwork(1) // testnet
      : getDogecoinNetwork(0); // mainnet

  // Dogecoin only supports P2PKH addresses
  if (addressType === AddressType.P2PKH) {
    const publicKeyBuffer = Buffer.from(publicKey, 'hex');
    return bitcoin.payments.p2pkh({
      pubkey: publicKeyBuffer,
      network: dogecoinNetwork
    }).address!;
  }

  // For other address types
  throw new Error('Dogecoin only supports P2PKH addresses');
}

export function isValidHdPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // HD path should start with 'm' or 'M'
  if (!path.startsWith('m') && !path.startsWith('M')) {
    return false;
  }

  // Split by '/' and validate each component
  const components = path.split('/');

  // First component should be 'm' or 'M'
  if (components[0] !== 'm' && components[0] !== 'M') {
    return false;
  }

  // Validate each path component after 'm'
  for (let i = 1; i < components.length; i++) {
    const component = components[i];

    if (!component) {
      return false;
    }

    // Check if it's a hardened path (ends with ')
    const isHardened = component.endsWith("'");
    const numberPart = isHardened ? component.slice(0, -1) : component;

    // Check if the number part is a valid integer
    if (!/^\d+$/.test(numberPart)) {
      return false;
    }

    const num = parseInt(numberPart, 10);

    // Check if number is within valid range (0 to 2^31-1)
    if (num < 0 || num >= Math.pow(2, 31)) {
      return false;
    }
  }

  return true;
}

export function validateMnemonic(mnemonic: string): boolean {
  // do not use bip39.validateMnemonic here to reduce bundle size
  // const words = mnemonic.trim().split(/\s+/);
  // const wordCount = words.length;
  // return [12, 15, 18, 21, 24].includes(wordCount);

  return bip39.validateMnemonic(mnemonic);
}
