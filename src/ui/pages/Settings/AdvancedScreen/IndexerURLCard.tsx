import React, { useState, useEffect } from 'react';

import { Button, Card, Column, Row, Text, Input } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useI18n } from '@/ui/hooks/useI18n';
import { useWallet } from '@/ui/utils';

const DEFAULT_INDEXER_URL = 'https://api.wzrd.dog';

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function IndexerURLCard() {
  const { t } = useI18n();
  const tools = useTools();
  const wallet = useWallet();

  const [customUrl, setCustomUrl] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    try {
      const savedUrl = await wallet.getCustomIndexerUrl();
      if (savedUrl) {
        setCustomUrl(savedUrl);
        setIsCustomMode(true);
      }
    } catch (error) {
      console.error('Failed to load custom indexer URL:', error);
    }
  };

  const handleSave = async () => {
    if (!customUrl.trim()) {
      tools.toastError('Please enter an indexer URL');
      return;
    }

    const trimmedUrl = customUrl.trim();
    
    if (!isValidUrl(trimmedUrl)) {
      tools.toastError('Invalid URL format. Must start with http:// or https://');
      return;
    }

    setIsLoading(true);
    try {
      await wallet.setCustomIndexerUrl(trimmedUrl);
      setIsCustomMode(true);
      tools.toastSuccess('Custom indexer URL saved successfully.');
    } catch (error) {
      console.error('Failed to save custom indexer URL:', error);
      tools.toastError('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      await wallet.setCustomIndexerUrl(undefined);
      setCustomUrl('');
      setIsCustomMode(false);
      tools.toastSuccess(`Reset to default indexer (${DEFAULT_INDEXER_URL}).`);
    } catch (error) {
      console.error('Failed to reset indexer URL:', error);
      tools.toastError('Failed to reset configuration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card style={{ marginTop: 12 }}>
      <Column gap="md">
        <div>
          <Text text="Custom Indexer URL" preset="title-bold" />
          <Text
            text="Point your wallet at any Dogecoin indexer running the 'dog' software (github.com/jonheaven/dog)"
            preset="sub"
            style={{ marginTop: 4, marginBottom: 16 }}
          />
        </div>

        {isCustomMode && (
          <Row 
            style={{ 
              padding: 8, 
              backgroundColor: 'rgba(255, 193, 7, 0.1)', 
              borderRadius: 8,
              border: '1px solid rgba(255, 193, 7, 0.3)'
            }}
          >
            <Text 
              text="⚠️ Using custom indexer. Verify you trust this source." 
              preset="sub" 
              size="xs"
            />
          </Row>
        )}

        <Column gap="sm">
          <Text text="Indexer URL:" preset="regular" size="sm" />
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder={`Default: ${DEFAULT_INDEXER_URL}`}
            disabled={isLoading}
          />
          <Text
            text="Examples: https://api.wzrd.dog, http://localhost:3000"
            preset="sub"
            size="xs"
            style={{ marginTop: 4 }}
          />
        </Column>

        <Row gap="md" style={{ marginTop: 8 }}>
          {isCustomMode ? (
            <>
              <Button
                text="Update"
                preset="primary"
                onClick={handleSave}
                disabled={isLoading}
                style={{ flex: 1 }}
              />
              <Button
                text="Reset to Default"
                preset="default"
                onClick={handleReset}
                disabled={isLoading}
                style={{ flex: 1 }}
              />
            </>
          ) : (
            <Button
              text="Save Custom URL"
              preset="primary"
              onClick={handleSave}
              disabled={isLoading}
              full
            />
          )}
        </Row>

        {!isCustomMode && (
          <Text
            text={`Currently using default: ${DEFAULT_INDEXER_URL}`}
            preset="sub"
            size="xs"
            textCenter
            style={{ marginTop: 4 }}
          />
        )}
      </Column>
    </Card>
  );
}
