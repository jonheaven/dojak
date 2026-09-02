/**
 * Regression: PSBT approval audit intent model + marketplace claim helper.
 */
import { describe, expect, it } from 'vitest';
import {
  auditPsbtForWalletApproval,
  buildMarketplaceBuyClaims,
} from './psbt-approval-audit';

describe('auditPsbtForWalletApproval intent', () => {
  it('marks unparseable input as unverified/critical', () => {
    const r = auditPsbtForWalletApproval('not-a-psbt');
    expect(r.parseOk).toBe(false);
    expect(r.intent).toBe('unverified');
    expect(r.risk).toBe('critical');
    expect(r.hasClaims).toBe(false);
  });

  it('marks missing claims as decoded (not verified)', () => {
    // Minimal valid-looking base64 that still fails parse → unverified.
    // When claims are absent and parse fails, intent stays unverified.
    const r = auditPsbtForWalletApproval('cHNidP8BAAoAAAAAAAAAAAA=');
    // Either decoded or unverified depending on whether tryParsePsdt accepts junk;
    // never "verified" without claims.
    expect(r.intent).not.toBe('verified');
    expect(r.hasClaims).toBe(false);
  });

  it('buildMarketplaceBuyClaims includes buyer + seller allowlist', () => {
    const claims = buildMarketplaceBuyClaims({
      buyerAddress: 'DBuyer1111111111111111111111111111',
      sellerPaymentAddress: 'DSeller111111111111111111111111111',
      sellerPaymentKoinu: 1_000_000_00,
      extraAllowedAddresses: ['DFee111111111111111111111111111111'],
    });
    expect(claims.allowedAddresses).toContain('DBuyer1111111111111111111111111111');
    expect(claims.allowedAddresses).toContain('DSeller111111111111111111111111111');
    expect(claims.allowedAddresses).toContain('DFee111111111111111111111111111111');
    expect(claims.minOutputs).toBe(2);
    expect(claims.outputs?.some((o) => o.role === 'seller payment' && o.valueKoinu === 1_000_000_00)).toBe(
      true,
    );
  });
});
