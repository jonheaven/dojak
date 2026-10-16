import React, { CSSProperties, useEffect } from 'react';

import { routes } from '@dojak/ui/pages/MainRoute';
import { useBooted, useIsUnlocked } from '@dojak/ui/state/global/hooks';
import { getUiType } from '@dojak/ui/utils';

import './index.less';

export interface LayoutProps {
  children?: React.ReactNode;
  style?: CSSProperties;
}
export function Layout(props: LayoutProps) {
  const isBooted = useBooted();
  const isUnlocked = useIsUnlocked();

  useEffect(() => {
    // Don't redirect to unlock screen if we're on welcome/setup screens
    // (user might have set password but not completed wallet creation)
    const isOnWelcomeScreen = location.href.includes(routes.WelcomeScreen.path);
    const isOnCreatePasswordScreen = location.href.includes(routes.CreatePasswordScreen.path);
    const isOnCreateHDWalletScreen = location.href.includes(routes.CreateHDWalletScreen.path);
    const isOnUnlockScreen = location.href.includes(routes.UnlockScreen.path);

    const isOnSetupFlow = isOnWelcomeScreen || isOnCreatePasswordScreen || isOnCreateHDWalletScreen;

    if (isBooted && !isUnlocked && !isOnUnlockScreen && !isOnSetupFlow) {
      const basePath = location.href.split('#')[0];
      location.href = `${basePath}#${routes.UnlockScreen.path}`;
      return;
    }
  }, [isBooted, isUnlocked]);

  const { children, style: $styleBase } = props;
  const isSidePanel = getUiType().isSidePanel;
  return (
    <div
      className="layout"
      style={Object.assign(
        {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: isSidePanel ? '100%' : '100vh',
          minHeight: isSidePanel ? '100%' : '600px',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: 'var(--theme-background, #0b0b0c)'
        },
        $styleBase
      )}
    >
      {children}
    </div>
  );
}
