import React from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';

interface OwnershipFlowProps {
  drawerData: any;
}

export const OwnershipFlow: React.FC<OwnershipFlowProps> = ({ drawerData }) => {
  const connectedAddress = useConnectedWalletAddress();

  // Mock ownership history - in real implementation this would come from indexer
  const getOwnershipHistory = () => {
    const history = [];

    // Add original minter
    if (drawerData.type === 'inscription-mint') {
      history.push({
        address: 'DoriginalMinter123',
        action: 'Minted',
        timestamp: '2024-01-24 10:00',
        isConnected: false
      });
    }

    // Add current transaction
    if (drawerData.from) {
      history.push({
        address: drawerData.from,
        action: 'Transferred',
        timestamp: '2024-01-24 11:41',
        isConnected: connectedAddress && drawerData.from.toLowerCase() === connectedAddress.toLowerCase()
      });
    }

    if (drawerData.to) {
      history.push({
        address: drawerData.to,
        action: 'Received',
        timestamp: '2024-01-24 11:41',
        isConnected: connectedAddress && drawerData.to.toLowerCase() === connectedAddress.toLowerCase()
      });
    }

    return history;
  };

  const history = getOwnershipHistory();

  if (history.length <= 1) {
    return (
      <div className="text-text-secondary italic text-center py-4">
        Ownership history loading...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-text-primary mb-3">Ownership Flow</div>

      <div className="flex items-center space-x-3 overflow-x-auto pb-2">
        {history.map((entry, index) => (
          <React.Fragment key={index}>
            <div className={`flex-shrink-0 p-3 rounded-lg border-2 min-w-[120px] text-center ${
              entry.isConnected
                ? 'border-emerald-500 bg-emerald-900/20'
                : 'border-border-primary bg-bg-secondary'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                entry.isConnected ? 'text-emerald-300' : 'text-text-secondary'
              }`}>
                {entry.action}
              </div>
              <div className={`text-xs font-mono ${
                entry.isConnected ? 'text-emerald-200' : 'text-text-primary'
              }`}>
                {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {entry.timestamp}
              </div>
              {entry.isConnected && (
                <div className="text-xs text-emerald-400 font-medium mt-1">
                  YOU
                </div>
              )}
            </div>

            {index < history.length - 1 && (
              <ArrowRightIcon className="w-5 h-5 text-text-secondary flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
