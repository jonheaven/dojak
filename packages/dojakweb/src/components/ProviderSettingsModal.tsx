import React, { useState, useEffect } from 'react';
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useConfig, ProviderType } from '../utils/providers/ConfigProvider';
import {
  getDefaultWalletDataProviderUrl,
  isDefaultWalletDataProviderUrl,
  type WalletDataProviderType,
} from '../utils/api';
import { getInscriptionConfig, setInscriptionConfig, type InscriptionMarker } from '../utils/inscription-settings';
import { getFeeSettings, setFeeSettings, type FeeSettings } from '../utils/fee-settings';
import { toast } from 'sonner';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useDojakwebI18n();
  const { config, setConfig, testConnection } = useConfig();

  const [selectedType, setSelectedType] = useState<ProviderType>(config.type);
  const [walletDataProvider, setWalletDataProvider] = useState<WalletDataProviderType>(config.walletDataProvider || 'mydoge');
  const [walletDataProviderUrl, setWalletDataProviderUrl] = useState(() => {
    const provider = config.walletDataProvider || 'mydoge';
    return isDefaultWalletDataProviderUrl(provider, config.walletDataProviderUrl)
      ? ''
      : (config.walletDataProviderUrl || '');
  });
  const [customUrl, setCustomUrl] = useState(config.url || '');
  const [customUsername, setCustomUsername] = useState(config.username || '');
  const [customPassword, setCustomPassword] = useState(config.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Inscription settings
  const [inscriptionMarker, setInscriptionMarker] = useState<InscriptionMarker>('ord');

  // Fee settings
  const [defaultFeeRate, setDefaultFeeRate] = useState<number>(1000); // koinu per byte
  const [platformFeeEnabled, setPlatformFeeEnabled] = useState<boolean>(false);
  const [platformFeeAmount, setPlatformFeeAmount] = useState<number>(0.05); // DOGE

  useEffect(() => {
    if (isOpen) {
      setSelectedType(config.type);
      const provider = config.walletDataProvider || 'mydoge';
      setWalletDataProvider(provider);
      setWalletDataProviderUrl(
        isDefaultWalletDataProviderUrl(provider, config.walletDataProviderUrl)
          ? ''
          : (config.walletDataProviderUrl || ''),
      );
      setCustomUrl(config.url || '');
      setCustomUsername(config.username || '');
      setCustomPassword(config.password || '');
      setShowPassword(false);

      // Load inscription settings
      const inscriptionConfig = getInscriptionConfig();
      setInscriptionMarker(inscriptionConfig.marker);

      // Load fee settings
      const feeConfig = getFeeSettings();
      setDefaultFeeRate(feeConfig.defaultFeeRate);
      setPlatformFeeEnabled(feeConfig.platformFeeEnabled);
      setPlatformFeeAmount(feeConfig.platformFeeAmount);
    }
  }, [isOpen, config]);

  const handleWalletProviderChange = (nextProvider: WalletDataProviderType) => {
    setWalletDataProvider(nextProvider);
    // Empty = use built-in default for this provider (no custom API URL stored).
    setWalletDataProviderUrl('');
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await testConnection(selectedType);
      toast[result.status === 'green' ? 'success' : 'error'](result.message);
    } catch {
      toast.error(t('providerModal.toast.testFailed'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newConfig = {
        type: selectedType,
        walletDataProvider,
        walletDataProviderUrl,
        ...(selectedType === 'custom' && {
          url: customUrl,
          username: customUsername,
          password: customPassword,
        }),
      };

      await setConfig(newConfig);

      // Save inscription settings
      setInscriptionConfig({
        marker: inscriptionMarker,
      });

      // Save fee settings
      setFeeSettings({
        defaultFeeRate,
        platformFeeEnabled,
        platformFeeAmount,
      });

      toast.success(t('providerModal.toast.saveOk'));
      window.dispatchEvent(new CustomEvent('dojakweb:wallet-provider-updated'));
      onClose();
    } catch {
      toast.error(t('providerModal.toast.saveFail'));
    } finally {
      setIsSaving(false);
    }
  };

  const isValidCustomConfig = selectedType !== 'custom' || (customUrl.trim() && customUsername.trim() && customPassword.trim());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('providerModal.title')}</DialogTitle>
        </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('providerModal.walletDataLabel')}</label>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {([
                    { key: 'mydoge' as const, label: t('providerModal.mydogeLabel'), url: getDefaultWalletDataProviderUrl('mydoge'), description: t('providerModal.mydogeDesc') },
                    { key: 'dogex' as const, label: t('providerModal.dogexLabel'), url: getDefaultWalletDataProviderUrl('dogex'), description: t('providerModal.dogexDesc') },
                    {
                      key: 'commanddog' as const,
                      label: t('providerModal.commanddogLabel'),
                      url: getDefaultWalletDataProviderUrl('commanddog'),
                      description: t('providerModal.commanddogDesc'),
                    },
                    {
                      key: 'electrs' as const,
                      label: t('providerModal.electrsLabel'),
                      url: getDefaultWalletDataProviderUrl('electrs'),
                      description: t('providerModal.electrsDesc'),
                    },
                  ] as const).map((provider) => (
                    <button
                      key={provider.key}
                      type="button"
                      onClick={() => handleWalletProviderChange(provider.key)}
                      className={`text-left rounded-lg border p-4 transition-colors ${walletDataProvider === provider.key ? 'border-primary-500 bg-primary-500/10' : 'border-border-primary bg-bg-secondary hover:border-primary-500/60'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">{provider.label}</span>
                        {walletDataProvider === provider.key && <span className="text-xs text-primary-400">{t('providerModal.selected')}</span>}
                      </div>
                      <p className="mt-2 text-xs text-text-secondary break-all">{provider.url}</p>
                      <p className="mt-2 text-sm text-text-secondary">{provider.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">{t('providerModal.activeUrl')}</label>
                <Input
                  type="url"
                  value={walletDataProviderUrl}
                  onChange={(e) => setWalletDataProviderUrl(e.target.value)}
                  placeholder={getDefaultWalletDataProviderUrl(walletDataProvider)}
                  className="w-full"
                />
                <p className="text-xs text-text-tertiary mt-1">
                  Leave blank to use the built-in default ({getDefaultWalletDataProviderUrl(walletDataProvider)}).{' '}
                  {t('providerModal.gearHint')}
                </p>
              </div>
            </div>

            <div className="border-t border-border-primary pt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('providerModal.broadcastLabel')}</label>
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as ProviderType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select broadcast provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">{t('providerModal.optLocal')}</SelectItem>
                    <SelectItem value="mydoge">{t('providerModal.optPublic')}</SelectItem>
                    <SelectItem value="custom">{t('providerModal.optCustom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedType === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">RPC URL</label>
                    <Input type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="http://localhost:22555" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Username</label>
                    <Input type="text" value={customUsername} onChange={(e) => setCustomUsername(e.target.value)} placeholder="rpcuser" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        placeholder="rpcpassword"
                        autoComplete="off"
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-bg-primary rounded transition-colors">
                        {showPassword ? <EyeSlashIcon className="w-4 h-4 text-text-tertiary" /> : <EyeIcon className="w-4 h-4 text-text-tertiary" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-border-primary pt-6 space-y-4">
                <h3 className="text-lg font-semibold text-text-primary">Inscription Protocol</h3>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Inscription Protocol</label>
                  <Select value={inscriptionMarker} onValueChange={(value) => setInscriptionMarker(value as InscriptionMarker)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select inscription protocol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ord">Doginals v1 (ord)</SelectItem>
                      <SelectItem value="dog">Dogenals v2 (dog)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-tertiary mt-1">
                    Choose which inscription protocol layer to use for your inscriptions.
                  </p>
                </div>

                <div className="p-3 bg-bg-secondary rounded-md">
                  <h4 className="text-sm font-medium text-text-primary mb-1">What are Inscription Protocols?</h4>
                  <p className="text-xs text-text-secondary">
                    Doginals v1 (ord) is the original inscription protocol. Dogenals v2 (dog) is a new protocol layer
                    that provides additional features and improvements. Choose the protocol that best fits your needs.
                  </p>
                </div>
              </div>

              <div className="border-t border-border-primary pt-6 space-y-4">
                <h3 className="text-lg font-semibold text-text-primary">Transaction Fees</h3>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Default Fee Rate</label>
                  <Select value={defaultFeeRate.toString()} onValueChange={(value) => setDefaultFeeRate(Number(value))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select fee rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">Normal (1 koinu/byte) - inclusion floor</SelectItem>
                      <SelectItem value="2000">Fast (2 koinu/byte)</SelectItem>
                      <SelectItem value="5000">Turbo (5 koinu/byte)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-tertiary mt-1">
                    Choose your default network fee rate for transactions. Higher rates = faster confirmation.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="platform-fee-enabled"
                      checked={platformFeeEnabled}
                      onCheckedChange={(checked) => setPlatformFeeEnabled(checked === true)}
                    />
                    <label htmlFor="platform-fee-enabled" className="text-sm text-text-primary">
                      Enable optional platform tip
                    </label>
                  </div>

                  {platformFeeEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Platform Tip Amount</label>
                      <Input
                        type="number"
                        min="0"
                        max="5"
                        step="0.01"
                        value={platformFeeAmount}
                        onChange={(e) => setPlatformFeeAmount(Number(e.target.value))}
                        placeholder="0.05"
                      />
                      <p className="text-xs text-text-tertiary mt-1">
                        Optional tip to support Dojakweb development (0.00 - 5.00 DOGE). You can change this before each transaction.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-bg-secondary rounded-md">
                  <h4 className="text-sm font-medium text-text-primary mb-1">Fee Transparency</h4>
                  <p className="text-xs text-text-secondary">
                    Network fees go to Dogecoin miners for transaction processing. Platform tips are optional and support ongoing development.
                    All fees are clearly shown before you confirm any transaction.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-bg-secondary rounded-md">
                <h4 className="text-sm font-medium text-text-primary mb-1">{t('providerModal.whatControlsTitle')}</h4>
                <p className="text-xs text-text-secondary">{t('providerModal.whatControlsBody')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-border-primary">
            <button onClick={handleTest} disabled={isTesting || !isValidCustomConfig} className="px-4 py-2 text-sm font-medium text-primary-500 hover:text-primary-400 hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isTesting ? t('providerModal.testing') : t('providerModal.testConnection')}
            </button>
            <button onClick={handleSave} disabled={isSaving || !isValidCustomConfig} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? t('providerModal.saving') : t('providerModal.save')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
  );
};
