import { useState } from 'react';

import { MarketplaceIntentSummary } from '@/shared/types';
import { Button, Card, Column, Content, Footer, Header, Layout, Row, Text } from '@/ui/components';
import { ColdWalletSignMessage } from '@/ui/components/ColdWallet';
import WebsiteBar from '@/ui/components/WebsiteBar';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useApproval } from '@/ui/utils';
import { KeyringType, KeystoneSignEnum } from '@unisat/keyring-service/types';

import KeystoneSignScreen from '../../Wallet/KeystoneSignScreen';

interface Props {
  params: {
    data: {
      text: string;
      type: string;
      payloadHash?: string;
      intentSummary?: MarketplaceIntentSummary;
    };
    session: {
      origin: string;
      icon: string;
      name: string;
    };
  };
}
export default function SignText({ params: { data, session } }: Props) {
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  const account = useCurrentAccount();
  const [isKeystoneSigning, setIsKeystoneSigning] = useState(false);
  const { t } = useI18n();
  const intentSummary = data.intentSummary;

  const detailRows = [
    ['Action', intentSummary?.title],
    ['Intent Type', intentSummary?.intentType],
    ['Wallet', intentSummary?.address],
    ['Recipient', intentSummary?.recipientAddress],
    ['Price (koinu)', intentSummary?.priceKoinu],
    ['Marketplace Fee (koinu)', intentSummary?.marketplaceFeeKoinu],
    ['Inscription', intentSummary?.inscriptionId],
    ['Listing', intentSummary?.listingId],
    ['Offer', intentSummary?.offerId],
    ['Auction', intentSummary?.auctionId],
    ['Collection', intentSummary?.collectionId],
    ['Fee Policy', intentSummary?.feePolicy],
    ['Network', intentSummary?.network],
    ['Chain ID', intentSummary?.chainId],
    ['Expires At', intentSummary?.expiresAt],
    ['Nonce', intentSummary?.nonce],
    ['Payload Hash', data.payloadHash]
  ].filter(([, value]) => !!value) as [string, string][];

  const handleCancel = () => {
    rejectApproval();
  };

  const handleConfirm = () => {
    if (account.type === KeyringType.KeystoneKeyring) {
      setIsKeystoneSigning(true);
      return;
    }
    resolveApproval();
  };

  // Handle cold wallet signing
  if (account.type === KeyringType.ColdWalletKeyring) {
    return (
      <ColdWalletSignMessage
        messages={[{ text: data.text, type: data.type }]}
        onSuccess={(signatures: string[]) => {
          resolveApproval({ signature: signatures[0] });
        }}
        onCancel={() => {
          rejectApproval('User canceled');
        }}
        header={
          <Header>
            <WebsiteBar session={session} />
          </Header>
        }
        origin={session?.origin}
      />
    );
  }

  if (isKeystoneSigning) {
    return (
      <KeystoneSignScreen
        type={data.type === KeystoneSignEnum.BIP322_SIMPLE ? KeystoneSignEnum.BIP322_SIMPLE : KeystoneSignEnum.MSG}
        data={data.text}
        onSuccess={({ signature }) => {
          resolveApproval({ signature });
        }}
        onBack={() => {
          setIsKeystoneSigning(false);
        }}
      />
    );
  }
  return (
    <Layout>
      <Content>
        <Header>
          <WebsiteBar session={session} />
        </Header>
        <Column>
          <Text text={t('signature_request')} preset="title-bold" textCenter mt="lg" />
          <Text text={t('only_sign_this_message_if_you_fully_understand_the')} preset="sub" textCenter mt="lg" />
          <Text text={t('you_are_signing')} textCenter mt="lg" />

          {intentSummary && (
            <Card>
              <Column gap="sm">
                {detailRows.map(([label, value]) => (
                  <Row key={label} justifyBetween>
                    <Text text={label} preset="sub" color="textDim" />
                    <Text
                      text={value}
                      preset="regular"
                      style={{
                        maxWidth: 220,
                        textAlign: 'right',
                        wordBreak: 'break-word'
                      }}
                    />
                  </Row>
                ))}
                {intentSummary.outputs?.map((output, index) => (
                  <Row key={`${output.address}-${index}`} justifyBetween>
                    <Text text={`Output ${index + 1}`} preset="sub" color="textDim" />
                    <Text
                      text={`${output.address}${output.valueKoinu ? ` • ${output.valueKoinu} koinu` : ''}${
                        output.role ? ` • ${output.role}` : ''
                      }`}
                      preset="regular"
                      style={{
                        maxWidth: 220,
                        textAlign: 'right',
                        wordBreak: 'break-word'
                      }}
                    />
                  </Row>
                ))}
              </Column>
            </Card>
          )}

          <Card>
            <div
              style={{
                userSelect: 'text',
                maxHeight: 384,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                flexWrap: 'wrap'
              }}
            >
              {data.text}
            </div>
          </Card>
        </Column>
      </Content>

      <Footer>
        <Row full>
          <Button text={t('reject')} full preset="default" onClick={handleCancel} />
          <Button text={t('sign')} full preset="primary" onClick={handleConfirm} />
        </Row>
      </Footer>
    </Layout>
  );
}
