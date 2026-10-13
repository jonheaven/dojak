import { beforeEach, describe, expect, it } from 'vitest';

import {
  broadcastTrackedAt,
  isBroadcastStuck,
  listLocalChangeBroadcasts,
  recordPaymentBroadcast,
  STUCK_BOOST_AFTER_MS,
} from './mempoolSpendOverlay';

const ADDR = 'DDMg44HLnLCHsjdviuxfLsqvUJUG7Rmrat';
const PARENT = 'a4c3c6d3fd7c1397e9ad41a2771d48c42de4c4c6ad31e25bf9f6054de483f300';
const OTHER = 'b67ed8ee532669b323f37cab8a33fb7afaf7f848799effafc64ae24cb312910c';

describe('stuck boost window', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps a fresh send quiet and flags it only after the quiet period', () => {
    recordPaymentBroadcast({
      address: ADDR,
      txid: PARENT,
      spent: [{ txid: OTHER, vout: 0 }],
      change: { vout: 1, value: 50_000_000 },
    });

    const at = broadcastTrackedAt(ADDR, PARENT);
    expect(at).not.toBeNull();
    expect(listLocalChangeBroadcasts(ADDR).map((row) => row.txid)).toEqual([PARENT]);
    expect(isBroadcastStuck(ADDR, PARENT, at!)).toBe(false);
    expect(isBroadcastStuck(ADDR, PARENT, at! + STUCK_BOOST_AFTER_MS - 1)).toBe(false);
    expect(isBroadcastStuck(ADDR, PARENT, at! + STUCK_BOOST_AFTER_MS)).toBe(true);
  });
});
