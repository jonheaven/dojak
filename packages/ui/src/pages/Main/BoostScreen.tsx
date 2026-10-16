import { useEffect, useState } from 'react';

import { getUiType, useApproval, useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../MainRoute';
import '../wallet-surfaces.css';

export default function BoostScreen() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const [getApproval, , rejectApproval] = useApproval();
  const [status, setStatus] = useState('Opening your wallet…');

  const loadView = async () => {
    const UIType = getUiType();
    const isInNotification = UIType.isNotification;
    const isInSidePanel = UIType.isSidePanel;

    // The toolbar opens the side panel. A leftover popup should hand off, not
    // clear the side-panel preference or dump the user into wallet creation.
    if (UIType.isPop && !isInSidePanel) {
      try {
        const docked = await wallet.getOpenInSidePanel();
        const sidePanel = (chrome as { sidePanel?: { open: (opts: { windowId?: number }) => Promise<void> } }).sidePanel;
        if (docked !== false && sidePanel?.open) {
          const windowId = (await chrome.windows.getCurrent()).id;
          await sidePanel.open({ windowId });
          window.close();
          return;
        }
      } catch (error) {
        console.error('Failed to open the side panel:', error);
      }
    }

    let approval = await getApproval();
    if (isInNotification && !approval) {
      window.close();
      return;
    }

    if (!isInNotification) {
      await rejectApproval();
      approval = undefined;
    }

    const hasVault = await wallet.hasVault();
    const isBooted = await wallet.isBooted();
    const isUnlocked = await wallet.isUnlocked();

    if (!hasVault || !isBooted) {
      navigate('WelcomeScreen');
      return;
    }

    if (!isUnlocked) {
      navigate('UnlockScreen');
      return;
    }

    const currentAccount = await wallet.getCurrentAccount();
    if (!currentAccount) {
      navigate('WelcomeScreen');
      return;
    }
    if (approval) {
      navigate('ApprovalScreen');
      return;
    }
    navigate('MainScreen');
  };

  const init = async () => {
    try {
      const ready = await wallet.isReady();
      if (ready) {
        await loadView();
      } else {
        setTimeout(() => {
          void init();
        }, 400);
      }
    } catch (error) {
      console.error('Wallet boot failed', error);
      setStatus('Could not open the wallet. Reload the side panel.');
    }
  };

  useEffect(() => {
    void init();
  }, []);

  return (
    <div className="dj-boot">
      <strong>Dojak</strong>
      <span>{status}</span>
    </div>
  );
}
