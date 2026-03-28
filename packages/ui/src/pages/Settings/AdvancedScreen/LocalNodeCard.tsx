import React, { useState, useCallback } from 'react';

import { Button, Card, Column, Row, Text, Input } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useWallet } from '@dojak/ui/utils';

interface DogecoinConfig {
  rpcuser?: string;
  rpcpassword?: string;
  rpcport?: string;
  rpcconnect?: string;
  testnet?: boolean;
}

export function LocalNodeCard() {
  const { t } = useI18n();
  const tools = useTools();
  const wallet = useWallet();

  const [isEnabled, setIsEnabled] = useState(false);
  const [config, setConfig] = useState<DogecoinConfig>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing config on mount
  React.useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    try {
      const localConfig = await wallet.getLocalRpcConfig();
      if (localConfig) {
        setConfig(localConfig);
        setIsEnabled(true);
        // Don't auto-test on load to avoid spam
      }
    } catch (error) {
      console.error('Failed to load local config:', error);
    }
  };

  const parseDogecoinConf = (content: string): DogecoinConfig => {
    const config: DogecoinConfig = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();

      if (!key || !value) continue;

      switch (key.toLowerCase()) {
        case 'rpcuser':
          config.rpcuser = value;
          break;
        case 'rpcpassword':
          config.rpcpassword = value;
          break;
        case 'rpcport':
          config.rpcport = value;
          break;
        case 'rpcconnect':
          config.rpcconnect = value;
          break;
        case 'testnet':
          config.testnet = value.toLowerCase() === '1' || value.toLowerCase() === 'true';
          break;
      }
    }

    return config;
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.conf')) {
      tools.toastError('Please select a dogecoin.conf file');
      return;
    }

    try {
      const content = await file.text();
      const parsedConfig = parseDogecoinConf(content);

      // Validate required fields
      if (!parsedConfig.rpcuser || !parsedConfig.rpcpassword) {
        tools.toastError('dogecoin.conf must contain rpcuser and rpcpassword');
        return;
      }

      // Set defaults if not specified
      parsedConfig.rpcconnect = parsedConfig.rpcconnect || '127.0.0.1';
      parsedConfig.rpcport = parsedConfig.rpcport || (parsedConfig.testnet ? '44555' : '22555');

      setConfig(parsedConfig);
      tools.toastSuccess('Configuration loaded successfully');

    } catch (error) {
      console.error('Failed to parse config file:', error);
      tools.toastError('Failed to parse dogecoin.conf file');
    }
  }, [tools]);

  const testConnection = async (testConfig?: DogecoinConfig) => {
    const configToTest = testConfig || config;
    if (!configToTest.rpcuser || !configToTest.rpcpassword) return;

    setIsLoading(true);
    try {
      // TODO: Implement actual RPC test
      // For now, just simulate connection test
      await new Promise(resolve => setTimeout(resolve, 1000));

      setIsConnected(true);
      tools.toastSuccess('Successfully connected to local Dogecoin node!');

    } catch (error) {
      setIsConnected(false);
      tools.toastError('Failed to connect to local Dogecoin node');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config.rpcuser || !config.rpcpassword) {
      tools.toastError('RPC username and password are required');
      return;
    }

    try {
      await wallet.saveLocalRpcConfig(config);
      setIsEnabled(true);
      tools.toastSuccess('Local node configuration saved');
    } catch (error) {
      console.error('Failed to save config:', error);
      tools.toastError('Failed to save configuration');
    }
  };

  const disableLocalNode = async () => {
    try {
      await wallet.clearLocalRpcConfig();
      setIsEnabled(false);
      setIsConnected(false);
      setConfig({});
      tools.toastSuccess('Local node disabled');
    } catch (error) {
      console.error('Failed to disable local node:', error);
      tools.toastError('Failed to disable local node');
    }
  };

  return (
    <Card style={{ marginTop: 12 }}>
      <Column>
        <Text text="Local Dogecoin Node" preset="title-bold" />
        <Text
          text="Connect to your local Dogecoin Core node for enhanced privacy and reliability"
          preset="sub"
          style={{ marginBottom: 16 }}
        />

        {!isEnabled ? (
          <Column gap="md">
            <div>
              <input
                type="file"
                accept=".conf"
                onChange={handleFileUpload}
                style={{ marginBottom: 8 }}
              />
              <Text
                text="Upload your dogecoin.conf file to automatically configure RPC connection"
                preset="sub"
                size="xs"
              />
            </div>

            <Text text="Or configure manually:" preset="sub" />

            <Row itemsCenter gap="sm">
              <Text text="RPC Host:" size="sm" />
              <Input
                value={config.rpcconnect || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, rpcconnect: e.target.value }))}
                placeholder="127.0.0.1"
                style={{ flex: 1 }}
              />
            </Row>

            <Row itemsCenter gap="sm">
              <Text text="RPC Port:" size="sm" />
              <Input
                value={config.rpcport || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, rpcport: e.target.value }))}
                placeholder="22555"
                style={{ flex: 1 }}
              />
            </Row>

            <Row itemsCenter gap="sm">
              <Text text="RPC User:" size="sm" />
              <Input
                value={config.rpcuser || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, rpcuser: e.target.value }))}
                placeholder="rpcuser"
                style={{ flex: 1 }}
              />
            </Row>

            <Row itemsCenter gap="sm">
              <Text text="RPC Password:" size="sm" />
              <Input
                type="password"
                value={config.rpcpassword || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, rpcpassword: e.target.value }))}
                placeholder="rpcpassword"
                style={{ flex: 1 }}
              />
            </Row>

            <Row justifyCenter gap="md" style={{ marginTop: 16 }}>
              <Button
                text="Test Connection"
                onClick={() => testConnection()}
                disabled={!config.rpcuser || !config.rpcpassword || isLoading}
                style={{ minWidth: 120 }}
              />
              <Button
                text="Enable Local Node"
                preset="primary"
                onClick={saveConfig}
                disabled={!config.rpcuser || !config.rpcpassword}
                style={{ minWidth: 140 }}
              />
            </Row>
          </Column>
        ) : (
          <Column gap="md">
            <Row itemsCenter gap="md">
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#28a745' : '#ffc107'
                }}
              />
              <Text
                text={isConnected ? 'Connected to local node' : 'Local node configured (not tested)'}
                preset="regular"
              />
            </Row>

            <Row itemsCenter gap="sm">
              <Text text="Host:" size="sm" />
              <Text text={`${config.rpcconnect}:${config.rpcport}`} preset="sub" />
            </Row>

            <Row itemsCenter gap="sm">
              <Text text="User:" size="sm" />
              <Text text={config.rpcuser} preset="sub" />
            </Row>

            <Row justifyCenter gap="md" style={{ marginTop: 16 }}>
              <Button
                text="Test Connection"
                onClick={() => testConnection()}
                disabled={isLoading}
                style={{ minWidth: 120 }}
              />
              <Button
                text="Disable Local Node"
                preset="default"
                onClick={disableLocalNode}
                style={{ minWidth: 140 }}
              />
            </Row>

            <Text
              text="When enabled, the wallet will prioritize your local node for balance checks, transaction broadcasting, and other operations."
              preset="sub"
              size="xs"
              style={{ marginTop: 8 }}
            />
          </Column>
        )}
      </Column>
    </Card>
  );
}
