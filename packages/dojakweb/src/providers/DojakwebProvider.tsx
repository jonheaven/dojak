'use client';

import React from 'react';
import { BrowserWalletProvider } from '../contexts/BrowserWalletContext';
import { MyDogeWalletProvider } from '../contexts/MyDogeWalletContext';
import { UnifiedWalletProvider } from '../contexts/UnifiedWalletContext';
import { DogePriceProvider } from '../contexts/DogePriceContext';
import { DojakwebLocaleProvider } from '../contexts/DojakwebLocaleContext';
import { DojakwebFiatProvider } from '../contexts/DojakwebFiatContext';
import { DojakwebThemeProvider, type DojakwebTheme } from '../contexts/DojakwebThemeContext';
import { DoginalDrawerProvider } from '../contexts/DoginalDrawerContext';
import { LiveActivityProvider } from '../contexts/LiveActivityContext';
import { CharmsProvider } from '../contexts/CharmsContext';
import { DataProvider } from './DataProvider';
import { DojakwebDxTrustedOriginsProvider } from '../contexts/DojakwebDxContext';
import { DxHostBridge } from '../components/DxHostBridge';

export interface DojakwebProviderProps {
  children: React.ReactNode;
  /**
   * When set (e.g. `"/api/fx-rates"`), fetches live USD→fiat rates from your backend for bracket amounts.
   * Omit for Dojakweb-only apps; static fallback multipliers are still used.
   */
  fxRatesUrl?: string;
  /**
   * UI theme for the wallet modal and connection picker.
   * Defaults to 'dark'. Set to 'light' when the host app uses a light theme.
   */
  theme?: DojakwebTheme;
  /**
   * Extra origins allowed to `postMessage` Ð𝕏 verification requests into Dojakweb.
   * Same-origin is always trusted.
   */
  dxTrustedOrigins?: readonly string[];
}

/** Full Dojakweb provider stack — Dogecoin L1 only. */
export function DojakwebProvider({
  children,
  fxRatesUrl,
  theme = 'dark',
  dxTrustedOrigins,
}: DojakwebProviderProps) {
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
                    <DoginalDrawerProvider>
                      <LiveActivityProvider>
                        <CharmsProvider>
                          <DataProvider>{children}</DataProvider>
                        </CharmsProvider>
                      </LiveActivityProvider>
                    </DoginalDrawerProvider>
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
