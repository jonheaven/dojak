import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';

import { DojakWallet, WalletCoreProvider } from '@dojak/ui';
import type { DxPendingAction } from '@dojak/core/dx';
import { DX_PENDING_CHANGED } from '@dojak/core/dx';
import '@dojak/ui/src/styles/global.less';

import { clearPendingAction, getPendingAction } from './dx/api';
import { DxLinkScreen } from './dx/DxLinkScreen';
import { DxTipScreen } from './dx/DxTipScreen';
import { createPopupAdapter } from './walletAdapter';
import './dx/dx.css';

type View = 'wallet' | 'tip' | 'link';

const adapter = createPopupAdapter();

function PopupApp() {
  const [view, setView] = useState<View>('wallet');
  const [pending, setPending] = useState<DxPendingAction | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
    void getPendingAction()
      .then((action) => {
        if (cancelled) return;
        setPending(action);
        if (action?.type === 'tip') setView('tip');
        else if (action?.type === 'link') setView('link');
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    };
    load();
    const onMsg = (message: { type?: string }) => {
      if (message?.type === DX_PENDING_CHANGED) load();
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(onMsg);
    };
  }, []);

  const back = async () => {
    await clearPendingAction().catch(() => undefined);
    setPending(null);
    setView('wallet');
  };

  const body = useMemo(() => {
    if (!ready) {
      return (
        <div className="dx-root">
          <div className="dx-shell">
            <p className="dx-kicker">Dojak</p>
            <h1 className="dx-title">Opening Ð𝕏…</h1>
          </div>
        </div>
      );
    }
    if (view === 'tip' && pending) {
      return <DxTipScreen action={pending} adapter={adapter} onBack={() => void back()} />;
    }
    if (view === 'link') {
      return <DxLinkScreen action={pending} adapter={adapter} onBack={() => void back()} />;
    }
    return (
      <div>
        <div className="dx-mini">
          <p className="dx-mini-copy">Ð𝕏 on 𝕏 · tip posts · link your profile</p>
          <button type="button" className="dx-mini-btn" onClick={() => setView('link')}>
            Link Ð𝕏
          </button>
        </div>
        <WalletCoreProvider adapter={adapter}>
          <DojakWallet />
        </WalletCoreProvider>
      </div>
    );
  }, [ready, view, pending]);

  return <div className="mx-auto w-full max-w-[402px] overflow-y-auto" style={{ maxHeight: 640 }}>{body}</div>;
}

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(<PopupApp />);
}
