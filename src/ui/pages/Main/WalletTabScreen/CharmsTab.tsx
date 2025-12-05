import { useMemo, useState } from 'react';

import { Column, Row } from '@/ui/components';
import { TabBar } from '@/ui/components/TabBar';

import { CharmsCollectionList } from './CharmsCollectionList';
import { CharmsList } from './CharmsList';

// Local tab key enum for Charms sub-tabs
enum CharmsTabKey {
  TOKEN = 0,
  COLLECTION = 1
}

export function CharmsTab() {
  const [tabKey, setTabKey] = useState<CharmsTabKey>(CharmsTabKey.TOKEN);

  const tabItems = useMemo(() => {
    const items = [
      {
        key: CharmsTabKey.TOKEN,
        label: 'Tokens',
        children: <CharmsList />
      },
      {
        key: CharmsTabKey.COLLECTION,
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
            setTabKey(key as CharmsTabKey);
          }}
        />
      </Row>

      {tabItems[tabKey] ? tabItems[tabKey].children : null}
    </Column>
  );
}
