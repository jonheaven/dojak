import type { DoginalChainResult } from '../dogetag/doginal-chain';
import { broadcastTxWithStatus } from '../broadcast/doge-chain-broadcast';

export function isBroadcastInputRejected(msg: string): boolean {
  const lc = msg.toLowerCase();
  return (
    lc.includes('already been spent') ||
    lc.includes('missing inputs') ||
    lc.includes('bad-txns-inputs-missingorspent') ||
    lc.includes('missingorspent')
  );
}

export function isMempoolChainLimitError(msg: string): boolean {
  const lc = msg.toLowerCase();
  return lc.includes('too-long-mempool-chain') || lc.includes('mempool chain');
}

/**
 * Broadcast every stage of a signed doginals chain in order (same pattern as Inscribe page).
 */
export async function broadcastSignedDoginalChain(plan: DoginalChainResult): Promise<void> {
  for (let i = 0; i < plan.stages.length; i++) {
    const st = plan.stages[i]!;
    await broadcastTxWithStatus(st.txHex, () => {});
  }
}
