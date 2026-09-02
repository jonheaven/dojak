'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import {
  rejectWalletApproval,
  resolveWalletApproval,
  setWalletApprovalWorking,
  walletApprovalStore,
  type WalletApprovalSession,
} from '../../stores/walletApprovalStore';
import { walletSecretInputProps } from '../../lib/wallet-secret-input';
import { createDojakwebSessionSecretStore } from '../../lib/dojakweb-biometric';
import { NetworkFeeControl } from '../fees/NetworkFeeControl';
import { useDojakwebTheme } from '../../contexts/DojakwebThemeContext';

export type WalletApprovalPanelProps = {
  /**
   * Match the wallet chassis (`DojakwebWalletModal` resolved isDark).
   * When omitted, falls back to DojakwebThemeProvider (host theme / Settings pick).
   */
  isDark?: boolean;
};

/**
 * In-wallet signing modal (extension-style Approve / Reject).
 *
 * Always position:absolute over the wallet chassis via host CSS (.ds-wallet-approval).
 * Never enters document flow / never pushes the main wallet scroll view.
 * Unlock once per tab session — password is not re-prompted until disconnect or tab close.
 */
export function WalletApprovalPanel({ isDark: isDarkProp }: WalletApprovalPanelProps = {}) {
  const { theme } = useDojakwebTheme();
  // Prefer chassis chrome so the sign sheet cannot stay forced-dark while the
  // phone shell (and NetworkFeeControl) are already light.
  const isLight = isDarkProp !== undefined ? !isDarkProp : theme === 'light';
  const pending = useSyncExternalStore(
    walletApprovalStore.subscribe,
    walletApprovalStore.getSnapshot,
    walletApprovalStore.getServerSnapshot,
  );
  const browser = useBrowserWallet();
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  /** Sync guard — React state alone can miss a double-tap before re-render. */
  const approveLockRef = useRef(false);

  const sessionReady = Boolean(browser.wallet?.privateKey?.trim() && browser.address);

  // Mark chassis so host CSS can lock scroll under the overlay.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const chassis = document.querySelector('.ds-wallet-dashboard');
    if (!chassis) return;
    if (pending) {
      chassis.classList.add('ds-wallet-approval-open');
    } else {
      chassis.classList.remove('ds-wallet-approval-open');
    }
    return () => {
      chassis.classList.remove('ds-wallet-approval-open');
    };
  }, [pending]);

  // Reset lock when a new approval request appears.
  useEffect(() => {
    approveLockRef.current = false;
  }, [pending?.id]);

  // If the tab session still has the unlock secret but memory was cleared, rehydrate silently.
  useEffect(() => {
    if (!pending || sessionReady || unlockBusy) return;
    let cancelled = false;
    (async () => {
      try {
        const secret = await createDojakwebSessionSecretStore().getSecret();
        if (!secret || cancelled) return;
        const loaded = await browser.loadWallet(secret, browser.address || undefined);
        if (!loaded?.privateKey || cancelled) return;
        await browser.connect(loaded);
      } catch {
        /* show unlock form */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, sessionReady, unlockBusy, browser]);

  const unlock = useCallback(async () => {
    if (!unlockPassword.trim()) {
      setUnlockError('Enter your wallet password');
      return;
    }
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const secret = unlockPassword.trim();
      const loaded = await browser.loadWallet(secret, browser.address || undefined);
      if (!loaded?.privateKey) {
        throw new Error('Could not unlock wallet');
      }
      await browser.connect(loaded);
      // Keep unlocked for this browser tab until disconnect or tab close.
      try {
        await createDojakwebSessionSecretStore().saveSecret(secret);
      } catch {
        /* best-effort session unlock */
      }
      setUnlockPassword('');
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'Unlock failed');
    } finally {
      setUnlockBusy(false);
    }
  }, [browser, unlockPassword]);

  const onReject = useCallback(() => {
    if (!pending) return;
    // Once signing/broadcast has started, Cancel is too late (tx may already be on-chain).
    if (pending.status === 'working' || approveLockRef.current) return;
    rejectWalletApproval('User rejected the request');
  }, [pending]);

  const onApprove = useCallback(async () => {
    if (!pending) return;
    if (approveLockRef.current || pending.status === 'working') return;
    const wif = browser.wallet?.privateKey?.trim();
    const address = browser.wallet?.address || browser.address;
    if (!wif || !address) {
      setUnlockError('Unlock your Local Browser Wallet first');
      return;
    }
    approveLockRef.current = true;
    setWalletApprovalWorking(true);
    try {
      const session: WalletApprovalSession = { privateKeyWif: wif, address };
      const result = await pending.onApprove(session);
      resolveWalletApproval(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      approveLockRef.current = false;
      setWalletApprovalWorking(false, msg);
    }
  }, [pending, browser.wallet, browser.address]);

  if (!pending) return null;

  const working = pending.status === 'working' || approveLockRef.current;
  const busy = working || unlockBusy;

  return (
    <div
      className={isLight ? 'ds-wallet-approval ds-light' : 'ds-wallet-approval'}
      data-ds-theme={isLight ? 'light' : 'dark'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-approval-title"
    >
      <div className="ds-wallet-approval__header">
        <p className="ds-wallet-approval__eyebrow">Signature request</p>
        <h2 id="wallet-approval-title" className="ds-wallet-approval__title">
          {pending.title}
        </h2>
        {pending.description ? (
          <p className="ds-wallet-approval__desc">{pending.description}</p>
        ) : null}
      </div>

      <div className="ds-wallet-approval__body">
        {pending.psbtAudit ? (
          <div
            className={
              pending.psbtAudit.intent === 'unverified' || pending.psbtAudit.risk === 'critical'
                ? 'ds-wallet-approval__psbt-audit ds-wallet-approval__psbt-audit--critical'
                : pending.psbtAudit.intent === 'decoded' || pending.psbtAudit.risk === 'warn'
                  ? 'ds-wallet-approval__psbt-audit ds-wallet-approval__psbt-audit--warn'
                  : 'ds-wallet-approval__psbt-audit'
            }
          >
            {pending.psbtAudit.intent === 'unverified' || pending.psbtAudit.risk === 'critical' ? (
              <div className="ds-wallet-approval__redflag" role="alert">
                <p className="ds-wallet-approval__redflag-title">
                  Unverified — PSBT does not match expected intent
                </p>
                <p className="ds-wallet-approval__redflag-body">
                  Trust the decoded transaction below, not the site description. Approve at your own
                  risk.
                </p>
                {pending.psbtAudit.mismatches.length > 0 ? (
                  <ul className="ds-wallet-approval__redflag-list">
                    {pending.psbtAudit.mismatches.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : pending.psbtAudit.intent === 'verified' ? (
              <p className="ds-wallet-approval__psbt-ok">
                Verified intent — decoded PSBT matches the site&apos;s claimed destinations/amounts.
                Values below are from the transaction bytes.
              </p>
            ) : (
              <div className="ds-wallet-approval__redflag" role="status">
                <p className="ds-wallet-approval__redflag-title">
                  Decoded only — no independent intent claims
                </p>
                <p className="ds-wallet-approval__redflag-body">
                  The wallet decoded this PSBT, but the site did not supply verifiable claims. Review
                  every output carefully before approving — this is not a cryptographic match against
                  expected recipients.
                </p>
                {pending.psbtAudit.mismatches.length > 0 ? (
                  <ul className="ds-wallet-approval__redflag-list">
                    {pending.psbtAudit.mismatches.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            <p className="ds-wallet-approval__section-label">Transaction (from PSBT)</p>
            <dl className="ds-wallet-approval__details ds-wallet-approval__details--psbt">
              {pending.psbtAudit.summaryRows.map((row) => (
                <div key={`psbt:${row.label}:${row.value}`} className="ds-wallet-approval__detail-row">
                  <dt className="ds-wallet-approval__detail-label">{row.label}</dt>
                  <dd className="ds-wallet-approval__detail-value">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {pending.details && pending.details.length > 0 ? (
          <>
            <p className="ds-wallet-approval__section-label">
              {pending.psbtAudit ? 'Site says' : 'Details'}
            </p>
            <dl className="ds-wallet-approval__details">
              {pending.details.map((row) => (
                <div key={`${row.label}:${row.value}`} className="ds-wallet-approval__detail-row">
                  <dt className="ds-wallet-approval__detail-label">{row.label}</dt>
                  <dd className="ds-wallet-approval__detail-value">{row.value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}

        {!sessionReady ? (
          <div className="ds-wallet-approval__unlock">
            <p className="ds-wallet-approval__unlock-title">
              Unlock Local Browser Wallet to approve
            </p>
            <input
              type="password"
              className="ds-wallet-approval__input"
              placeholder="Wallet password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void unlock();
              }}
              disabled={busy}
              {...walletSecretInputProps('dojakweb-approval-unlock')}
            />
            {unlockError ? <p className="ds-wallet-approval__error">{unlockError}</p> : null}
            <button
              type="button"
              className="ds-wallet-approval__btn-unlock"
              disabled={busy}
              onClick={() => void unlock()}
            >
              {unlockBusy ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        ) : (
          <p className="ds-wallet-approval__session">
            Unlocked · {browser.address?.slice(0, 8)}…{browser.address?.slice(-6)}
          </p>
        )}

        {pending.status === 'error' && pending.error ? (
          <p className="ds-wallet-approval__tx-error">{pending.error}</p>
        ) : null}

        <div className="ds-wallet-approval__fee">
          <NetworkFeeControl compact tone="wallet" disabled={working} />
        </div>

        <p className="ds-wallet-approval__hint">
          Only approve if you trust this site. Approving signs and may broadcast a Dogecoin
          transaction from your Local Browser Wallet.
        </p>
      </div>

      <div className="ds-wallet-approval__footer">
        <button
          type="button"
          className="ds-wallet-approval__btn-reject"
          disabled={busy}
          aria-disabled={working}
          title={
            working
              ? 'Signing already started — Cancel is unavailable once broadcast may be on-chain'
              : undefined
          }
          onClick={onReject}
        >
          {pending.rejectLabel || 'Reject'}
        </button>
        <button
          type="button"
          className="ds-wallet-approval__btn-approve"
          disabled={busy || !sessionReady}
          aria-busy={working}
          onClick={() => void onApprove()}
        >
          {working ? 'Signing…' : pending.approveLabel || 'Approve'}
        </button>
      </div>
      {working ? (
        <p className="ds-wallet-approval__hint" style={{ marginTop: '0.5rem', opacity: 0.85 }}>
          Do not close this wallet — broadcast may already be on-chain.
        </p>
      ) : null}
    </div>
  );
}
