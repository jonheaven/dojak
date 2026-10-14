import { beforeEach, describe, expect, it } from 'vitest';
import {
  broadcastTrackedAt,
  findBroadcastForSpentInputs,
  forgetBroadcast,
  isBroadcastStuck,
  listRecentBroadcastTxids,
  recordPaymentBroadcast,
  rememberCpfpChild,
  resolveStoredBoost,
  STUCK_BOOST_AFTER_MS,
} from './mempoolSpendOverlay';

const ADDR = 'DDMg44HLnLCHsjdviuxfLsqvUJUG7Rmrat';
const PARENT = 'a4c3c6d3fd7c1397e9ad41a2771d48c42de4c4c6ad31e25bf9f6054de483f300';
const CHILD = '4c8d2a1b2c885d4a8ae38fac08a82b46380b8981bbef350f8676aa24278c5f6c';
const OTHER = 'b67ed8ee532669b323f37cab8a33fb7afaf7f848799effafc64ae24cb312910c';

describe('pending broadcast log', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the broadcast txid for the boost field after the session overlay is gone', () => {
    recordPaymentBroadcast({
      address: ADDR,
      txid: PARENT,
      spent: [{ txid: OTHER, vout: 1 }],
      change: { vout: 1, value: 11_552_740_442 },
    });

    expect(listRecentBroadcastTxids(ADDR)[0]).toBe(PARENT);
    expect(findBroadcastForSpentInputs(ADDR, [{ txid: OTHER, vout: 1 }])).toBe(PARENT);
    expect(findBroadcastForSpentInputs(ADDR, [{ txid: OTHER, vout: 0 }])).toBeNull();
  });

  it('treats a stored speed-up as finished for both the parent and the child id', () => {
    rememberCpfpChild(PARENT, CHILD);
    expect(resolveStoredBoost(PARENT)).toEqual({ parentTxid: PARENT, childTxid: CHILD });
    expect(resolveStoredBoost(CHILD)).toEqual({ parentTxid: PARENT, childTxid: CHILD });
    expect(resolveStoredBoost(OTHER)).toBeNull();
  });

  it('does not treat a fresh send as stuck', () => {
    recordPaymentBroadcast({
      address: ADDR,
      txid: PARENT,
      spent: [{ txid: OTHER, vout: 0 }],
      change: { vout: 1, value: 50_000_000 },
    });
    const at = broadcastTrackedAt(ADDR, PARENT);
    expect(at).not.toBeNull();
    expect(isBroadcastStuck(ADDR, PARENT, at!)).toBe(false);
    expect(isBroadcastStuck(ADDR, PARENT, at! + STUCK_BOOST_AFTER_MS - 1)).toBe(false);
    expect(isBroadcastStuck(ADDR, PARENT, at! + STUCK_BOOST_AFTER_MS)).toBe(true);
    expect(isBroadcastStuck(ADDR, undefined, at!)).toBe(false);
    expect(isBroadcastStuck(ADDR, undefined, at! + STUCK_BOOST_AFTER_MS)).toBe(true);
  });

  it('drops a broadcast once it is forgotten', () => {
    recordPaymentBroadcast({
      address: ADDR,
      txid: PARENT,
      spent: [],
      change: null,
    });
    forgetBroadcast(ADDR, PARENT);
    expect(listRecentBroadcastTxids(ADDR)).toEqual([]);
  });
});
