import { describe, expect, it } from 'vitest';
import { classifyDnsInscription, extractInscriptionTexts } from './incoming-tx-alerts';
import {
  enrichmentFromRevealHex,
  inscriptionFaceFromWalletTx,
  inscriptionMoveEnrichment,
  withDnsRegisterLabel,
} from './wallet-tx-enrichment';

const TXID = '0c9ca1be145f18cf52a8183ad121d844b6617daf63ef53758be9756f99199de6';

const transferRow = {
  kind: 'transfer',
  seller: 'DDMg44HLnLCHsjdviuxfLsqvUJUG7Rmrat',
  buyer: 'DMwRU8ynGuo9TKWiVMhCmn2TpKHVGGqzoB',
  summary: 'Inscription transfer · DDMg44…mrat → DMwRU8…qzoB',
  nfts: [
    {
      inscriptionId: '4c0fc472c401b5d3f512378fee56ca9c32da39843e04f44a4fb61f5eb5b86546i0',
      postageKoinu: '100000',
      media: {
        doggyCdn:
          'https://cdn.doggy.market/content/4c0fc472c401b5d3f512378fee56ca9c32da39843e04f44a4fb61f5eb5b86546i0',
      },
    },
  ],
};

describe('inscriptionMoveEnrichment', () => {
  it('labels a postage transfer with the inscription body', () => {
    const row = inscriptionMoveEnrichment(TXID, transferRow, {
      contentType: 'text/plain',
      contentPreview: 'ren.dogecoin',
    });
    expect(row?.protocol).toBe('doginals');
    expect(row?.actionLabel).toBe('Send');
    expect(row?.title).toBe('ren.dogecoin');
    expect(row?.summary).toMatch(/Inscription transfer/);
    expect(row?.metadata?.postageDoge).toBeCloseTo(0.001);
    expect(row?.metadata?.recipientAddress).toBe('DMwRU8ynGuo9TKWiVMhCmn2TpKHVGGqzoB');
    const face = inscriptionFaceFromWalletTx({ journal: { metadata: row?.metadata } });
    expect(face?.contentPreview).toBe('ren.dogecoin');
    expect(face?.inscriptionId).toMatch(/i0$/);
  });

  it('labels a bulk-mint DNS reveal as a received doginal register', () => {
    const hex =
      '01000000014ae6bf7ad3907f3a91fec7cab5e6199125329ce23ceef5daad1be68bed23f9480700000092036f7264510a746578742f706c61696e000d6a6f7368776973652e646f6765483045022100cd6ce5a828ffd648635f90ac9603c766abfa2ca79ed7947687cc63a4d7f95a2c022038a09e508148aac0434333631f4787f8141f3d712a3f986803c4bf528c71b570012921036f1626cfad24d586e3c9b8b18ac0807f3c05b2952ea8d135a3a1fbea7e249c33ad757575757551fdffffff02a0860100000000001976a9145a21f9448e65dc1657385e2b79fb08590845a6cf88ac80778e06000000001976a9142531759f79efa60c2c4e6d9327307a6c9658e8c388ac00000000';
    const bodies = extractInscriptionTexts(hex);
    expect(bodies[0]?.contentType).toBe('text/plain');
    expect(bodies[0]?.text).toBe('joshwise.doge');
    expect(classifyDnsInscription(bodies[0]!.text, bodies[0]!.contentType)?.kind).toBe('name');
    const row = enrichmentFromRevealHex(
      'd2982336ba69d596b2fc72817d0b66fe429cc01fbe408015849d1e1b158b7fdb',
      hex,
    );
    expect(row?.protocol).toBe('dns');
    expect(row?.action).toBe('register');
    expect(row?.actionLabel).toBe('Register');
    expect(row?.title).toBe('joshwise.doge');
    expect(row?.summary).toBe('Received doginal');
    expect(row?.metadata?.inscriptionId).toBe(
      'd2982336ba69d596b2fc72817d0b66fe429cc01fbe408015849d1e1b158b7fdbi0',
    );
    const face = inscriptionFaceFromWalletTx({ journal: { metadata: row?.metadata } });
    expect(face?.contentPreview).toBe('joshwise.doge');
    expect(face?.postageDoge).toBeCloseTo(0.001);
  });

  it('promotes a plaintext name transfer to a DNS register', () => {
    const moved = inscriptionMoveEnrichment(TXID, transferRow, {
      contentType: 'text/plain',
      contentPreview: 'ren.dogecoin',
    });
    const row = moved ? withDnsRegisterLabel(moved) : null;
    expect(row?.protocol).toBe('dns');
    expect(row?.title).toBe('ren.dogecoin');
    expect(row?.summary).toBe('Received doginal');
    expect(row?.actionLabel).toBe('Register');
  });

  it('ignores sales', () => {
    expect(
      inscriptionMoveEnrichment(TXID, { ...transferRow, kind: 'marketplace_sale' }),
    ).toBeNull();
  });
});
