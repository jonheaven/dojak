import { useEffect, useState } from 'react';

import { Content, Header, Layout } from '@dojak/ui/components';
import LoadingPage from '@dojak/ui/components/LoadingPage';
import { useI18n } from '@dojak/ui/hooks/useI18n';

import { EnableSignDataCard } from './EnableSignData';
import { LanguageCard } from './Language';
import { LocalNodeCard } from './LocalNodeCard';
import { IndexerURLCard } from './IndexerURLCard';
import { SecurityCard } from './SecurityCard';

export default function AdvancedScreen() {
  const { t } = useI18n();
  const [init, setInit] = useState(false);
  useEffect(() => {
    setTimeout(() => {
      setInit(true);
    }, 300);
  }, []);

  if (!init) {
    return <LoadingPage />;
  }

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('advanced')}
      />
      <Content>
        <LanguageCard />

        <SecurityCard />

        <IndexerURLCard />

        <LocalNodeCard />

        <EnableSignDataCard />
      </Content>
    </Layout>
  );
}
