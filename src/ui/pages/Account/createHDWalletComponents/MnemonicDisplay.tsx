import { useEffect, useState } from 'react';

import { Button, Card, Checkbox, Column, Grid, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { CheckboxChangeEvent } from '@/ui/components/Checkbox';
import { FooterButtonContainer } from '@/ui/components/FooterButtonContainer';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCreateAccountCallback } from '@/ui/state/global/hooks';
import { ContextData, UpdateContextDataParams } from '@/ui/pages/Account/createHDWalletComponents/types';
import { useNavigate } from '@/ui/pages/MainRoute';
import { fontSizes } from '@/ui/theme/font';
import { copyToClipboard, useWallet } from '@/ui/utils';

export function MnemonicDisplay({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const [checked, setChecked] = useState(false);
  const { t } = useI18n();
  const wallet = useWallet();
  const tools = useTools();
  const navigate = useNavigate();
  const createAccount = useCreateAccountCallback();

  useEffect(() => {
    if (!contextData.mnemonics) {
      const init = async () => {
        try {
          // Skip unlock check during wallet creation flow - user just set their password
          console.log('[MnemonicDisplay] Calling generatePreMnemonic...');
          const _mnemonics = await wallet.generatePreMnemonic();
          console.log('[MnemonicDisplay] Got mnemonics:', _mnemonics);
          updateContextData({
            mnemonics: _mnemonics
          });
        } catch (error) {
          console.error('[MnemonicDisplay] Error generating mnemonic:', error);
          console.error('[MnemonicDisplay] Error details:', JSON.stringify(error));
          const errorMsg = (error as any)?.message || 'Unknown error';
          tools.toastError(`Failed to generate mnemonic: ${errorMsg}`);
        }
      };
      init();
    }
  }, [contextData.mnemonics]);

  const onChange = (e: CheckboxChangeEvent) => {
    const val = e.target.checked;
    setChecked(val);
    updateContextData({ mnemonicConfirmed: val });
  };

  function copy(str: string) {
    copyToClipboard(str).then(() => {
      tools.toastSuccess(t('copied'));
    });
  }

  const btnClick = async () => {
    try {
      await createAccount(
        contextData.mnemonics,
        contextData.hdPath,
        contextData.passphrase,
        contextData.addressType,
        1 // accountCount, default to 1 for new wallet
      );
      navigate('MainScreen');
    } catch (error) {
      const errorMsg = (error as any)?.message || 'Failed to create wallet';
      tools.toastError(errorMsg);
    }
  };

  // Don't render until we have mnemonics
  if (!contextData.mnemonics) {
    return (
      <Column gap="xl" style={{ padding: 20 }}>
        <Text text="Generating..." preset="sub" textCenter />
      </Column>
    );
  }

  const words = contextData.mnemonics.split(' ').filter((w) => w.trim().length > 0);
  console.log('[MnemonicDisplay] mnemonics:', contextData.mnemonics);
  console.log('[MnemonicDisplay] words array:', words);

  return (
    <Column gap="xl">
      <Text text={t('secret_recovery_phrase')} preset="title-bold" textCenter />
      <Text text={t('this_phrase_is_the_only_way_to_recover_your_wallet')} color="warning" textCenter />

      <Row justifyCenter>
        <Grid columns={2}>
          {words.map((v, index) => {
            return (
              <Row key={index}>
                <Text text={`${index + 1}. `} style={{ width: 40 }} />
                <Card preset="style2" style={{ width: 200 }}>
                  <Text text={v} selectText disableTranslate />
                </Card>
              </Row>
            );
          })}
        </Grid>
      </Row>

      <Row justifyCenter>
        <Checkbox onChange={onChange} checked={checked} style={{ fontSize: fontSizes.sm }}>
          <Text text={t('i_saved_my_secret_recovery_phrase')} />
        </Checkbox>
      </Row>

      <FooterButtonContainer>
        <Button disabled={!checked} text={t('continue')} preset="primary" onClick={btnClick} />
      </FooterButtonContainer>
    </Column>
  );
}
