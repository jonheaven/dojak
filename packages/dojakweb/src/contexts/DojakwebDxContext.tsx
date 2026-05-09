'use client';

import React, { createContext, useContext, useMemo } from 'react';

const Ctx = createContext<readonly string[]>([]);

export function DojakwebDxTrustedOriginsProvider({
  children,
  trustedOrigins,
}: {
  children: React.ReactNode;
  /** Origins allowed to post Ð𝕏 requests (e.g. `https://your-site.com`). Same-origin is always allowed. */
  trustedOrigins?: readonly string[];
}) {
  const value = useMemo(() => Object.freeze([...(trustedOrigins ?? [])] as string[]), [trustedOrigins]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDojakwebDxTrustedOrigins(): readonly string[] {
  return useContext(Ctx);
}
