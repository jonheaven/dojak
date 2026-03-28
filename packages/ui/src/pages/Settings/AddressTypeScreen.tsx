import log from 'loglevel';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ADDRESS_TYPES } from '@dojak/core/constant';
import { Column, Content, Header, Layout } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { AddressTypeCard } from '@dojak/ui/components/AddressTypeCard';
import { useExtensionIsInTab } from '@dojak/ui/features/browser/tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCurrentAccount, useReloadAccounts } from '@dojak/ui/state/accounts/hooks';
import { useAppDispatch } from '@dojak/ui/state/hooks';
import { useCurrentKeyring } from '@dojak/ui/state/keyrings/hooks';
import { koinuToAmount, useWallet } from '@dojak/ui/utils';
import { KeyringType } from '@unisat/keyring-service/types';
import { AddressType } from '@unisat/wallet-types';

import { useNavigate } from '../MainRoute';

export default function AddressTypeScreen() {
  const isInTab = useExtensionIsInTab();
  const { t } = useI18n();

  const wallet = useWallet();
  const currentKeyring = useCurrentKeyring();
  const account = useCurrentAccount();

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const reloadAccounts = useReloadAccounts();
  const [addresses, setAddresses] = useState<string[]>([]);
  const [addressAssets, setAddressAssets] = useState<{
    [key: string]: { total_doge: string; koinu: number; total_inscription: number };
  }>({});

  const selfRef = useRef<{
    addressAssets: { [key: string]: { total_doge: string; koinu: number; total_inscription: number } };
  }>({
    addressAssets: {}
  });
  const self = selfRef.current;

  const tools = useTools();
  const loadAddresses = async () => {
    try {
      tools.showLoading(true);
      const _res = await wallet.getAllAddresses(currentKeyring, account.index || 0);
      setAddresses(_res);
      const balances = await wallet.getMultiAddressAssets(_res.join(','));
      for (let i = 0; i < _res.length; i++) {
        const address = _res[i];
        const balance = balances[i];
        const koinu = balance.totalKoinu;
        self.addressAssets[address] = {
          total_doge: koinuToAmount(balance.totalKoinu),
          koinu,
          total_inscription: balance.inscriptionCount
        };
      }
      setAddressAssets(self.addressAssets);
    } catch (e) {
      log.error(e);
    } finally {
      tools.showLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const addressTypes = useMemo(() => {
    // Dogecoin only supports P2PKH addresses, so always show only that option
    return ADDRESS_TYPES.filter((v) => v.value === AddressType.P2PKH);
  }, []);
  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('address_type')}
      />
      <Content>
        <Column>
          {addressTypes.map((item, index) => {
            const address = addresses[item.value];
            const assets = addressAssets[address] || {
              total_doge: '--',
              koinu: 0,
              total_inscription: 0
            };
            let name = `${item.name} (${item.hdPath}/${account.index})`;
            if (currentKeyring.type === KeyringType.SimpleKeyring) {
              name = `${item.name}`;
            } else if (currentKeyring.type === KeyringType.ColdWalletKeyring) {
              name = `❄️ ${item.name} (${item.hdPath}/${account.index}) - ${t('Fixed by cold wallet')}`;
            }
            return (
              <AddressTypeCard
                key={index}
                label={name}
                address={address}
                assets={assets}
                checked={item.value == currentKeyring.addressType}
                onClick={async () => {
                  // Dogecoin only supports P2PKH addresses - no switching allowed
                  if (item.value !== AddressType.P2PKH) {
                    tools.toastError(t('dogecoin_only_supports_legacy_addresses'));
                    return;
                  }
                  // Since we only have P2PKH, clicking when already selected does nothing
                  if (item.value == currentKeyring.addressType) {
                    return;
                  }
                }}
              />
            );
          })}
        </Column>
      </Content>
    </Layout>
  );
}
