// Test Dogecoin network configuration
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');

const ECPair = ECPairFactory(ecc);

// Define Dogecoin mainnet network (matching our updated config)
const dogecoinMainnet = {
  messagePrefix: '\x18Dogecoin Signed Message:\n',
  bip32: {
    public: 0x02facafd, // [0x02, 0xfa, 0xca, 0xfd]
    private: 0x02fac398, // [0x02, 0xfa, 0xc3, 0x98]
  },
  pubKeyHash: 0x1e, // 30 decimal - 'D' addresses
  scriptHash: 0x16, // 22 decimal
  wif: 0x9e, // 158 decimal
};

console.log('Testing Dogecoin address generation...');
console.log('Network config:', {
  pubKeyHash: `0x${dogecoinMainnet.pubKeyHash.toString(16)} (${dogecoinMainnet.pubKeyHash})`,
  scriptHash: `0x${dogecoinMainnet.scriptHash.toString(16)} (${dogecoinMainnet.scriptHash})`,
  wif: `0x${dogecoinMainnet.wif.toString(16)} (${dogecoinMainnet.wif})`,
  bip32: {
    public: `0x${dogecoinMainnet.bip32.public.toString(16)}`,
    private: `0x${dogecoinMainnet.bip32.private.toString(16)}`
  }
});

// Generate a test keypair
const keyPair = ECPair.makeRandom();
const { address } = bitcoin.payments.p2pkh({
  pubkey: keyPair.publicKey,
  network: dogecoinMainnet
});

console.log('\nGenerated address:', address);
console.log('Starts with D:', address.startsWith('D'));

// Test WIF
const wif = keyPair.toWIF();
console.log('WIF:', wif);
console.log('WIF starts with expected prefix (Q or 7):', wif.startsWith('Q') || wif.startsWith('7'));

// Test with a known private key to verify consistency
const testKeyPair = ECPair.fromPrivateKey(Buffer.from('1234567890123456789012345678901234567890123456789012345678901234', 'hex'));
const { address: testAddress } = bitcoin.payments.p2pkh({
  pubkey: testKeyPair.publicKey,
  network: dogecoinMainnet
});

console.log('\nTest with known key:');
console.log('Address:', testAddress);
console.log('Starts with D:', testAddress.startsWith('D'));