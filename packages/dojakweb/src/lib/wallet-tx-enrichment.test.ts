import { describe, expect, it } from 'vitest';
import {
  inscriptionFaceFromWalletTx,
  inscriptionMoveEnrichment,
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

  it('ignores sales', () => {
    expect(
      inscriptionMoveEnrichment(TXID, { ...transferRow, kind: 'marketplace_sale' }),
    ).toBeNull();
  });
});
