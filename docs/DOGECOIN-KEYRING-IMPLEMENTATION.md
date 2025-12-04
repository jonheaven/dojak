# Dogecoin Native Keyring Implementation

## Overview

This document describes the native Dogecoin keyring implementation for Dojak wallet. The implementation replaces the patched `@unisat/keyring-service` (which was designed for Bitcoin) with a purpose-built Dogecoin keyring system using `bitcore-lib-doge`.

## Why Native Dogecoin Keyrings?

### The Problem

The original implementation used `@unisat/keyring-service`, which is a Bitcoin-focused library. This caused several critical issues:

1. **Hardcoded Bitcoin Network**: The keyring service had `bitcoin.networks.bitcoin` hardcoded in the `HdKeyring` and `SimpleKeyring` classes:
   ```typescript
   // In @unisat/keyring-service
   override network: bitcoin.Network = bitcoin.networks.bitcoin  // HARDCODED!
   ```

2. **Ignored Network Configuration**: Even though we passed Dogecoin network config, it was completely ignored:
   ```typescript
   const config: KeyringServiceConfig = {
     storage,
     logger,
     t: t,
     network: dogecoinMainnet  // THIS WAS IGNORED!
   };
   ```

3. **Wrong Message Prefix**: The message prefix was `\x18` instead of `\x19`

4. **Address Mismatch**: Addresses derived didn't match the working dogemarketplace implementation

### The Solution

We built a native Dogecoin keyring system using `bitcore-lib-doge`, which has built-in Dogecoin support.

## Architecture

```
src/background/service/
├── keyring.ts                      # Main export (uses native keyrings)
└── dogecoin-keyrings/
    ├── index.ts                    # Module exports
    ├── types.ts                    # TypeScript interfaces
    ├── dogecoin-hd-keyring.ts      # HD wallet implementation
    ├── dogecoin-simple-keyring.ts  # Simple keyring for private keys
    ├── dogecoin-keyring-service.ts # Complete keyring service
    └── dogecoin-keyring.test.ts    # Test suite
```

## Network Parameters

### Dogecoin Mainnet

| Parameter | Value | Description |
|-----------|-------|-------------|
| `pubKeyHash` | `0x1e` (30) | Produces addresses starting with 'D' |
| `scriptHash` | `0x16` (22) | P2SH address prefix |
| `wif` | `0x9e` (158) | WIF prefix - produces 'Q' for compressed |
| `bip32.public` | `0x02facafd` | Extended public key version |
| `bip32.private` | `0x02fac398` | Extended private key version |
| `messagePrefix` | `\x19Dogecoin Signed Message:\n` | Message signing prefix |
| `bech32` | `dc` | Bech32 HRP (for compatibility) |

### Dogecoin Testnet

| Parameter | Value | Description |
|-----------|-------|-------------|
| `pubKeyHash` | `0x71` (113) | Produces addresses starting with 'n' or 'm' |
| `scriptHash` | `0xc4` (196) | P2SH address prefix |
| `wif` | `0xf1` (241) | WIF prefix - produces 'c' for compressed |
| `bip32.public` | `0x043587cf` | Extended public key version |
| `bip32.private` | `0x04358394` | Extended private key version |

## HD Path

Dogecoin uses BIP44 coin type `3`:

```
m/44'/3'/0'/0/0
```

- `44'` - BIP44 purpose
- `3'` - Dogecoin coin type (registered in SLIP-0044)
- `0'` - Account index
- `0` - External chain (receive addresses)
- `0` - Address index

## Components

### DogecoinHdKeyring

The HD keyring handles mnemonic-based wallets:

```typescript
const keyring = new DogecoinHdKeyring({
  type: 'HD Key Tree',
  mnemonic: 'your twelve word mnemonic phrase here ...',
  hdPath: "m/44'/3'/0'/0",
  passphrase: '',
  activeIndexes: [0, 1, 2],
});
keyring.setNetwork('mainnet');

const accounts = await keyring.getAccounts();  // Returns public keys
const address = keyring.getAddressFromPublicKey(accounts[0]);  // Returns 'D...' address
const wif = await keyring.exportAccount(accounts[0]);  // Returns 'Q...' WIF
```

**Features:**
- Mnemonic validation using BIP39
- HD derivation using `hdkey`
- Correct Dogecoin address derivation
- Correct WIF encoding using `bitcore-lib-doge`
- Message signing using `bitcore-lib-doge`
- Support for passphrase (BIP39 passphrase)
- Multiple account support
- Network switching (mainnet/testnet)

### DogecoinSimpleKeyring

The simple keyring handles direct private key imports:

