import { GlobalOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Empty, Input, List, message, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { useWallet } from '@/ui/utils';
import { useTranslation } from 'react-i18next';
import { DNSDomain, DNSResolution } from './types';

export const DNSDomainsScreen = () => {
  const wallet = useWallet();
  const { t } = useTranslation();
  const currentAccount = useSelector((state: any) => state.account.currentAccount);

  const [domains, setDomains] = useState<DNSDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<DNSResolution | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadDomains();
  }, [currentAccount]);

  const loadDomains = async () => {
    if (!currentAccount?.address) return;

    try {
      setLoading(true);
      const result = await wallet.reverseResolveDNS(currentAccount.address);
      setDomains(result.domains || []);
    } catch (error) {
      console.error('Failed to load DNS domains:', error);
      message.error('Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const result = await wallet.resolveDNS(searchQuery.trim());
      if (result) {
        setSearchResult(result);
      } else {
        setSearchResult(null);
        message.info('Domain not found');
      }
    } catch (error) {
      console.error('Failed to resolve domain:', error);
      message.error('Failed to resolve domain');
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleDomainClick = (domain: DNSDomain) => {
    // Copy address to clipboard
    navigator.clipboard.writeText(domain.address);
    message.success('Address copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">DNS Domains</h1>
      </div>

      {/* Domain Search */}
      <Card className="mb-6 bg-[#262222] border-[#333]">
        <div className="flex gap-2">
          <Input
            placeholder="Search for .pepe domain (e.g., alice.pepe)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            className="flex-1"
            prefix={<GlobalOutlined />}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={searching}
            className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
          >
            Resolve
          </Button>
        </div>

        {searchResult && (
          <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg">
            <div className="flex items-center gap-3">
              <Avatar
                src={searchResult.avatar}
                icon={<UserOutlined />}
                size={48}
                className="border-2 border-[#069420]"
              />
              <div className="flex-1">
                <div className="text-white font-medium text-lg">{searchResult.name}.pepe</div>
                <div className="text-gray-400 text-sm font-mono break-all">{searchResult.address}</div>
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(searchResult.address);
                  message.success('Address copied!');
                }}
                size="small"
              >
                Copy
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* My Domains */}
      <Card className="bg-[#262222] border-[#333]">
        <h2 className="text-xl font-bold text-white mb-4">My Domains</h2>

        {domains.length === 0 ? (
          <Empty
            description="No domains found. Register your first .pepe domain!"
            className="text-gray-400"
          />
        ) : (
          <List
            dataSource={domains}
            renderItem={(domain) => (
              <List.Item
                className="border-b border-[#333] last:border-b-0 hover:bg-[#1a1a1a] cursor-pointer"
                onClick={() => handleDomainClick(domain)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      src={domain.avatar}
                      icon={<GlobalOutlined />}
                      className="border border-[#069420]"
                    />
                  }
                  title={
                    <span className="text-white font-medium">
                      {domain.name}.pepe
                    </span>
                  }
                  description={
                    <div className="text-gray-400 text-sm">
                      <div className="font-mono text-xs break-all">{domain.address}</div>
                      <div className="mt-1">
                        Registered: {new Date(domain.timestamp * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Info Card */}
      <Card className="mt-6 bg-[#262222] border-[#333]">
        <div className="text-center">
          <GlobalOutlined className="text-4xl text-[#069420] mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">What is DNS?</h3>
          <p className="text-gray-400 text-sm">
            DNS (Dogecoin Name System) allows you to register human-readable domain names
            ending in .pepe that resolve to Dogecoin addresses. Perfect for easy sharing
            and identity on the Pepe blockchain.
          </p>
        </div>
      </Card>
    </div>
  );
};
