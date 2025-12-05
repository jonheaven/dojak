import { useMemo } from 'react';

import { Column, Row } from '@/ui/components';
import { TabBar } from '@/ui/components/TabBar';
import { useAppDispatch } from '@/ui/state/hooks';
import { useSteakAssetTabKey } from '@/ui/state/ui/hooks';
import { SteakAssetTabKey, uiActions } from '@/ui/state/ui/reducer';

export function SteakTab() {
  const tabKey = useSteakAssetTabKey();

  const dispatch = useAppDispatch();

  const tabItems = useMemo(() => {
    const items = [
      {
        key: SteakAssetTabKey.DASHBOARD,
        label: 'Dashboard',
        children: (
          <Column justifyCenter itemsCenter style={{ minHeight: 200 }}>
            <div className="text-4xl mb-4">🔒</div>
            <div className="text-white text-lg font-semibold mb-2">Steak Coming Soon</div>
            <div className="text-gray-400 text-center max-w-md">
              Dogecoin staking functionality will be available soon. Stake your DOGE to earn rewards and secure the
              network.
            </div>
          </Column>
        )
      },
      {
        key: SteakAssetTabKey.STAKES,
        label: 'My Stakes',
        children: (
          <Column justifyCenter itemsCenter style={{ minHeight: 200 }}>
            <div className="text-4xl mb-4">⚡</div>
            <div className="text-white text-lg font-semibold mb-2">No Active Stakes</div>
            <div className="text-gray-400 text-center max-w-md">
              You don't have any active stakes yet. Staking functionality will be implemented in a future update.
            </div>
          </Column>
        )
      },
      {
        key: SteakAssetTabKey.HISTORY,
        label: 'History',
        children: (
          <Column justifyCenter itemsCenter style={{ minHeight: 200 }}>
            <div className="text-4xl mb-4">📊</div>
            <div className="text-white text-lg font-semibold mb-2">Staking History</div>
            <div className="text-gray-400 text-center max-w-md">
              Your staking history will appear here once you start staking DOGE tokens.
            </div>
          </Column>
        )
      }
    ];

    return items;
  }, []);

  return (
    <Column>
      <Row justifyBetween>
        <TabBar
          defaultActiveKey={tabKey}
          activeKey={tabKey}
          items={tabItems}
          preset="style2"
          onTabClick={(key) => {
            dispatch(uiActions.updateAssetTabScreen({ steakAssetTabKey: key }));
          }}
        />
      </Row>

      {tabItems[tabKey] ? tabItems[tabKey].children : null}
    </Column>
  );
}