```typescript
const keyring = new DogecoinSimpleKeyring(['privateKeyHex']);
keyring.setNetwork('mainnet');

// Or import from WIF
const keyring = new DogecoinSimpleKeyring(['QSqwEtXQmnS35xKZPfaKCnnHAuKRL4FbcXAAfceQkDjsBfmgZTWP']);
```

**Features:**
- Import from Dogecoin WIF (Q prefix)
- Import from Bitcoin WIF (auto-converts to Dogecoin)
- Import from raw hex private key
- Correct address derivation
- Correct WIF export

### DogecoinKeyringService

The main service that manages multiple keyrings:

```typescript
const service = new DogecoinKeyringService({
  storage: new ExtensionStorageAdapter(),
  logger: console,
  network: 'mainnet',
});

await service.init();
await service.boot('password');

// Create HD wallet
await service.createKeyringWithMnemonics(
  mnemonic,
  "m/44'/3'/0'/0",
  '',
  AddressType.P2PKH,
  1
);

// Import private key
await service.importPrivateKey('QSqwEt...', AddressType.P2PKH);
```

**Features:**
- Password-based encryption (AES-GCM)
- Persistent storage (Chrome extension storage)
- Multiple keyring management
- Account management
- Transaction signing
- Message signing/verification

## Comparison with Working Implementation

The dogemarketplace browser wallet was used as reference. Key similarities:

| Aspect | Dojak (New) | dogemarketplace |
|--------|-------------|-----------------|
| Library | `bitcore-lib-doge` | `bitcore-lib-doge` |
| HD derivation | `hdkey` | `hdkey` |
| HD path | `m/44'/3'/0'/0/0` | `m/44'/3'/0'/0/0` |
| Network | `Networks.mainnet` | `Networks.mainnet` |
| Address derivation | `privKey.toAddress().toString()` | `privKey.toAddress().toString()` |
| WIF export | `privKey.toWIF()` | `privKey.toWIF()` |

## Migration from @unisat/keyring-service

The new implementation maintains the same interface as `@unisat/keyring-service`:

```typescript
// Before (using @unisat/keyring-service)
import { KeyringService } from '@unisat/keyring-service';

// After (using native Dogecoin keyrings)
import { DogecoinKeyringService } from './dogecoin-keyrings';
```

The `KeyringServiceWrapper` in `keyring.ts` extends `DogecoinKeyringService` and provides the same interface expected by the wallet controller.

## Testing

Run the test suite:

```bash
npm test -- --testPathPattern=dogecoin-keyring
```

Tests verify:
- Correct address derivation from mnemonic
- Correct WIF export (Q prefix for mainnet)
- Multiple account derivation
- Passphrase support
- Testnet support (n/m addresses, c WIF)
- Serialization/deserialization
- Known value verification

## Dependencies

Added to `package.json`:

```json
{
  "dependencies": {
    "bitcore-lib-doge": "^10.10.5",
    "hdkey": "^2.1.0"
  }
}
```

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `src/background/service/dogecoin-keyrings/types.ts` | TypeScript types |
| `src/background/service/dogecoin-keyrings/dogecoin-hd-keyring.ts` | HD keyring |
| `src/background/service/dogecoin-keyrings/dogecoin-simple-keyring.ts` | Simple keyring |
| `src/background/service/dogecoin-keyrings/dogecoin-keyring-service.ts` | Main service |
| `src/background/service/dogecoin-keyrings/index.ts` | Exports |
| `src/background/service/dogecoin-keyrings/dogecoin-keyring.test.ts` | Tests |
| `src/shared/lib/external-types.d.ts` | Type declarations |

### Modified Files

| File | Changes |
|------|---------|
| `src/background/service/keyring.ts` | Now uses native Dogecoin keyrings |
| `src/shared/lib/dogecoin-network.ts` | Fixed messagePrefix and bech32 |
| `package.json` | Added bitcore-lib-doge and hdkey |

## Known Issues Fixed

1. **Message Prefix**: Changed from `\x18` to `\x19` (correct length prefix)
2. **Bech32 HRP**: Changed from `doge` to `dc` (matches MyDoge wallet)
3. **Network Hardcoding**: No longer uses Bitcoin network internally
4. **WIF Encoding**: Now produces correct Dogecoin WIF (Q prefix)
5. **Address Derivation**: Now matches dogemarketplace implementation

## Future Improvements

1. **Keystone Hardware Wallet**: Re-integrate Keystone support using the new native keyring system
2. **Cold Wallet**: Implement watch-only wallet support
3. **Multi-signature**: Add support for multi-sig Dogecoin transactions
4. **Doginals**: Enhanced support for Dogecoin Ordinals (inscriptions)

## References

- [BIP39 - Mnemonic code](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP44 - HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [SLIP-0044 - Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [bitcore-lib-doge](https://github.com/nicuries/bitcore-lib-doge)
- [Dogecoin Network Parameters](https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp)

