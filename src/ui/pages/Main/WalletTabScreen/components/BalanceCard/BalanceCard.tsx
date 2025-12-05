import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { ChainType } from '@/shared/constant';
import { Icon, Row, Tooltip } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { DOGEUSD } from '@/ui/components/DOGEUSD';
import { RefreshButton } from '@/ui/components/RefreshButton';
import { getSpecialLocale, useI18n } from '@/ui/hooks/useI18n';
import { useRealtimeUpdates } from '@/ui/hooks/useRealtimeUpdates';
import { useUtxoTools } from '@/ui/hooks/useUtxoTools';
import { AppState } from '@/ui/state';
import { useFetchBalanceCallback } from '@/ui/state/accounts/hooks';
import { accountActions } from '@/ui/state/accounts/reducer';
import { useChain, useDOGEUnit } from '@/ui/state/settings/hooks';
import { uiActions } from '@/ui/state/ui/reducer';
import { satoshisToAmount, useWallet } from '@/ui/utils';

import styles from './BalanceCard.module.less';
import { BalanceCardProps } from './interface';

const DEBOUNCE_DELAY = 1000;

const tooltipStyle = {
  maxWidth: '328px',
  borderRadius: '8px',
  background: '#1D1E23',
  width: '328px',
  padding: '12px 16px',
  color: '#FFF',
  fontSize: '14px',
  lineHeight: '20px',
  fontFamily: 'Inter-Regular',
  boxShadow: '0px 12px 20px 0px rgba(0, 0, 0, 0.25)',
  marginLeft: '-50px'
};

