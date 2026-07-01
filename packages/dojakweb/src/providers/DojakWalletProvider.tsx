'use client';

import React from 'react';
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
import {
  DojakwebFeaturesProvider,
  type DojakwebFeatures,
} from '../contexts/DojakwebFeaturesContext';

export interface DojakWalletProviderProps {
  children: React.ReactNode;
  /** Backend FX rates for fiat display (e.g. `/api/fx-rates`). */
  fxRatesUrl?: string;
  theme?: DojakwebTheme;
  dxTrustedOrigins?: readonly string[];
  /** Default `{ dogeosEvm: false }` — L1 wallet only unless you opt into DogeOS. */
  features?: Partial<DojakwebFeatures>;
}

/**
 * Slim embeddable provider for host dApps: Dojak + MyDoge + SpookyDoge + browser wallet,
 * without Charms / LiveActivity / DoginalDrawer stacks.
 */
export function DojakWalletProvider({
  children,
  fxRatesUrl,
  theme = 'dark',
  dxTrustedOrigins,
  features,
}: DojakWalletProviderProps) {
  return (
    <DojakwebThemeProvider theme={theme}>
      <DojakwebFeaturesProvider features={{ dogeosEvm: false, ...features }}>
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
      </DojakwebFeaturesProvider>
    </DojakwebThemeProvider>
  );
}

/** @deprecated Prefer `DojakWalletProvider` for new embed integrations. */
export const DojakwebProvider = DojakWalletProvider;
export type DojakwebProviderProps = DojakWalletProviderProps;
