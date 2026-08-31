/**
 * Ðune etch / mint / send must go through the same MetaMask-style drawer as
 * dogecoin.games bets and Ðalkanes deploy — never silent-sign with an unlocked WIF.
 */
import {
  isWalletApprovalCancelled,
  requestWalletApproval,
  WalletApprovalCancelledError,
} from '../stores/walletApprovalStore';
import type { DuneTxSigner, DuneTxSignerResult } from './dune-tx-signer';

export type DuneApprovalDetail = { label: string; value: string };

export async function runDuneTxWithWalletApproval<T>(opts: {
  /** Preflight resolve (address / extension PSBT capability). */
  resolved: DuneTxSignerResult;
  /** Prefer local-browser approval when the active path is in-browser. */
  preferBrowserApproval: boolean;
  title: string;
  description: string;
  details: DuneApprovalDetail[];
  approveLabel: string;
  /** Local Browser Wallet path — receives unlocked session WIF after Approve. */
  runWithLocalWif: (signer: DuneTxSigner) => Promise<T>;
  /** Extension / PSBT path (Dojak, Doge Soft). */
  runWithResolvedSigner: (signer: DuneTxSigner) => Promise<T>;
}): Promise<T> {
  if (!opts.resolved.ok) {
    throw new Error(opts.resolved.message);
  }

  const signer = opts.resolved.signer;
  const useLocalApproval =
    opts.preferBrowserApproval || Boolean(signer.privateKeyWIF);

  if (useLocalApproval) {
    return (await requestWalletApproval({
      title: opts.title,
      description: opts.description,
      details: opts.details,
      approveLabel: opts.approveLabel,
      rejectLabel: 'Reject',
      onApprove: async (session) =>
        opts.runWithLocalWif({
          fromAddress: session.address,
          privateKeyWIF: session.privateKeyWif,
        }),
    })) as T;
  }

  return opts.runWithResolvedSigner(signer);
}

export function duneApprovalUserError(err: unknown, fallback: string): string | null {
  if (isWalletApprovalCancelled(err) || err instanceof WalletApprovalCancelledError) {
    return null;
  }
  return err instanceof Error ? err.message : fallback;
}
