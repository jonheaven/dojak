import React, { useEffect, useMemo, useState } from 'react';
import {
  BanknotesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  CubeIcon,
  CircleStackIcon,
  SparklesIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useDataProvider } from '../providers/DataProvider';
import { InscriptionModal } from './InscriptionModal';
import { ProviderSettingsModal } from './ProviderSettingsModal';
import { DogeAmount } from './DogeAmount';
import { DogeCurrencyIcon } from './DogeCurrencyIcon';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import { DunesTab } from './DunesTab';
import { CharmsTab } from './CharmsTab';
import { useWalletStore } from '../stores/walletStore';
import { NetworkChainBadge } from './dogeos/NetworkChainBadge';
import { NetworkSwitcher } from './dogeos/NetworkSwitcher';
import { DogeosBalanceHydrator } from './dogeos/DogeosBalanceHydrator';
import { DogecoinL1BalanceCard } from './dogeos/DogecoinL1BalanceCard';
import { DogeOSBalanceCard } from './dogeos/DogeOSBalanceCard';

interface WalletProps {
  onNavigateToSection?: (section: string) => void;
}

export const Wallet: React.FC<WalletProps> = ({ onNavigateToSection }) => {
  const { t } = useDojakwebI18n();
  const { connected: walletConnected, address: walletAddress, walletType } = useUnifiedWallet();
  const dogeosEnabled = useWalletStore((s) => s.dogeosEnabled);
  const pureDogeosMode = useWalletStore((s) => s.pureDogeosMode);
  const currentNetwork = useWalletStore((s) => s.currentNetwork);
  const dogeosAddress = useWalletStore((s) => s.dogeosAddress);
  const dogeosBalance = useWalletStore((s) => s.dogeosBalance);
  const {
    walletInfo,
    walletInfoError,
    drc20Tokens,
    dunes,
    charmsTokens,
    inscriptions,
    isLoadingWalletInfo,
    isLoadingDrc20Tokens,
    isLoadingInscriptions,
    isLoadingDunes,
    isLoadingCharms,
    drc20TokensError,
    inscriptionsError,
    dunesError,
    charmsError,
    refreshWalletData,
    refreshCharms,
    canRefreshWallet,
    timeUntilWalletRefresh,
    utxos,
    isLoadingUtxos,
  } = useDataProvider();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedInscription, setSelectedInscription] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);

  const copyToClipboard = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoading = isLoadingWalletInfo || isLoadingDrc20Tokens || isLoadingInscriptions || isLoadingDunes || isLoadingUtxos || isLoadingCharms;
  const filteredInscriptions = inscriptions?.filter((insc) => !drc20Tokens?.some((token) => token.inscriptionId === insc.inscriptionId)) || [];
  const utxoCount = utxos?.length ?? walletInfo?.totalUtxos ?? 0;

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        id: 'balance',
        name: t('walletPage.tab.balance'),
        icon: BanknotesIcon,
        badge: walletInfo?.balance ?? 0,
        badgeDogeIcon: true as const,
        content: (
          <div className="space-y-4">
            <div className="bg-bg-primary rounded-lg p-5 border border-border-primary">
              <p className="text-sm text-text-secondary">{t('walletPage.balance.confirmed')}</p>
              <p className="mt-2 text-3xl font-semibold text-text-primary"><DogeAmount doge={walletInfo?.balance ?? 0} decimals={4} iconSize="md" /></p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
                  <p className="text-xs uppercase tracking-wide text-text-secondary">{t('walletPage.balance.address')}</p>
                  <p className="mt-2 break-all font-mono text-sm text-text-primary">{walletAddress}</p>
                </div>
                <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
                  <p className="text-xs uppercase tracking-wide text-text-secondary">{t('walletPage.balance.snapshot')}</p>
                  <div className="mt-2 space-y-1 text-sm text-text-primary">
                    <p>{t('walletPage.balance.snapshotInscriptions', { n: String(filteredInscriptions.length) })}</p>
                    <p>{t('walletPage.balance.snapshotDrc20', { n: String(drc20Tokens?.length || 0) })}</p>
                    <p>{t('walletPage.balance.snapshotDunes', { n: String(dunes?.length || 0) })}</p>
                    <p>{t('walletPage.balance.snapshotUtxos', { n: String(utxoCount) })}</p>
                  </div>
                </div>
              </div>
            </div>
            {walletInfoError && <p className="text-center py-4 text-yellow-400">{walletInfoError}</p>}
          </div>
        ),
      },
      {
        id: 'inscriptions',
        name: t('walletPage.tab.inscriptions'),
        icon: CubeIcon,
        badge: filteredInscriptions.length,
        content: (
          <div className="space-y-4">
            {filteredInscriptions.map((inscription) => (
              <button
                key={inscription.inscriptionId}
                onClick={() => {
                  setSelectedInscription(inscription.inscriptionId);
                  setIsModalOpen(true);
                }}
                className="w-full text-left bg-bg-secondary rounded-lg p-4 border border-border-primary hover:border-primary-500 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-bg-tertiary rounded-lg flex items-center justify-center overflow-hidden">
                    {inscription.preview ? <img src={inscription.preview} alt={inscription.inscriptionId} className="w-full h-full object-cover rounded-lg" /> : <CubeIcon className="w-8 h-8 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate">{inscription.inscriptionId}</h3>
                    <p className="text-xs text-text-secondary mt-1">#{inscription.inscriptionNumber}</p>
                    <p className="text-xs text-text-secondary">{new Date(inscription.timestamp * 1000).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-secondary">{t('walletPage.inscriptions.value')}</p>
                    <p className="text-sm text-text-primary"><DogeAmount sats={parseInt(inscription.outputValue, 10)} /></p>
                  </div>
                </div>
              </button>
            ))}
            {filteredInscriptions.length === 0 && !isLoadingInscriptions && !inscriptionsError && (
              <p className="text-center py-8 text-text-secondary">{t('walletPage.inscriptions.empty')}</p>
            )}
            {inscriptionsError && <p className="text-center py-8 text-yellow-400">{inscriptionsError}</p>}
          </div>
        ),
      },
      {
        id: 'drc20',
        name: t('walletPage.tab.drc20'),
        icon: BanknotesIcon,
        badge: drc20Tokens?.length || 0,
        content: (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-medium text-amber-200">{t('walletPage.drc20.legacyBannerTitle')}</p>
              <p className="mt-1 text-xs text-text-secondary">{t('walletPage.drc20.legacyBannerBody')}</p>
              <a
                href="https://dogenals.org/docs/reference/which-protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-medium text-[#FCD34D] hover:underline"
              >
                {t('walletPage.drc20.migrateCta')} →
              </a>
            </div>
            {drc20Tokens?.length ? drc20Tokens.map((token) => (
              <div key={token.ticker} className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-text-primary">${token.ticker}</h3>
                    <p className="text-xs text-text-secondary">{t('walletPage.drc20.available', { n: Number(token.available).toLocaleString() })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-primary">{Number(token.balance).toLocaleString()}</p>
                    <p className="text-xs text-text-secondary">{t('walletPage.drc20.transferable', { n: Number(token.transferable).toLocaleString() })}</p>
                  </div>
                </div>
              </div>
            )) : !isLoadingDrc20Tokens && !drc20TokensError ? <p className="text-center py-8 text-text-secondary">{t('walletPage.drc20.empty')}</p> : null}
            {drc20TokensError && <p className="text-center py-8 text-yellow-400">{drc20TokensError}</p>}
          </div>
        ),
      },
      {
        id: 'dunes',
        name: t('walletPage.tab.dunes'),
        icon: CircleStackIcon,
        badge: dunes?.length || 0,
        content: (
          <DunesTab
            dunes={dunes ?? null}
            isLoading={isLoadingDunes}
            error={dunesError ?? null}
            onRefresh={refreshWalletData}
          />
        ),
      },
      {
        id: 'charms',
        name: t('walletPage.tab.charms'),
        icon: SparklesIcon,
        badge: charmsTokens?.size || 0,
        content: (
          <CharmsTab
            charmsTokens={charmsTokens ?? null}
            isLoading={isLoadingCharms}
            error={charmsError ?? null}
            onRefresh={refreshCharms}
          />
        ),
      },
    ];
    if (dogeosEnabled && pureDogeosMode && walletType === 'browser') {
      return [
        {
          id: 'dogeos',
          name: t('walletPage.dogeos.tab'),
          icon: CpuChipIcon,
          badge: dogeosBalance || '0',
          content: (
            <div className="space-y-4">
              <DogeosBalanceHydrator enabled={Boolean(dogeosAddress)} />
              {!dogeosAddress ? (
                <p className="text-sm text-text-secondary">{t('walletPage.dogeos.hintSync')}</p>
              ) : (
                <>
                  <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary">{t('walletPage.dogeos.addressLabel')}</p>
                    <p className="mt-2 break-all font-mono text-sm text-text-primary">{dogeosAddress}</p>
                  </div>
                  <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary">DogeOS</p>
                    <p className="mt-2 text-2xl font-semibold text-text-primary">{dogeosBalance || '…'} DOGE</p>
                  </div>
                </>
              )}
            </div>
          ),
        },
      ];
    }
    return baseTabs;
  }, [
      t,
      walletInfo?.balance,
      walletAddress,
      filteredInscriptions,
      drc20Tokens,
      dunes,
      charmsTokens,
      utxoCount,
      walletInfoError,
      isLoadingInscriptions,
      inscriptionsError,
      isLoadingDrc20Tokens,
      drc20TokensError,
      isLoadingDunes,
      dunesError,
      isLoadingCharms,
      charmsError,
      onNavigateToSection,
      refreshCharms,
      dogeosEnabled,
      pureDogeosMode,
      walletType,
      dogeosAddress,
      dogeosBalance,
    ]
  );

  useEffect(() => {
    if (activeTab >= tabs.length) {
      setActiveTab(0);
    }
  }, [activeTab, tabs.length]);

  if (!walletConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">{t('walletPage.notConnectedTitle')}</h2>
          <p className="text-text-secondary">{t('walletPage.notConnectedBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {dogeosEnabled && walletType === 'browser' ? (
        <DogeosBalanceHydrator enabled={Boolean(walletAddress)} />
      ) : null}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <h1 className="text-3xl font-bold text-text-primary">{t('walletPage.title')}</h1>
              {dogeosEnabled && walletType === 'browser' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <NetworkChainBadge network={pureDogeosMode ? 'dogeos' : currentNetwork} />
                  {!pureDogeosMode ? <NetworkSwitcher /> : null}
                </div>
              ) : null}
            </div>
            <p className="text-text-secondary mt-1">{t('walletPage.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsProviderModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary hover:border-primary-500 transition-colors" title={t('walletPage.dataProviderTitle')}>
              <Cog6ToothIcon className="w-5 h-5" />
              <span>{t('walletPage.dataProvider')}</span>
            </button>
            <button
              onClick={refreshWalletData}
              disabled={!canRefreshWallet || isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded-lg transition-colors disabled:opacity-50"
              title={
                !canRefreshWallet
                  ? t('walletPage.refreshWaitTitle', { seconds: String(Math.ceil(timeUntilWalletRefresh / 1000)) })
                  : t('walletPage.refreshTitle')
              }
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>
                {!canRefreshWallet
                  ? t('walletPage.waitSeconds', { seconds: String(Math.ceil(timeUntilWalletRefresh / 1000)) })
                  : t('walletPage.refresh')}
              </span>
            </button>
          </div>
        </div>

        {dogeosEnabled && walletType === 'browser' && !pureDogeosMode ? (
          <div className="mb-6 grid gap-3 md:grid-cols-2">
            <DogecoinL1BalanceCard
              balanceDisplay={`${(walletInfo?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} DOGE`}
            />
            <DogeOSBalanceCard
              balanceDisplay={`${dogeosBalance || '…'} DOGE`}
              addressShort={
                dogeosAddress ? `${dogeosAddress.slice(0, 6)}…${dogeosAddress.slice(-4)}` : undefined
              }
            />
          </div>
        ) : null}

        {!(dogeosEnabled && pureDogeosMode && walletType === 'browser') ? (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <p className="text-sm text-text-secondary">{t('walletPage.connectedWallet')}</p>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-sm md:text-base font-mono text-text-primary break-all">{walletAddress}</p>
              <button onClick={copyToClipboard} className="p-1 hover:bg-bg-primary rounded transition-colors" title={t('walletPage.copyAddressTitle')}>
                <ClipboardDocumentIcon className="w-5 h-5 text-text-secondary hover:text-primary-500" />
              </button>
            </div>
            {copied && <span className="text-xs text-green-500 font-medium">{t('walletPage.copied')}</span>}
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <p className="text-sm text-text-secondary">{t('walletPage.walletBalance')}</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary"><DogeAmount doge={walletInfo?.balance ?? 0} decimals={4} iconSize="md" /></p>
            {walletInfoError && <p className="mt-1 text-xs text-yellow-400">{walletInfoError}</p>}
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <p className="text-sm text-text-secondary">{t('walletPage.holdingsSummary')}</p>
            <div className="mt-2 space-y-1 text-sm text-text-primary">
              <p>{t('walletPage.inscriptionsCount', { n: String(filteredInscriptions.length) })}</p>
              <p>{t('walletPage.drc20Count', { n: String(drc20Tokens?.length || 0) })}</p>
              <p>{t('walletPage.dunesCount', { n: String(dunes?.length || 0) })}</p>
              <p>{t('walletPage.utxosDetected', { n: String(utxoCount) })}</p>
              {onNavigateToSection ? (
                <button
                  type="button"
                  onClick={() => onNavigateToSection('utxo-manager')}
                  className="mt-2 text-left text-sm font-medium text-primary-500 hover:text-primary-400"
                >
                  {t('walletPage.openUtxoManager')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        ) : null}
      </div>

      {isLoading && (
        <div className="mb-6 p-4 bg-bg-secondary rounded-lg border border-border-primary">
          <div className="flex items-center space-x-3">
            <ArrowPathIcon className="w-5 h-5 animate-spin text-primary-500" />
            <p className="text-text-secondary">{t('walletPage.loadingHoldings')}</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-text-primary">{t('walletPage.holdingsTitle')}</h2>
          <p className="text-sm text-text-secondary mt-1">{t('walletPage.holdingsDesc')}</p>
        </div>
        <div className="flex flex-wrap gap-1 border border-border-primary bg-bg-secondary p-1">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center justify-center space-x-2 border border-transparent px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === idx ? 'border-border-primary bg-bg-primary text-text-primary shadow-[0_-1px_0_rgba(255,255,255,0.12)]' : 'text-text-secondary hover:border-border-primary hover:bg-bg-primary hover:text-text-primary'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
              {'badge' in tab ? (
                <span className={`rounded-none border px-2 py-0.5 text-xs ${activeTab === idx ? 'border-border-primary bg-bg-secondary text-text-primary' : 'border-border-primary bg-bg-primary text-text-primary'}`}>
                  {typeof tab.badge === 'number' ? (
                    'badgeDogeIcon' in tab && tab.badgeDogeIcon ? (
                      <span className="inline-flex items-center gap-0.5">
                        {tab.badge.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        <DogeCurrencyIcon size="xs" />
                      </span>
                    ) : 'badgeLabel' in tab && tab.badgeLabel ? (
                      `${tab.badge.toLocaleString()} ${tab.badgeLabel}`
                    ) : Number.isFinite(Number(tab.badge)) ? (
                      Number(tab.badge).toLocaleString()
                    ) : (
                      tab.badge
                    )
                  ) : (
                    tab.badge
                  )}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-6 mt-4">
          {tabs[activeTab].content}
        </div>
      </div>

      <ProviderSettingsModal isOpen={isProviderModalOpen} onClose={() => setIsProviderModalOpen(false)} />
      <InscriptionModal inscriptionId={selectedInscription || ''} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedInscription(null); }} />
    </div>
  );
};
