import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import { getDogecoinNetwork } from './dogecoin-network';

describe('Dogecoin network parameters', () => {
  const ECPair = ECPairFactory(ecc);

  it('derives the expected P2PKH address from a known WIF', () => {
    const dogecoinNetwork = getDogecoinNetwork(0); // mainnet
    const key = 'QSqwEtXQmnS35xKZPfaKCnnHAuKRL4FbcXAAfceQkDjsBfmgZTWP';

    const keyPair = ECPair.fromWIF(key, dogecoinNetwork);
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: dogecoinNetwork
    });

    // With correct Dogecoin mainnet prefix (0x1e), this generates a 'D' address
    expect(address).toBe('D8rM1XzLpVLxH9LxqsX5ZaLhZVH7dTzKd');
  });
});
