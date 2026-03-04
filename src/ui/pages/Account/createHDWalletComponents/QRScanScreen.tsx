import { AddressType } from '@/shared/types';
import { Content, Header, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import QRScanner from '@/ui/components/QRScanner';
import { useCreateAccountCallback } from '@/ui/state/global/hooks';
import { globalActions } from '@/ui/state/global/reducer';
import { useAppDispatch } from '@/ui/state/hooks';
import { useWallet } from '@/ui/utils';
import { isValidAddress } from '@/ui/utils/bitcoin-utils';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from '../../MainRoute';


export function QRScanScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const wallet = useWallet();
  const tools = useTools();
  const dispatch = useAppDispatch();
  const [scanning, setScanning] = useState(false);
  const createAccount = useCreateAccountCallback();

  // Get context from navigation state
  const { context } = location.state as { context?: string };

  const handleQRScan = async (scannedData: string) => {
    try {
      console.log('QR scanned:', scannedData);
      setScanning(true);

      // Small delay to ensure UI updates before processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const trimmedData = scannedData.trim();

      // Check if it's a valid Dogecoin address
      if (isValidAddress(trimmedData)) {
        console.log('Detected valid Dogecoin address');

        if (context === 'import') {
          tools.toastError('This is a Dogecoin address, not a seed phrase or private key for importing.');
          setScanning(false);
          return;
        } else {
          tools.toastSuccess('Dogecoin address scanned!');
          // Store the address for potential use in sending/receiving flows
          if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({
              'scanned_address': trimmedData,
              'scanned_address_timestamp': Date.now()
            });
          }
          setTimeout(() => {
            navigate('#back'); // Go back to previous screen
          }, 1500);
          return;
        }
      }

      // Check if it's a mnemonic phrase (12 or 24 words)
      const words = trimmedData.split(/\s+/);
      if ((words.length === 12 || words.length === 24) && words.every(word => word.length > 0)) {
        console.log('Detected seed phrase:', words.length, 'words');

        tools.toastSuccess('Seed phrase scanned! Importing wallet...');

        // Directly import the wallet - duplicate checking is handled at service level
        setTimeout(async () => {
          try {
            console.log('🔄 Importing wallet with scanned seed phrase...');
            setScanning(false);

            // Import the wallet using the proper callback that sets unlock state
            await createAccount(
              trimmedData, // mnemonic
              "m/44'/3'/0'/0", // Default Dogecoin HD path
              '', // no passphrase
              AddressType.P2PKH, // P2PKH address type for Dogecoin
              1 // account count
            );

            console.log('✅ Wallet imported successfully');
            tools.toastSuccess('Wallet imported successfully via QR!');

            // Navigate directly to the main wallet view
            navigate('MainScreen');
          } catch (error: any) {
            console.error('Failed to import wallet:', error);
            if (error.message && error.message.includes('already exist')) {
              tools.toastError('This wallet has already been imported. You cannot import the same wallet twice.');
            } else {
              tools.toastError('Failed to import wallet. Please try again.');
            }
            setScanning(false);
          }
        }, 1000);
        return;
      }

        // Check if it's a WIF private key (starts with specific prefixes)
      const wifPrefixes = ['5', 'K', 'L', '9']; // Mainnet/testnet WIF prefixes
      if (trimmedData.length >= 51 && trimmedData.length <= 52 && wifPrefixes.includes(trimmedData[0])) {
        console.log('Detected WIF private key');

        tools.toastSuccess('Private key scanned! Importing wallet...');

        // Directly import the wallet using the scanned private key
        setTimeout(async () => {
          try {
            console.log('🔄 Importing wallet with scanned private key...');
            setScanning(false);

            await wallet.createKeyringWithPrivateKey(
              trimmedData, // private key
              AddressType.P2PKH, // P2PKH address type for Dogecoin
              'Imported Wallet' // alias name
            );

            // Set wallet as unlocked after import
            dispatch(globalActions.update({ isUnlocked: true }));

            console.log('✅ Wallet imported successfully');
            tools.toastSuccess('Wallet imported successfully via QR!');

            // Navigate directly to the main wallet view
            navigate('MainScreen');
          } catch (error: any) {
            console.error('Failed to import wallet:', error);
            if (error.message && error.message.includes('already exist')) {
              tools.toastError('This wallet has already been imported. You cannot import the same wallet twice.');
            } else {
              tools.toastError('Failed to import wallet. Please try again.');
            }
            setScanning(false);
          }
        }, 1000);
        return;
      }

        // Check if it's a HEX private key (64 characters, hex only)
      if (/^[0-9a-fA-F]{64}$/.test(trimmedData)) {
        console.log('Detected HEX private key');

        tools.toastSuccess('Private key scanned! Importing wallet...');

        // Directly import the wallet using the scanned private key
        setTimeout(async () => {
          try {
            console.log('🔄 Importing wallet with scanned private key...');
            setScanning(false);

            await wallet.createKeyringWithPrivateKey(
              trimmedData, // private key
              AddressType.P2PKH, // P2PKH address type for Dogecoin
              'Imported Wallet' // alias name
            );

            // Set wallet as unlocked after import
            dispatch(globalActions.update({ isUnlocked: true }));

            console.log('✅ Wallet imported successfully');
            tools.toastSuccess('Wallet imported successfully via QR!');

            // Navigate directly to the main wallet view
            navigate('MainScreen');
          } catch (error: any) {
            console.error('Failed to import wallet:', error);
            if (error.message && error.message.includes('already exist')) {
              tools.toastError('This wallet has already been imported. You cannot import the same wallet twice.');
            } else {
              tools.toastError('Failed to import wallet. Please try again.');
            }
            setScanning(false);
          }
        }, 1000);
        return;
      }

      // If we can't determine the type, show an error
      console.log('Unknown QR code format');
      tools.toastError('Could not determine QR code type. Please ensure it contains a valid Dogecoin address, 12 or 24-word seed phrase, WIF private key, or 64-character Hex private key.');
      setScanning(false);

    } catch (error) {
      console.error('Error processing QR code:', error);
      tools.toastError('Failed to process QR code');
      setScanning(false);
    }
  };

  const handleScanError = (error: string) => {
    console.log('QR scan error:', error);
    tools.toastError('QR scan failed: ' + error);
  };

  return (
    <Layout>
      <Header
        onBack={() => {
          navigate('CreateHDWalletScreen', { isImport: true });
        }}
        title="Scan QR Code"
      />
      <Content>
        <Text
          text="Import Wallet via QR"
          preset="title"
          textCenter
          mt="lg"
        />
        <Text
          text="Scan a seed phrase or private key QR code to import your wallet."
          preset="regular"
          textCenter
          mt="md"
          style={{ color: 'var(--text-secondary)' }}
        />

        <QRScanner
          onScan={handleQRScan}
          onError={handleScanError}
          title="Scan Wallet QR Code"
          buttonText="Start Camera"
        />

        {scanning && (
          <Row justifyCenter mt="lg">
            <Text text="Processing QR code..." preset="regular" />
          </Row>
        )}
      </Content>
    </Layout>
  );
}
