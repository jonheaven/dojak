import { Content, Layout } from '@dojak/ui/components';

import { Spin } from '../Spin';

export default function LoadingPage() {
  return (
    <Layout>
      <Content
        preset="middle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%'
        }}
      >
        <Spin size="large" />
      </Content>
    </Layout>
  );
}
