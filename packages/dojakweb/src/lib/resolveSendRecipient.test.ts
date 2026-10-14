import { describe, expect, it } from 'vitest';
import { classifySendRecipient, isDogeDomainName } from './resolveSendRecipient';

describe('isDogeDomainName', () => {
  it('accepts open namespaces including dogefeed', () => {
    expect(isDogeDomainName('billy.dogefeed')).toBe(true);
    expect(isDogeDomainName('jon.doge')).toBe(true);
    expect(isDogeDomainName('satoshi.dogecoin')).toBe(true);
  });

  it('rejects bare labels and bitmap', () => {
    expect(isDogeDomainName('billy')).toBe(false);
    expect(isDogeDomainName('1.bitmap')).toBe(false);
    expect(isDogeDomainName('')).toBe(false);
  });
});

describe('classifySendRecipient', () => {
  it('classifies @handles, domains, and addresses', () => {
    expect(classifySendRecipient('@alice').kind).toBe('dx');
    expect(classifySendRecipient('billy.dogefeed')).toEqual({
      kind: 'dns',
      name: 'billy.dogefeed',
    });
    expect(classifySendRecipient('DHrqn6H6ocgbRB1Szu7Q1sn1tVTfkpinnc').kind).toBe('address');
    expect(classifySendRecipient('').kind).toBe('empty');
  });
});
