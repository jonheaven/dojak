import { useState } from 'react';

import { Inscription } from '@/shared/types';
import { useI18n } from '@/ui/hooks/useI18n';
import { useWallet } from '@/ui/utils';

import { BottomModal } from '../BottomModal';
import { Button } from '../Button';
import { Column } from '../Column';
import { Input } from '../Input';
import { Row } from '../Row';
import { Text } from '../Text';

interface BeamCharmModalProps {
  inscription: Inscription;
  visible: boolean;
  onClose: () => void;
}

export function BeamCharmModal({ inscription, visible, onClose }: BeamCharmModalProps) {
  const { t } = useI18n();
  const wallet = useWallet();

  const [toChain, setToChain] = useState<'bitcoin' | 'dogecoin' | 'litecoin'>('bitcoin');
  const [destAddress, setDestAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [beamStatus, setBeamStatus] = useState<any>(null);

  const handleBeam = async () => {
    if (!destAddress) return;

    setIsLoading(true);
    try {
      const result = await wallet.beam.prepareBeam({
        asset: inscription.inscriptionId,
        fromChain: 'dogecoin',
        toChain,
        amount: '1', // Charms are typically NFTs, so amount is usually 1
        sourceAddress: wallet.currentAccount?.address || '',
        destAddress
      });

      setBeamStatus(result);
    } catch (error) {
      console.error('Beam preparation failed:', error);
      setBeamStatus({ error: 'Beam preparation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteBeam = async () => {
    if (!beamStatus?.beamId) return;

    setIsLoading(true);
    try {
      const result = await wallet.beam.executeBeam(beamStatus.beamId, 'placeholder_signed_tx');
      setBeamStatus({ ...beamStatus, ...result, executed: true });
    } catch (error) {
      console.error('Beam execution failed:', error);
      setBeamStatus({ ...beamStatus, error: 'Beam execution failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setBeamStatus(null);
    setDestAddress('');
    setToChain('bitcoin');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <BottomModal onClose={handleClose}>
      <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
        <Text text="🚀 Beam Charm" preset="title-bold" style={{ marginBottom: '20px', textAlign: 'center' }} />
      <Column gap="lg">
        <Text text={`Beam Charm: ${inscription.inscriptionId}`} preset="sub" />

        {!beamStatus && (
          <>
            <Column gap="sm">
              <Text text="Destination Chain" size="sm" />
              <Row>
                {['bitcoin', 'dogecoin', 'litecoin'].map((chain) => (
                  <Button
                    key={chain}
                    text={chain.charAt(0).toUpperCase() + chain.slice(1)}
                    preset={toChain === chain ? 'primary' : 'default'}
                    onClick={() => setToChain(chain as any)}
                    style={{ marginRight: 8 }}
                  />
                ))}
              </Row>
            </Column>

            <Column gap="sm">
              <Text text={`Destination ${toChain.charAt(0).toUpperCase() + toChain.slice(1)} Address`} size="sm" />
              <Input
                placeholder={`Enter ${toChain} address`}
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
              />
            </Column>

            <Row justifyCenter gap="md">
              <Button text="Cancel" preset="default" onClick={handleClose} />
              <Button
                text={isLoading ? "Preparing..." : "Prepare Beam"}
                preset="primary"
                onClick={handleBeam}
                disabled={isLoading || !destAddress}
              />
            </Row>
          </>
        )}

        {beamStatus && !beamStatus.executed && (
          <>
            <Column gap="sm">
              <Text text="Beam Prepared Successfully!" color="green" />
              <Text text={`Beam ID: ${beamStatus.beamId}`} size="sm" />
              <Text text={`From: Dogecoin → To: ${beamStatus.destChain}`} size="sm" />
              <Text text={`Asset: ${beamStatus.asset}`} size="sm" />
            </Column>

            <Text text="⚠️ This will lock your Charm on Dogecoin and mint it on the destination chain." size="xs" color="orange" />

            <Row justifyCenter gap="md">
              <Button text="Cancel" preset="default" onClick={handleClose} />
              <Button
                text={isLoading ? "Executing..." : "Execute Beam"}
                preset="primary"
                onClick={handleExecuteBeam}
                disabled={isLoading}
              />
            </Row>
          </>
        )}

        {beamStatus?.executed && (
          <>
            <Column gap="sm">
              <Text text="🎉 Beam Completed Successfully!" color="green" />
              <Text text={`Transaction ID: ${beamStatus.txid}`} size="sm" />
              <Text text="Your Charm has been beamed to the destination chain!" size="sm" />
            </Column>

            <Row justifyCenter>
              <Button text="Close" preset="primary" onClick={handleClose} />
            </Row>
          </>
        )}

        {beamStatus?.error && (
          <>
            <Text text={`❌ Error: ${beamStatus.error}`} color="red" />
            <Row justifyCenter>
              <Button text="Close" preset="default" onClick={handleClose} />
            </Row>
          </>
        )}
      </Column>
      </div>
    </BottomModal>
  );
}
