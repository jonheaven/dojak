'use client';

import React, { createContext, useContext, useMemo } from 'react';

export interface DojakwebFeatures {
  /**
   * When false (default), DogeOS / EVM ecosystem UI (toggles, balance hydrator, chain badges for DogeOS)
   * is hidden and related async code is not loaded until the user could enable it.
   * Pure Dogecoin L1 dApps should leave this off.
   */
  dogeosEvm: boolean;
}

const DEFAULT_FEATURES: DojakwebFeatures = {
  dogeosEvm: false,
};

const DojakwebFeaturesContext = createContext<DojakwebFeatures>(DEFAULT_FEATURES);

export function DojakwebFeaturesProvider({
  children,
  features,
}: {
  children: React.ReactNode;
  /** Partial overrides; defaults: dogeosEvm: false */
  features?: Partial<DojakwebFeatures>;
}) {
  const dogeosEvm = features?.dogeosEvm ?? DEFAULT_FEATURES.dogeosEvm;
  const value = useMemo<DojakwebFeatures>(
    () => ({
      ...DEFAULT_FEATURES,
      ...features,
      dogeosEvm,
    }),
    [dogeosEvm, features],
  );
  return <DojakwebFeaturesContext.Provider value={value}>{children}</DojakwebFeaturesContext.Provider>;
}

export function useDojakwebFeatures(): DojakwebFeatures {
  return useContext(DojakwebFeaturesContext);
}
