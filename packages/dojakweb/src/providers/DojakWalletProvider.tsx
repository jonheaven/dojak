'use client';

import React, { useEffect } from 'react';
import { BrowserWalletProvider } from '../contexts/BrowserWalletContext';
import { MyDogeWalletProvider } from '../contexts/MyDogeWalletContext';
import { UnifiedWalletProvider } from '../contexts/UnifiedWalletContext';
import { DogePriceProvider } from '../contexts/DogePriceContext';
import { DojakwebLocaleProvider } from '../contexts/DojakwebLocaleContext';
import { DojakwebFiatProvider } from '../contexts/DojakwebFiatContext';
import { DojakwebThemeProvider, type DojakwebTheme } from '../contexts/DojakwebThemeContext';
import { DataProvider } from './DataProvider';
import { DojakwebDxTrustedOriginsProvider } from '../contexts/DojakwebDxContext';
import { DxHostBridge } from '../components/DxHostBridge';
import { IncomingTxAlerts } from '../components/IncomingTxAlerts';
import { ensureDojakwebEcosystemDefaults } from '../lib/ecosystemDefaults';
import {
  setDojakwebUnlockPersistence,
  type DojakwebUnlockPersistence,
} from '../lib/dojakweb-biometric';

export interface DojakWalletProviderProps {
  children: React.ReactNode;
  /** Backend FX rates for fiat display (e.g. `/api/fx-rates`). */
  fxRatesUrl?: string;
  theme?: DojakwebTheme;
  dxTrustedOrigins?: readonly string[];
  /**
   * `window` (default): keep the unlock across refresh for the Display "stay unlocked" period.
   * `tab`: keep the unlock until this tab closes.
   * `memory`: unlock dies on refresh.
   * Closing the tab ends it. Lock and disconnect still lock immediately.
   * The PIN is never written to localStorage.
   */
  unlockPersistence?: DojakwebUnlockPersistence;
}

/**
 * Slim embeddable provider for host dApps: Dogecoin L1 wallet (Dojak + Doge Soft + local browser + hardware).
 */
export function DojakWalletProvider({
  children,
  fxRatesUrl,
  theme = 'dark',
  dxTrustedOrigins,
  unlockPersistence = 'window',
}: DojakWalletProviderProps) {
  setDojakwebUnlockPersistence(unlockPersistence);

  useEffect(() => {
    ensureDojakwebEcosystemDefaults();
  }, []);

  return (
    <DojakwebThemeProvider theme={theme}>
      <DojakwebDxTrustedOriginsProvider trustedOrigins={dxTrustedOrigins}>
        <DxHostBridge />
        <DogePriceProvider>
          <DojakwebLocaleProvider>
            <DojakwebFiatProvider fxRatesUrl={fxRatesUrl}>
              <MyDogeWalletProvider>
                <BrowserWalletProvider>
                  <UnifiedWalletProvider>
                    <IncomingTxAlerts />
                    <DataProvider>{children}</DataProvider>
                  </UnifiedWalletProvider>
                </BrowserWalletProvider>
              </MyDogeWalletProvider>
            </DojakwebFiatProvider>
          </DojakwebLocaleProvider>
        </DogePriceProvider>
      </DojakwebDxTrustedOriginsProvider>
    </DojakwebThemeProvider>
  );
}

/** @deprecated Prefer `DojakWalletProvider` for new embed integrations. */
export const DojakwebProvider = DojakWalletProvider;
export type DojakwebProviderProps = DojakWalletProviderProps;
