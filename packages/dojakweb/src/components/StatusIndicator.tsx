import React, { useState } from 'react';
import { CircleStackIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useConfig } from '../utils/providers/ConfigProvider';
import { ProviderSettingsModal } from './ProviderSettingsModal';

interface StatusIndicatorProps {
  compact?: boolean;
  showSettings?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  compact = false,
  showSettings = true
}) => {
  const { status, testConnection, isLoading } = useConfig();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const providers: Array<{ key: keyof typeof status; label: string; description: string }> = [
    { key: 'local', label: 'Local RPC', description: 'Local Dogecoin node' },
    { key: 'mydoge', label: 'Indexer API', description: 'External indexer gateway' },
    { key: 'custom', label: 'Custom RPC', description: 'Custom Dogecoin node' }
  ];

  const getStatusColor = (status: 'green' | 'red' | 'unknown') => {
    switch (status) {
      case 'green': return 'text-green-500';
      case 'red': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: 'green' | 'red' | 'unknown') => {
    switch (status) {
      case 'green': return 'Online';
      case 'red': return 'Offline';
      default: return 'Testing...';
    }
  };

  const handleTestConnection = async (provider: keyof typeof status) => {
    setTestingProvider(provider);
    try {
      const result = await testConnection(provider);
      // Result is already handled by the context
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingProvider(null);
    }
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg border border-border-primary">
          <div className="flex items-center gap-3">
            {providers.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <CircleStackIcon
                  className={`w-4 h-4 ${getStatusColor(status[key])} ${testingProvider === key ? 'animate-pulse' : ''}`}
                />
                <span className="text-xs font-medium text-text-secondary">
                  {label.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          {showSettings && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1 hover:bg-bg-primary rounded transition-colors"
              title="Configure providers"
            >
              <Cog6ToothIcon className="w-4 h-4 text-text-tertiary hover:text-text-secondary" />
            </button>
          )}
        </div>

        <ProviderSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">API Connection Status</h3>
          {showSettings && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded-md transition-colors"
            >
              <Cog6ToothIcon className="w-4 h-4" />
              Settings
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {providers.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-bg-primary rounded-lg border border-border-primary">
              <div className="flex items-center gap-3">
                <CircleStackIcon
                  className={`w-6 h-6 ${getStatusColor(status[key])} ${testingProvider === key ? 'animate-pulse' : ''}`}
                />
                <div>
                  <div className="font-medium text-text-primary">{label}</div>
                  <div className="text-sm text-text-secondary">{description}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${getStatusColor(status[key])}`}>
                  {getStatusText(status[key])}
                </span>
                <button
                  onClick={() => handleTestConnection(key)}
                  disabled={testingProvider === key || isLoading}
                  className="px-2 py-1 text-xs font-medium text-primary-500 hover:text-primary-400 hover:bg-primary-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingProvider === key ? 'Testing...' : 'Test'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm text-text-secondary">
          Status updates automatically every 30 seconds. Green = Connected, Red = Offline.
        </div>
      </div>

      <ProviderSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
};

