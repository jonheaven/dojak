import { useEffect, useMemo, useState } from 'react';

import { ADDRESS_TYPES } from '@/shared/constant';
import { AddressType } from '@/shared/types';
import { Button, Column, Icon, Input, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { AddressTypeCard2 } from '@/ui/components/AddressTypeCard';
import { FooterButtonContainer } from '@/ui/components/FooterButtonContainer';
import { useI18n } from '@/ui/hooks/useI18n';
import { ContextData, UpdateContextDataParams } from '@/ui/pages/Account/createHDWalletComponents/types';
import { useNavigate } from '@/ui/pages/MainRoute';
import { useCreateAccountCallback } from '@/ui/state/global/hooks';
import { satoshisToAmount, useWallet } from '@/ui/utils';
import { isValidHdPath } from '@/ui/utils/bitcoin-utils';
import { LoadingOutlined } from '@ant-design/icons';

export function Step2({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const wallet = useWallet();
  const tools = useTools();
  const { t } = useI18n();

  const hdPathOptions = useMemo(() => {
    // Dogecoin only supports P2PKH addresses
    return ADDRESS_TYPES.filter((v) => v.value === AddressType.P2PKH)
      .map((v) => {
        return {
          label: v.name,
          hdPath: v.hdPath,
          addressType: v.value,
          isdojakLegacy: v.isdojakLegacy
        };
      });
  }, []);

  const allHdPathOptions = useMemo(() => {
    return ADDRESS_TYPES.map((v) => v)
      .sort((a, b) => a.displayIndex - b.displayIndex)
      .map((v) => {
        return {
          label: v.name,
          hdPath: v.hdPath,
          addressType: v.value,
          isdojakLegacy: v.isdojakLegacy
        };
      });
  }, []);

  const [previewAddresses, setPreviewAddresses] = useState<string[]>(hdPathOptions.map((v) => ''));

  const [scannedGroups, setScannedGroups] = useState<
    { type: AddressType; address_arr: string[]; satoshis_arr: number[] }[]
  >([]);

  const [addressAssets, setAddressAssets] = useState<{
    [key: string]: { total_btc: string; satoshis: number; total_inscription: number };
  }>({});

  const [error, setError] = useState('');
  const [pathError, setPathError] = useState('');
  const [loading, setLoading] = useState(false);

  const createAccount = useCreateAccountCallback();
  const navigate = useNavigate();

  const [pathText, setPathText] = useState(contextData.customHdPath);

  const [recommendedTypeIndex, setRecommendedTypeIndex] = useState(0);

  useEffect(() => {
    if (scannedGroups.length > 0) {
      const itemIndex = scannedGroups.findIndex((v) => v.address_arr.length > 0);
      const item = scannedGroups[itemIndex];
      updateContextData({ addressType: item.type, addressTypeIndex: itemIndex });
    } else {
      const option = hdPathOptions[recommendedTypeIndex];
      updateContextData({ addressType: option.addressType, addressTypeIndex: recommendedTypeIndex });
    }
  }, [recommendedTypeIndex, scannedGroups]);

  const generateAddress = async () => {
    const addresses: string[] = [];
    try {
      for (let i = 0; i < hdPathOptions.length; i++) {
        const options = hdPathOptions[i];
        try {
          const keyring = await wallet.createTmpKeyringWithMnemonics(
            contextData.mnemonics,
            contextData.customHdPath || options.hdPath,
            contextData.passphrase,
            options.addressType
          );
          // Check if keyring and accounts exist
          if (!keyring || !keyring.accounts || keyring.accounts.length === 0) {
            console.error('Keyring or accounts not found:', keyring);
            setError('Failed to generate address: No accounts found in keyring');
            return;
          }
          // Get the first address from the keyring
          const address = keyring.accounts[0]?.address;
          if (!address) {
            console.error('Address not found in account');
            setError('Failed to generate address: No address found');
            return;
          }
          addresses.push(address);
        } catch (e) {
          console.error('Error generating address:', e);
          setError((e as any).message || 'Failed to generate address');
          return;
        }
      }
      setError(''); // Clear error on success
      setPreviewAddresses(addresses);
    } catch (e) {
      console.error('Unexpected error in generateAddress:', e);
      setError((e as any).message || 'An unexpected error occurred');
    }
  };

  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (contextData.mnemonics) {
      generateAddress();
      setScanned(false);
    }
  }, [contextData.passphrase, contextData.customHdPath, contextData.mnemonics]);

  const fetchAddressesBalance = async () => {
    if (!contextData.isRestore) {
      return;
    }

    const addresses = previewAddresses;
    if (!addresses[0]) return;

    setLoading(true);
    const balances = await wallet.getMultiAddressAssets(addresses.join(','));
    setLoading(false);

    const addressAssets: { [key: string]: { total_btc: string; satoshis: number; total_inscription: number } } = {};
    let maxSatoshis = 0;
    let recommended = 0;
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const balance = balances[i];
      const satoshis = balance.totalSatoshis;
      addressAssets[address] = {
        total_btc: satoshisToAmount(balance.totalSatoshis),
        satoshis,
        total_inscription: balance.inscriptionCount
      };
      if (satoshis > maxSatoshis) {
        maxSatoshis = satoshis;
        recommended = i;
      }
    }
    if (maxSatoshis > 0) {
      setRecommendedTypeIndex(recommended);
    }

    setAddressAssets(addressAssets);
  };

  useEffect(() => {
    fetchAddressesBalance();
  }, [previewAddresses]);

  const submitCustomHdPath = (text: string) => {
    setPathError('');
    setPathText(text);
    if (text !== '') {
      const isValid = isValidHdPath(text);
      if (!isValid) {
        setPathError(t('invalid_derivation_path'));
        return;
      }
      updateContextData({
        customHdPath: text
      });
    } else {
      updateContextData({
        customHdPath: ''
      });
    }
  };

  const disabled = useMemo(() => {
    if (error || pathError) {
      return true;
    }
    // Also check if we have addresses generated
    if (!previewAddresses || previewAddresses.length === 0 || !previewAddresses[0]) {
      return true;
    }
    return false;
  }, [error, pathError, previewAddresses]);

  const onNext = async () => {
    try {
      if (scannedGroups.length > 0) {
        const option = allHdPathOptions[contextData.addressTypeIndex];
        const hdPath = contextData.customHdPath || option.hdPath;
        const selected = scannedGroups[contextData.addressTypeIndex];

        await createAccount(
          contextData.mnemonics,
          hdPath,
          contextData.passphrase,
          contextData.addressType,
          selected.address_arr.length
        );
      } else {
        const option = hdPathOptions[contextData.addressTypeIndex];
        const hdPath = contextData.customHdPath || option.hdPath;
        await createAccount(contextData.mnemonics, hdPath, contextData.passphrase, contextData.addressType, 1);
      }
      navigate('MainScreen');
    } catch (e) {
      tools.toastError((e as any).message);
    }
  };

  const scanVaultAddress = async () => {
    setScanned(true);
    tools.showLoading(true);
    try {
      let groups: { type: AddressType; address_arr: string[]; satoshis_arr: number[]; pubkey_arr: string[] }[] = [];
      for (let i = 0; i < allHdPathOptions.length; i++) {
        const options = allHdPathOptions[i];
        const address_arr: string[] = [];
        const satoshis_arr: number[] = [];
        try {
          const keyring = await wallet.createTmpKeyringWithMnemonics(
            contextData.mnemonics,
            contextData.customHdPath || options.hdPath,
            contextData.passphrase,
            options.addressType,
            10
          );
          keyring.accounts.forEach((v, j) => {
            address_arr.push(v.address);
          });
        } catch (e) {
          console.log(e);
          setError((e as any).message);
          return;
        }

        groups.push({
          type: options.addressType,
          address_arr: address_arr,
          satoshis_arr: satoshis_arr,
          pubkey_arr: []
        });
      }

      groups = await wallet.findGroupAssets(groups);

      setScannedGroups(groups);
      if (groups.length == 0) {
        tools.showTip(t('unable_to_find_any_addresses_with_assets'));
      }
    } catch (e) {
      setError((e as any).message);
    } finally {
      tools.showLoading(false);
    }
  };

  return (
    <Column>
      {/* Dogecoin only supports Legacy (P2PKH) addresses - no selection needed */}
      <Text text={t('address_type')} preset="bold" />
      <Text text="Legacy (P2PKH) - Dogecoin addresses starting with P" preset="sub" />

      {hdPathOptions.map((item, index) => {
        const address = previewAddresses[index];
        const assets = addressAssets[address] || {
          total_btc: '--',
          satoshis: 0,
          total_inscription: 0
        };

        const hdPath = (contextData.customHdPath || item.hdPath) + '/0';
        
        // Only render the card if we have a valid address
        if (!address) {
          return (
            <Column key={index}>
              <Text text={`${item.label}`} preset="bold" />
              <Text text="Generating address..." preset="sub" />
            </Column>
          );
        }
        
        return (
          <AddressTypeCard2
            key={index}
            label={`${item.label}`}
            items={[
              {
                address,
                satoshis: assets.satoshis,
                path: hdPath
              }
            ]}
            checked={true} // Always checked since there's only one option
            onClick={() => {
              // No action needed - only one address type available
            }}
          />
        );
      })}

      <Text text={t('custom_hdpath_optional')} preset="bold" mt="lg" />

      <Column>
        <Input
          placeholder={t('custom_hdpath')}
          value={pathText}
          onChange={(e) => {
            submitCustomHdPath(e.target.value);
          }}
        />
      </Column>
      {pathError && <Text text={pathError} color="error" />}
      {error && <Text text={error} color="error" />}

      <Text text={t('phrase_optional')} preset="bold" mt="lg" />

      <Input
        placeholder={t('passphrase')}
        defaultValue={contextData.passphrase}
        onChange={async (e) => {
          updateContextData({
            passphrase: e.target.value
          });
        }}
      />

      <FooterButtonContainer>
        <Button text={t('continue')} preset="primary" onClick={onNext} disabled={disabled} />
      </FooterButtonContainer>

      {loading && (
        <Icon>
          <LoadingOutlined />
        </Icon>
      )}
    </Column>
  );
}


