import { useEffect, useState } from 'react';

import { Button, Card, Checkbox, Column, Grid, Row, Text } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { CheckboxChangeEvent } from '@dojak/ui/components/Checkbox';
import { FooterButtonContainer } from '@dojak/ui/components/FooterButtonContainer';
import QRCodeComponent from '@dojak/ui/components/QRCode';
import { Tabs } from '@dojak/ui/components/Tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCreateAccountCallback } from '@dojak/ui/state/global/hooks';
import { ContextData, UpdateContextDataParams } from '@dojak/ui/pages/Account/createHDWalletComponents/types';
import { useNavigate } from '@dojak/ui/pages/MainRoute';
import { fontSizes } from '@dojak/ui/theme/font';
import { copyToClipboard, useWallet } from '@dojak/ui/utils';
import { CopyOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import JSZip from 'jszip';
import QRCode from 'qrcode';

export function MnemonicDisplay({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const [checked, setChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'qr'>('text');
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

  const copyMnemonic = () => {
    // Ensure we copy the mnemonic as space-separated words without newlines
    const formattedMnemonic = words.join(' ');
    copyToClipboard(formattedMnemonic).then(() => {
      tools.toastSuccess(t('copied'));
    });
  };

  const printMnemonic = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const mnemonicText = words.join(' ');

    try {
      const qrDataURL = await generateQRDataURL();

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dojak Wallet Recovery Phrase</title>
            <style>
              body {
                font-family: 'Satoshi', sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: white;
                color: black;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .qr-container {
                text-align: center;
                margin: 30px 0;
              }
              .qr-code {
                max-width: 300px;
                height: auto;
              }
              .mnemonic-text {
                background: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 16px;
                word-break: break-all;
                margin: 20px 0;
              }
              .warning {
                color: #d32f2f;
                font-weight: bold;
                margin-top: 30px;
              }
              .footer {
                margin-top: 40px;
                font-size: 14px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Dojak Wallet Recovery Phrase</h1>
              <p>Print this page and store it securely</p>
            </div>

            <div class="qr-container">
              <img class="qr-code" src="${qrDataURL}" alt="Recovery QR Code" />
              <p>Scan this QR code to restore your wallet</p>
            </div>

            <div class="mnemonic-text">
              ${mnemonicText}
            </div>

            <div class="warning">
              ⚠️ WARNING: Never share this recovery phrase with anyone!<br>
              Store this paper in a secure location. You can use this to recover your wallet if you lose access.
            </div>

            <div class="footer">
              Generated by Dojak Wallet on ${new Date().toLocaleString()}
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('Error generating print preview:', error);
      tools.toastError('Failed to generate print preview');
    }
  };

  const generateQRDataURL = async (): Promise<string> => {
    const mnemonicText = words.join(' ');
    try {
      return await QRCode.toDataURL(mnemonicText, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const saveQRCode = async () => {
    try {
      const mnemonicText = words.join(' ');

      // Generate QR code as PNG
      const qrDataURL = await QRCode.toDataURL(mnemonicText, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Convert data URL to blob and download
      const response = await fetch(qrDataURL);
      const qrBlob = await response.blob();

      const url = URL.createObjectURL(qrBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dojak-recovery-qr-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      tools.toastSuccess('QR code saved successfully');
    } catch (error) {
      console.error('Error saving QR code:', error);
      tools.toastError('Failed to save QR code');
    }
  };

  const exportAsZip = async () => {
    try {
      const zip = new JSZip();
      const mnemonicText = words.join(' ');

      // Add text file
      zip.file('dojak-recovery-phrase.txt', mnemonicText);

      // Generate QR code as PNG
      const qrDataURL = await QRCode.toDataURL(mnemonicText, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Convert data URL to blob
      const response = await fetch(qrDataURL);
      const qrBlob = await response.blob();

      // Add QR code PNG
      zip.file('dojak-recovery-qr.png', qrBlob);

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = url;
      link.download = `dojak-wallet-backup-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      tools.toastSuccess('Backup ZIP downloaded successfully');
    } catch (error) {
      console.error('Error creating ZIP:', error);
      tools.toastError('Failed to create backup ZIP');
    }
  };

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
      <Row justifyCenter itemsCenter gap="md">
        <Row gap="sm">
          <Button
            onClick={copyMnemonic}
            style={{
              padding: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-soft)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Copy seed phrase"
          >
            <CopyOutlined style={{ color: 'var(--text-secondary)', fontSize: '18px' }} />
          </Button>

          <Button
            onClick={printMnemonic}
            style={{
              padding: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-soft)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Print backup"
          >
            <PrinterOutlined style={{ color: 'var(--text-secondary)', fontSize: '18px' }} />
          </Button>

          <Button
            onClick={exportAsZip}
            style={{
              padding: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-soft)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Download ZIP backup"
          >
            <DownloadOutlined style={{ color: 'var(--text-secondary)', fontSize: '18px' }} />
          </Button>
        </Row>
      </Row>
      <Text text={t('this_phrase_is_the_only_way_to_recover_your_wallet')} color="warning" textCenter />

      {/* Tabs for Text/QR views */}
      <Row justifyCenter>
        <Tabs
          items={[
            {
              key: 'text',
              label: 'Seed Words',
              children: (
                <>
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

                  {/* Full mnemonic phrase as selectable text */}
                  <Row justifyCenter>
                    <Card
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        maxWidth: '400px',
                        cursor: 'text'
                      }}
                    >
                      <Text
                        text={words.join(' ')}
                        selectText
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          wordBreak: 'break-all',
                          lineHeight: '1.4'
                        }}
                      />
                    </Card>
                  </Row>

                  {/* Instructions for copying */}
                  <Row justifyCenter>
                    <Text
                      text="Click the copy button above or select the text below to copy your recovery phrase"
                      preset="sub"
                      textCenter
                      style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '300px' }}
                    />
                  </Row>
                </>
              )
            },
            {
              key: 'qr',
              label: 'QR Code',
              children: (
                <>
                  {/* QR Code Display */}
                  <Row justifyCenter>
                    <QRCodeComponent
                      value={words.join(' ')}
                      size={280}
                      title=""
                      showText={false}
                    />
                  </Row>

                  {/* Save QR Button */}
                  <Row justifyCenter>
                    <Button
                      onClick={saveQRCode}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginTop: '8px'
                      }}
                      text="Save QR Code"
                    />
                  </Row>

                  {/* QR Instructions */}
                  <Row justifyCenter>
                    <Text
                      text="Scan this QR code with your camera to restore your wallet, or use the print/backup buttons above"
                      preset="sub"
                      textCenter
                      style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '350px' }}
                    />
                  </Row>
                </>
              )
            }
          ]}
          activeKey={activeTab}
          onTabClick={(key) => setActiveTab(key as 'text' | 'qr')}
          defaultActiveKey="text"
        />
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
