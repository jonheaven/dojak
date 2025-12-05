import { Avatar, Button, Card, Empty, Input, List, Spin, Tabs, Tag } from 'antd';
import { useState } from 'react';

import { useWallet } from '@/ui/utils';
import { AppstoreOutlined, DollarOutlined, GlobalOutlined, SearchOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;

interface SearchResult {
  type: 'doginal' | 'token' | 'domain' | 'charm';
  data: any;
}

export const GlobalSearchScreen = () => {
  const wallet = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    doginals: any[];
    tokens: any[];
    domains: any[];
    charms: any[];
  }>({
    doginals: [],
    tokens: [],
    domains: [],
    charms: []
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    try {
      setLoading(true);

      // Search across all metaprotocols
      const [doginalsResult, tokensResult, contentResult] = await Promise.all([
        wallet.searchDoginals({ address: undefined, limit: 10 }), // Search all doginals
        wallet.searchTokens({ ticker: searchTerm, limit: 10 }),
        wallet.searchByContent(searchTerm, undefined, 10)
      ]);

      // Try DNS resolution
      let domainResult = null;
      try {
        domainResult = await wallet.resolveDNS(searchTerm);
      } catch (e) {
        // Domain not found
      }

      // Try Charms search
      let charmsResult = { list: [] };
      try {
        charmsResult = await wallet.getCharmsByApp(searchTerm, 10);
      } catch (e) {
        // Charms search failed
      }

      setResults({
        doginals: contentResult.results || [],
        tokens: tokensResult.list || [],
        domains: domainResult ? [domainResult] : [],
        charms: charmsResult.list || []
      });
    } catch (error) {
      console.error('Global search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderDoginalResult = (doginal: any) => (
    <List.Item
      key={doginal.id}
      className="hover:bg-[#1a1a1a] cursor-pointer"
      onClick={() => window.open(`https://dojak.com/inscription/${doginal.inscriptionId}`, '_blank')}
    >
      <List.Item.Meta
        avatar={
          <Avatar src={doginal.content} shape="square" size={48} style={{ background: '#262222' }}>
            🐸
          </Avatar>
        }
        title={
          <div className="flex items-center gap-2">
            <span className="text-white">Doginal #{doginal.id}</span>
            <Tag color={getRarityColor(doginal.rarity)} size="small">
              {doginal.rarity}
            </Tag>
          </div>
        }
        description={
          <div className="text-gray-400 text-sm">
            {doginal.contentType} • Score: {doginal.rarityScore}
          </div>
        }
      />
    </List.Item>
  );

  const renderTokenResult = (token: any) => (
    <List.Item key={token.ticker}>
      <List.Item.Meta
        avatar={<DollarOutlined className="text-[#069420] text-xl" />}
        title={<span className="text-white font-medium">{token.name || token.ticker}</span>}
        description={
          <div className="text-gray-400 text-sm">
            Ticker: {token.ticker} • Supply: {token.supply || 'N/A'}
          </div>
        }
      />
    </List.Item>
  );

  const renderDomainResult = (domain: any) => (
    <List.Item key={domain.name}>
      <List.Item.Meta
        avatar={<GlobalOutlined className="text-[#2196F3] text-xl" />}
        title={<span className="text-white font-medium">{domain.name}.doge</span>}
        description={<div className="text-gray-400 text-sm font-mono">{domain.address}</div>}
      />
    </List.Item>
  );

  const renderCharmResult = (charm: any) => (
    <List.Item key={charm.id}>
      <List.Item.Meta
        avatar={<AppstoreOutlined className="text-[#FF9800] text-xl" />}
        title={
          <div className="flex items-center gap-2">
            <span className="text-white">{charm.name}</span>
            <Tag color="orange" size="small">
              {charm.app}
            </Tag>
          </div>
        }
        description={
          <div className="text-gray-400 text-sm">
            Collection: {charm.collection} • {charm.traits?.join(', ')}
          </div>
        }
      />
    </List.Item>
  );

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'default';
      case 'uncommon':
        return 'yellow';
      case 'rare':
        return 'blue';
      case 'epic':
        return 'purple';
      case 'legendary':
        return 'orange';
      default:
        return 'default';
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Global Search</h1>

        <Card className="bg-[#262222] border-[#333]">
          <div className="flex gap-2">
            <Input
              placeholder="Search across Doginals, tokens, domains, and charms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onPressEnter={handleSearch}
              size="large"
              prefix={<SearchOutlined />}
            />
            <Button
              type="primary"
              size="large"
              onClick={handleSearch}
              loading={loading}
              className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
            >
              Search
            </Button>
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spin size="large" />
        </div>
      ) : (
        <Tabs defaultActiveKey="all" className="search-results-tabs">
          <TabPane
            tab={`All (${
              results.doginals.length + results.tokens.length + results.domains.length + results.charms.length
            })`}
            key="all"
          >
            <div className="space-y-4">
              {results.doginals.length > 0 && (
                <Card
                  title={`🐸 Doginals (${results.doginals.length})`}
                  size="small"
                  className="bg-[#262222] border-[#333]"
                >
                  <List dataSource={results.doginals.slice(0, 5)} renderItem={renderDoginalResult} />
                </Card>
              )}

              {results.tokens.length > 0 && (
                <Card
                  title={`💰 Tokens (${results.tokens.length})`}
                  size="small"
                  className="bg-[#262222] border-[#333]"
                >
                  <List dataSource={results.tokens.slice(0, 5)} renderItem={renderTokenResult} />
                </Card>
              )}

              {results.domains.length > 0 && (
                <Card
                  title={`🌐 Domains (${results.domains.length})`}
                  size="small"
                  className="bg-[#262222] border-[#333]"
                >
                  <List dataSource={results.domains} renderItem={renderDomainResult} />
                </Card>
              )}

              {results.charms.length > 0 && (
                <Card
                  title={`✨ Charms (${results.charms.length})`}
                  size="small"
                  className="bg-[#262222] border-[#333]"
                >
                  <List dataSource={results.charms.slice(0, 5)} renderItem={renderCharmResult} />
                </Card>
              )}

              {results.doginals.length === 0 &&
                results.tokens.length === 0 &&
                results.domains.length === 0 &&
                results.charms.length === 0 &&
                searchTerm && <Empty description="No results found" className="text-gray-400" />}
            </div>
          </TabPane>

          <TabPane tab={`🐸 Doginals (${results.doginals.length})`} key="doginals">
            <Card className="bg-[#262222] border-[#333]">
              {results.doginals.length > 0 ? (
                <List dataSource={results.doginals} renderItem={renderDoginalResult} />
              ) : (
                <Empty description="No Doginals found" className="text-gray-400" />
              )}
            </Card>
          </TabPane>

          <TabPane tab={`💰 Tokens (${results.tokens.length})`} key="tokens">
            <Card className="bg-[#262222] border-[#333]">
              {results.tokens.length > 0 ? (
                <List dataSource={results.tokens} renderItem={renderTokenResult} />
              ) : (
                <Empty description="No tokens found" className="text-gray-400" />
              )}
            </Card>
          </TabPane>

          <TabPane tab={`🌐 Domains (${results.domains.length})`} key="domains">
            <Card className="bg-[#262222] border-[#333]">
              {results.domains.length > 0 ? (
                <List dataSource={results.domains} renderItem={renderDomainResult} />
              ) : (
                <Empty description="No domains found" className="text-gray-400" />
              )}
            </Card>
          </TabPane>

          <TabPane tab={`✨ Charms (${results.charms.length})`} key="charms">
            <Card className="bg-[#262222] border-[#333]">
              {results.charms.length > 0 ? (
                <List dataSource={results.charms} renderItem={renderCharmResult} />
              ) : (
                <Empty description="No charms found" className="text-gray-400" />
              )}
            </Card>
          </TabPane>
        </Tabs>
      )}
    </div>
  );
};
