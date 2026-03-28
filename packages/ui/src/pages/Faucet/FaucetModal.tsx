import { useState } from 'react';

import { TypeChain } from '@dojak/core/constant';
import { Card, Column, Row, Text } from '@dojak/ui/components';
import { BottomModal } from '@dojak/ui/components/BottomModal';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useWallet } from '@dojak/ui/utils';
import { CloseOutlined } from '@ant-design/icons';

interface FaucetModalProps {
  address: string;
  chain: TypeChain;
  onClose: () => void;
}

export const FaucetModal = ({ address, chain, onClose }: FaucetModalProps) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { t } = useI18n();
  const wallet = useWallet();

  const handleClaim = async () => {
    if (isClaiming) return;

    setIsClaiming(true);
    setClaimStatus('idle');

    try {
      console.log(`Claiming testnet DOGE for address: ${address}`);

      // Call the faucet API
      const result = await wallet.claimFaucet(address, 0.01);

      if (result.success) {
        setClaimStatus('success');
        console.log('Faucet claim successful:', result);

        // Show success message briefly, then close
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        throw new Error(result.error || 'Claim failed');
      }
    } catch (error: any) {
      console.error('Faucet claim failed:', error);
      setClaimStatus('error');
      setErrorMessage(error.message || 'Unknown error occurred');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <BottomModal onClose={onClose}>
      <Column justifyCenter itemsCenter>
        <Row justifyBetween itemsCenter style={{ height: 20 }} fullX>
          <Text text={t('faucet')} size="md" />
          <Row onClick={onClose}>
            <CloseOutlined />
          </Row>
        </Row>

        <Row fullX style={{ borderTopWidth: 1, borderColor: 'rgba(244, 182, 44, 0.25)' }} my="md" />

        <Column gap="zero" mt="sm" mb="lg">
          <Text size="sm" color="textDim" text={`Get testnet ${chain.unit} for development`} textCenter />
          <Text
            size="xs"
            color="textDim"
            text={`Address: ${address.slice(0, 8)}...${address.slice(-8)}`}
            textCenter
            mt="sm"
          />

          <Card
            style={{
              backgroundColor:
                claimStatus === 'success'
                  ? 'rgba(34, 197, 94, 0.1)'
                  : claimStatus === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(244, 182, 44, 0.1)',
              borderRadius: 10,
              border: `1px solid ${
                claimStatus === 'success' ? '#22c55e' : claimStatus === 'error' ? '#ef4444' : 'rgba(244, 182, 44, 0.25)'
              }`,
              cursor: !isClaiming && claimStatus !== 'success' ? 'pointer' : 'default'
            }}
            mt="lg"
            onClick={!isClaiming && claimStatus !== 'success' ? handleClaim : undefined}
          >
            <Column fullX gap={'md'} itemsCenter>
              <Text
                text={
                  isClaiming
                    ? 'Claiming...'
                    : claimStatus === 'success'
                    ? '✅ Claim Successful!'
                    : claimStatus === 'error'
                    ? '❌ Claim Failed'
                    : '🚰 Claim Testnet DOGE'
                }
                textCenter
                style={{ fontWeight: 'bold' }}
              />
              {claimStatus === 'success' && (
                <Text size="sm" color="green" text="✅ Your testnet DOGE will arrive shortly!" textCenter />
              )}
              {claimStatus === 'error' && (
                <Column gap="sm" itemsCenter>
                  <Text size="sm" color="red" text="❌ Claim Failed" textCenter />
                  <Text
                    size="xs"
                    color="red"
                    text={
                      errorMessage.includes('Backend server not available')
                        ? 'Make sure the Dojak API server is running (cd backend && npm run dev)'
                        : errorMessage.includes('Cannot connect to Dogecoin Core')
                        ? 'Check that dogecoind is running with RPC enabled'
                        : errorMessage || 'Please try again later'
                    }
                    textCenter
                  />
                </Column>
              )}
              {!isClaiming && claimStatus === 'idle' && (
                <Text size="sm" color="textDim" text="Get 0.01 tDOGE for testing" textCenter />
              )}
            </Column>
          </Card>
        </Column>
      </Column>
    </BottomModal>
  );
};
