import { useState } from 'react';

import { Button, Card, Column, Input, Row, Text } from '@/ui/components';
import { useI18n } from '@/ui/hooks/useI18n';
import { useWallet } from '@/ui/utils';

interface BeamRequest {
  asset: string;
  toChain: 'bitcoin' | 'dogecoin' | 'litecoin';
  amount: string;
  destAddress: string;
}

export function BeamTab() {
  const { t } = useI18n();
  const wallet = useWallet();

  const [beamRequest, setBeamRequest] = useState<BeamRequest>({
    asset: '',
    toChain: 'bitcoin',
    amount: '',
    destAddress: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [beamStatus, setBeamStatus] = useState<any>(null);

  const handleBeam = async () => {
    if (!beamRequest.asset || !beamRequest.amount || !beamRequest.destAddress) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await wallet.beam.prepareBeam({
        asset: beamRequest.asset,
        fromChain: 'dogecoin',
        toChain: beamRequest.toChain,
        amount: beamRequest.amount,
        sourceAddress: wallet.currentAccount.address,
        destAddress: beamRequest.destAddress
      });

      setBeamStatus(result);
    } catch (error) {
      console.error('Beam preparation failed:', error);
      setBeamStatus({ error: 'Beam preparation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Column gap="lg">
      <Text text="Beam Charms Tokens" preset="title-bold" />

      <Card>
        <Column gap="md">
          <Text text="Beam Charms tokens between Dogecoin and other blockchain networks." size="sm" />
          <Text
            text="Note: Only Charms tokens can be beamed. Regular Doginals, Dunes, and DRC-20 tokens must first be wrapped into Charms."
            size="xs"
            color="textDim"
          />

          <Column gap="sm">
            <Text text="Charms Token ID" size="sm" />
            <Input
              placeholder="Enter Charms token identifier (e.g., charms:abc123...)"
              value={beamRequest.asset}
              onChange={(e) => setBeamRequest((prev) => ({ ...prev, asset: e.target.value }))}
            />
          </Column>

          <Column gap="sm">
            <Text text="Destination Chain" size="sm" />
            <Row>
              {['bitcoin', 'dogecoin', 'litecoin'].map((chain) => (
                <Button
                  key={chain}
                  text={chain.charAt(0).toUpperCase() + chain.slice(1)}
                  preset={beamRequest.toChain === chain ? 'primary' : 'default'}
                  onClick={() => setBeamRequest((prev) => ({ ...prev, toChain: chain as any }))}
                  style={{ marginRight: 8 }}
                />
              ))}
            </Row>
          </Column>

          <Column gap="sm">
            <Text text="Amount" size="sm" />
            <Input
              placeholder="Enter amount to beam"
              value={beamRequest.amount}
              onChange={(e) => setBeamRequest((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </Column>

          <Column gap="sm">
            <Text text="Destination Address" size="sm" />
            <Input
              placeholder={`Enter ${beamRequest.toChain} address`}
              value={beamRequest.destAddress}
              onChange={(e) => setBeamRequest((prev) => ({ ...prev, destAddress: e.target.value }))}
            />
          </Column>

          <Button
            text={isLoading ? 'Preparing Beam...' : 'Prepare Beam'}
            preset="primary"
            onClick={handleBeam}
            disabled={isLoading || !beamRequest.asset || !beamRequest.amount || !beamRequest.destAddress}
            full
          />
        </Column>
      </Card>

      {beamStatus && (
        <Card>
          <Column gap="md">
            <Text text="Beam Status" preset="sub" />

            {beamStatus.error ? (
              <Text text={`Error: ${beamStatus.error}`} color="danger" />
            ) : (
              <Column gap="sm">
                <Text text={`Beam ID: ${beamStatus.beamId}`} size="sm" />
                <Text text={`Status: ${beamStatus.status}`} size="sm" />
                <Text text={`From: Dogecoin → To: ${beamStatus.destChain}`} size="sm" />
                <Text text={`Asset: ${beamStatus.asset} (${beamStatus.amount})`} size="sm" />

                {beamStatus.estimatedCompletion && (
                  <Text
                    text={`Estimated completion: ${new Date(beamStatus.estimatedCompletion).toLocaleTimeString()}`}
                    size="xs"
                  />
                )}
              </Column>
            )}
          </Column>
        </Card>
      )}

      <Card>
        <Column gap="sm">
          <Text text="⚠️ Important Notes" preset="sub" />
          <Text text="• Only Charms tokens can be beamed between chains" size="xs" />
          <Text text="• Charms use zkVM proofs for trustless cross-chain movement" size="xs" />
          <Text text="• Assets are locked on source chain and minted on destination" size="xs" />
          <Text text="• You can beam Charms tokens back to Dogecoin anytime" size="xs" />
          <Text text="• Regular Dojak assets (Doginals/Dunes/DRC-20) need to be wrapped into Charms first" size="xs" />
          <Text text="• This feature is currently in development - use test amounts first" size="xs" />
        </Column>
      </Card>
    </Column>
  );
}