export function BalanceCard({
  accountBalance,
  disableUtxoTools = true,
  enableRefresh = false,
  address
}: BalanceCardProps) {
  const { t } = useI18n();
  const btcUnit = useDOGEUnit();
  const chain = useChain();
  const [isExpanded, setIsExpanded] = useState(true);
  const dispatch = useDispatch();
  const isBalanceHidden = useSelector((state: AppState) => state.ui.isBalanceHidden);
  const isBtcMainnet = chain.enum === ChainType.BITCOIN_MAINNET;
  const wallet = useWallet();
  const tools = useTools();

  const [isSpecialLocale, setIsSpecialLocale] = useState(false);
  const [multiAssetBalance, setMultiAssetBalance] = useState<any>(null);
  const [showMultiAsset, setShowMultiAsset] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBalance = useFetchBalanceCallback();

  // Fetch multi-asset balance
  const fetchMultiAssetBalance = async () => {
    if (!address) return;

    try {
      const balance = await wallet.getMultiAssetBalance(address);
      setMultiAssetBalance(balance);
    } catch (error) {
      console.error('Failed to fetch multi-asset balance:', error);
      tools.toastError(t('Failed to fetch multi-asset balance'));
    }
  };

  // Real-time updates for balance changes
  const { refreshData: refreshRealtimeData } = useRealtimeUpdates({
    enableAddressUpdates: true,
    onAddressUpdate: (event) => {
      console.log('[BalanceCard] Real-time address update:', event);
      // Refresh balance when new transactions are detected
      if (event.balance && !event.manual) {
        setMultiAssetBalance(event.balance);
        // Trigger UI balance refresh
        dispatch(accountActions.expireBalance());
        fetchBalance();
      }
    },
    onError: (error) => {
      console.error('[BalanceCard] Real-time update error:', error);
      tools.toastError(t('Failed to update balance in real-time'));
    }
  });

  useEffect(() => {
    getSpecialLocale().then(({ isSpecialLocale }) => {
      setIsSpecialLocale(isSpecialLocale);
    });
  }, []);

  const { openUtxoTools } = useUtxoTools(chain);

  const backgroundImage = chain.isFractal
    ? './images/artifacts/balance-bg-fb.png'
    : './images/artifacts/balance-bg-btc.png';

  const totalAmount = satoshisToAmount(accountBalance.totalBalance);
  const availableAmount = satoshisToAmount(accountBalance.availableBalance);
  const unavailableAmount = satoshisToAmount(accountBalance.unavailableBalance);

  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleBalanceVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(uiActions.setBalanceHidden(!isBalanceHidden));
  };

  const refreshBalance = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          dispatch(accountActions.expireBalance());
          await fetchBalance();
          if (address) {
            await fetchMultiAssetBalance();
            // Also trigger real-time refresh
            try {
              await refreshRealtimeData();
            } catch (error) {
              console.error('[BalanceCard] Real-time refresh failed:', error);
              tools.toastError(t('Failed to refresh balance data'));
            }
          }
        } catch (error) {
          console.error('[BalanceCard] Balance refresh failed:', error);
          tools.toastError(t('Failed to refresh balance'));
        }
        debounceTimerRef.current = null;
      }, DEBOUNCE_DELAY);
    },
    [dispatch, fetchBalance, address, fetchMultiAssetBalance, refreshRealtimeData]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Passive refresh every 10 seconds
  useEffect(() => {
    if (!enableRefresh) return;

    const intervalId = setInterval(() => {
      dispatch(accountActions.expireBalance());
      fetchBalance();
      if (address) {
        fetchMultiAssetBalance();
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [dispatch, fetchBalance, enableRefresh, address, fetchMultiAssetBalance]);

  useEffect(() => {
    if (address) {
      fetchMultiAssetBalance();
    }
  }, [address, fetchMultiAssetBalance]);

  const EyeIcon = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
    <div onClick={onClick} style={{ cursor: 'pointer' }}>
      <Icon icon={isBalanceHidden ? 'balance-eyes-closed' : 'balance-eyes'} size={16} />
    </div>
  );

  const handleUnlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disableUtxoTools) return;
    openUtxoTools();
  };

  return (
    <div
      className={classNames(
        styles.container,
        isExpanded ? styles.expanded : styles.collapsed,
        showMultiAsset ? styles.multiAssetExpanded : ''
      )}
      onClick={handleExpandToggle}
      style={{ margin: '0 auto' }}
    >
      <div className={styles.decorativeLineOne} />
      <div className={styles.decorativeLineTwo} />
      <img className={styles.decorativeImage} src={backgroundImage} alt="Balance background" />

      <div className={styles.header}>
        {t('total_balance')}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          {/* Real-time indicator */}
          <div className={styles.realtimeIndicator} title="Real-time updates active">
            <div className={styles.realtimeDot}></div>
          </div>
          <EyeIcon onClick={toggleBalanceVisibility} />
          {enableRefresh && <RefreshButton onClick={refreshBalance as any} hideText />}
        </div>
      </div>

      <div className={styles.balanceWrapper}>
        <div className={styles.balanceContent}>
          <span className={styles.balanceNumber}>{isBalanceHidden ? '*****' : totalAmount.split('.')[0]}</span>
          {!isBalanceHidden && (
            <>
              <span className={styles.decimal} style={{ color: isBtcMainnet ? '#000' : 'rgba(0, 0, 0, 0.45)' }}>
                .{totalAmount.split('.')[1]}
              </span>
              <span className={styles.unit}>{btcUnit}</span>
            </>
          )}
          {isBalanceHidden && <span className={styles.unit}>{btcUnit}</span>}
        </div>
        <Icon icon="balance-right" size={10} containerStyle={{ transform: `rotate(${isExpanded ? 270 : 90}deg)` }} />
      </div>

      <div className={styles.usdValue}>
        <DOGEUSD sats={accountBalance.totalBalance} color="black_muted" size="sm" isHidden={isBalanceHidden} />
      </div>

      {/* Expandable details */}
      <div className={styles.detailsWrapper}>
        <Row itemsCenter fullY mx="md" justifyCenter={disableUtxoTools}>
          <div className={styles.column}>
            <span className={styles.label}>{t('available')}</span>
            <div className={styles.detailsAmount}>
              <span>{isBalanceHidden ? '*****' : availableAmount.split('.')[0]}</span>
              {!isBalanceHidden && <span className={styles.detailsDecimal}>.{availableAmount.split('.')[1]}</span>}
              <span>{btcUnit}</span>
            </div>
          </div>

          {disableUtxoTools ? <div className={styles.divider} /> : null}

          <Row itemsCenter gap="zero">
            {disableUtxoTools == false ? <div className={styles.divider} /> : null}
            <div className={styles.column}>
              <Tooltip
                overlayStyle={{
                  maxWidth: '328px',
                  padding: 0
                }}
                autoAdjustOverflow={false}
                arrowPointAtCenter={true}
                align={{
                  points: ['bc', 'tc'],
                  offset: [10, 0],
                  overflow: {
                    adjustX: true,
                    adjustY: true
                  }
                }}
                overlayInnerStyle={tooltipStyle}
                title={t('unavailable_tooltip')}
                placement="top"
                destroyTooltipOnHide={true}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                  <span className={styles.label}>{t('unavailable')}</span>

                  <span className={styles.questionIconWrapper}>
                    <Icon icon="balance-question" style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  </span>
                </div>
              </Tooltip>
              <div className={styles.detailsAmount}>
                <span>{isBalanceHidden ? '*****' : unavailableAmount.split('.')[0]}</span>
                {!isBalanceHidden && <span className={styles.detailsDecimal}>.{unavailableAmount.split('.')[1]}</span>}
                <span>{btcUnit}</span>
              </div>
            </div>

            {disableUtxoTools == false && (
              <Row>
                <div onClick={handleUnlock}>
                  <div className={classNames(styles.unlockButton, { [styles.disabled]: disableUtxoTools })}>
                    <span
                      style={{
                        marginRight: isSpecialLocale ? '0' : '2px',
                        fontSize: isSpecialLocale ? '8px' : '12px'
                      }}
                    >
                      {t('unlock')}
                    </span>
                    {!isSpecialLocale && <Icon icon="balance-unlock-right" size={14} />}
                  </div>
                </div>
              </Row>
            )}
          </Row>
        </Row>

        {/* Multi-asset balance toggle */}
        {multiAssetBalance && (
          <div className={styles.multiAssetToggle} onClick={() => setShowMultiAsset(!showMultiAsset)}>
            <span className={styles.label}>Multi-Asset Portfolio</span>
            <Icon
              icon="balance-right"
              size={10}
              containerStyle={{ transform: `rotate(${showMultiAsset ? 270 : 90}deg)` }}
            />
          </div>
        )}

        {/* Multi-asset balance details */}
        {showMultiAsset && multiAssetBalance && (
          <div className={styles.multiAssetDetails}>
            {/* DRC-20 Tokens */}
            {Object.keys(multiAssetBalance.drc20 || {}).length > 0 && (
              <div className={styles.assetSection}>
                <span className={styles.assetSectionTitle}>DRC-20 Tokens</span>
                <div className={styles.assetList}>
                  {Object.entries(multiAssetBalance.drc20).map(([ticker, amount]: [string, any]) => (
                    <div key={ticker} className={styles.assetItem}>
                      <span className={styles.assetName}>{ticker}</span>
                      <span className={styles.assetAmount}>{Number(amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DogeMaps */}
            {(multiAssetBalance.dogemaps || []).length > 0 && (
              <div className={styles.assetSection}>
                <span className={styles.assetSectionTitle}>DogeMaps ({multiAssetBalance.totals?.dogemaps || 0})</span>
                <div className={styles.assetList}>
                  {multiAssetBalance.dogemaps.slice(0, 5).map((parcel: number) => (
                    <div key={parcel} className={styles.assetItem}>
                      <span className={styles.assetName}>Parcel #{parcel}</span>
                    </div>
                  ))}
                  {multiAssetBalance.dogemaps.length > 5 && (
                    <div className={styles.assetItem}>
                      <span className={styles.assetName}>+{multiAssetBalance.dogemaps.length - 5} more</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DNS Domains */}
            {((multiAssetBalance.dns?.protocol_domains || []).length > 0 ||
              (multiAssetBalance.dns?.legacy_domains || []).length > 0) && (
              <div className={styles.assetSection}>
                <span className={styles.assetSectionTitle}>
                  DNS Domains (
                  {(multiAssetBalance.dns?.protocol_domains?.length || 0) +
                    (multiAssetBalance.dns?.legacy_domains?.length || 0)}
                  )
                </span>
                <div className={styles.assetList}>
                  {[
                    ...(multiAssetBalance.dns?.protocol_domains || []),
                    ...(multiAssetBalance.dns?.legacy_domains || [])
                  ]
                    .slice(0, 5)
                    .map((domain: string) => (
                      <div key={domain} className={styles.assetItem}>
                        <span className={styles.assetName}>{domain}.doge</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Dunes */}
            {Object.keys(multiAssetBalance.dunes || {}).length > 0 && (
              <div className={styles.assetSection}>
                <span className={styles.assetSectionTitle}>Dunes ({multiAssetBalance.totals?.dunes || 0})</span>
                <div className={styles.assetList}>
                  {Object.entries(multiAssetBalance.dunes).map(([ticker, amount]: [string, any]) => (
                    <div key={ticker} className={styles.assetItem}>
                      <span className={styles.assetName}>{ticker}</span>
                      <span className={styles.assetAmount}>{Number(amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charms */}
            {(multiAssetBalance.charms?.rarity?.length > 0 || multiAssetBalance.charms?.royalty?.length > 0) && (
              <div className={styles.assetSection}>
                <span className={styles.assetSectionTitle}>Charms</span>
                <div className={styles.assetList}>
                  {multiAssetBalance.charms?.rarity?.map((charm: string) => (
                    <div key={charm} className={styles.assetItem}>
                      <span className={styles.assetName}>Rarity: {charm}</span>
                    </div>
                  ))}
                  {multiAssetBalance.charms?.royalty?.map((royalty: string) => (
                    <div key={royalty} className={styles.assetItem}>
                      <span className={styles.assetName}>Royalty: {royalty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
