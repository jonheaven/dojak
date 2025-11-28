import { useMemo } from 'react';

import { Column, Row } from '@/ui/components';
import { TabBar } from '@/ui/components/TabBar';
import { useAppDispatch } from '@/ui/state/hooks';
import { useCharmsAssetTabKey } from '@/ui/state/ui/hooks';
import { CharmsAssetTabKey, uiActions } from '@/ui/state/ui/reducer';

import { CharmsCollectionList } from './CharmsCollectionList';
import { CharmsList } from './CharmsList';

export function CharmsTab() {
  const tabKey = useCharmsAssetTabKey();

  const dispatch = useAppDispatch();

  const tabItems = useMemo(() => {
    const items = [
      {
        key: CharmsAssetTabKey.TOKEN,
        label: 'Tokens',
        children: <CharmsList />
      },
      {
        key: CharmsAssetTabKey.COLLECTION,
        label: 'Collections',
        children: <CharmsCollectionList />
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
            dispatch(uiActions.updateAssetTabScreen({ CharmsAssetTabKey: key }));
          }}
        />
      </Row>

      {tabItems[tabKey] ? tabItems[tabKey].children : null}
    </Column>
  );
}


