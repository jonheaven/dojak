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
import { ensureDojakwebEcosystemDefaults } from '../lib/ecosystemDefaults';

export interface DojakWalletProviderProps {
  children: React.ReactNode;
  /** Backend FX rates for fiat display (e.g. `/api/fx-rates`). */
  fxRatesUrl?: string;
  theme?: DojakwebTheme;
  dxTrustedOrigins?: readonly string[];
}

/**
 * Slim embeddable provider for host dApps: Dogecoin L1 wallet (Dojak + Doge Soft + local browser + hardware).
 */
export function DojakWalletProvider({
  children,
  fxRatesUrl,
  theme = 'dark',
  dxTrustedOrigins,
}: DojakWalletProviderProps) {
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
