import bitcore from 'bitcore-lib-doge';

import { signDogecoinMessage, verifyDogecoinMessage } from '@dojak/core/lib/dogecoin-message';
import { IntentPayload } from '@dojak/core/types';

import {
  buildMarketplaceIntentSummary,
  createSignedMarketplaceIntent,
  hashMarketplaceIntentPayload,
  prepareMarketplaceIntent
} from './marketplace-intents';

describe('marketplace-intents', () => {
  const { Networks, PrivateKey } = bitcore;
  const now = Date.parse('2026-03-10T20:00:00.000Z');
  const privateKeyHex = '1234567890123456789012345678901234567890123456789012345678901234';

  Networks.defaultNetwork = Networks.mainnet;
  const privateKey = new PrivateKey(privateKeyHex);
  const address = privateKey.toAddress().toString();

  const basePayload = (): IntentPayload => ({
    intentType: 'offer_create',
    nonce: 'nonce-1',
    expiresAt: '2026-03-10T20:05:00.000Z',
    network: 'mainnet',
    chainId: 'doge-mainnet',
    address,
    inscriptionId: 'inscription-1',
    offerPriceKoinu: '2500000000',
    marketplaceFeeKoinu: '25000000',
    outputs: [
      {
        address: 'D8k8bN4V1y1Y6kLhN9g9F1H6Gf3f8g2W1U',
        valueKoinu: '2475000000',
        role: 'seller_payout'
      }
    ]
  });

  it('canonicalizes payloads before hashing and signing', async () => {
    const payloadA = basePayload();
    const payloadB: IntentPayload = {
      marketplaceFeeKoinu: '25000000',
      outputs: [
        {
          role: 'seller_payout',
          valueKoinu: '2475000000',
          address: 'D8k8bN4V1y1Y6kLhN9g9F1H6Gf3f8g2W1U'
        }
      ],
      offerPriceKoinu: '2500000000',
      inscriptionId: 'inscription-1',
      address,
      chainId: 'doge-mainnet',
      network: 'mainnet',
      expiresAt: '2026-03-10T20:05:00.000Z',
      nonce: 'nonce-1',
      intentType: 'offer_create'
    };

    const preparedA = prepareMarketplaceIntent(payloadA, {
      expectedAddress: address,
      expectedNetwork: 'mainnet',
      now
    });
    const preparedB = prepareMarketplaceIntent(payloadB, {
      expectedAddress: address,
      expectedNetwork: 'mainnet',
      now
    });

    expect(preparedA.canonicalJson).toBe(preparedB.canonicalJson);
    expect(preparedA.payloadHash).toBe(preparedB.payloadHash);
    expect(hashMarketplaceIntentPayload(payloadA)).toBe(preparedA.payloadHash);

    const signatureA = await signDogecoinMessage(preparedA.canonicalJson, privateKeyHex, 'mainnet');
    const signatureB = await signDogecoinMessage(preparedB.canonicalJson, privateKeyHex, 'mainnet');
    expect(signatureA).toBe(signatureB);
    await expect(verifyDogecoinMessage(address, preparedA.canonicalJson, signatureA, 'mainnet')).resolves.toBe(true);
  });

  it('rejects expired payloads', () => {
    const payload = basePayload();
    payload.expiresAt = '2026-03-10T19:59:59.000Z';

    expect(() =>
      prepareMarketplaceIntent(payload, {
        expectedAddress: address,
        expectedNetwork: 'mainnet',
        now
      })
    ).toThrow(/expired/i);
  });

  it('rejects network mismatches', () => {
    const payload = basePayload();
    payload.network = 'testnet';
    payload.chainId = 'doge-testnet';

    expect(() =>
      prepareMarketplaceIntent(payload, {
        expectedAddress: address,
        expectedNetwork: 'mainnet',
        now
      })
    ).toThrow(/network mismatch/i);
  });

  it('rejects address mismatches', () => {
    const payload = basePayload();
    payload.address = 'D9nJv4Jm4u6k1QQQQQQQQQQQQQQQQQQQQQ';

    expect(() =>
      prepareMarketplaceIntent(payload, {
        expectedAddress: address,
        expectedNetwork: 'mainnet',
        now
      })
    ).toThrow(/active wallet/i);
  });

  it('builds approval summary and signed envelope metadata', async () => {
    const payload = basePayload();
    const summary = buildMarketplaceIntentSummary(payload);
    const prepared = prepareMarketplaceIntent(payload, {
      expectedAddress: address,
      expectedNetwork: 'mainnet',
      now
    });
    const signature = await signDogecoinMessage(prepared.canonicalJson, privateKeyHex, 'mainnet');
    const signed = createSignedMarketplaceIntent(payload, signature, address, {
      expectedNetwork: 'mainnet',
      now
    });

    expect(summary.title).toBe('Create Offer');
    expect(summary.priceKoinu).toBe('2500000000');
    expect(summary.outputs?.[0]?.role).toBe('seller_payout');
    expect(signed.signingAddress).toBe(address);
    expect(signed.signature).toBe(signature);
    expect(signed.payloadHash).toBe(prepared.payloadHash);
    expect(Date.parse(signed.signedAt)).not.toBeNaN();
  });
});
