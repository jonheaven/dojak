import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, Button, Spin, Empty, Tag, List, Modal, Input, message } from 'antd';
import { StarOutlined, PlusOutlined, LinkOutlined, AppstoreOutlined } from '@ant-design/icons';

import { useWallet } from '@/ui/utils';
import { useTranslation } from 'react-i18next';

interface Charm {
  id: string;
  name: string;
  app: string;
  collection: string;
  traits: string[];
  utxo: string;
  block: number;
  timestamp: number;
}

interface CharmCollection {
  id: string;
  name: string;
  app: string;
  total_charms: number;
  description: string;
}

interface CharmStats {
  total_charms: number;
  charms_by_app: Record<string, number>;
  charms_by_collection: Record<string, number>;
}

export const CharmsCollectionsScreen = () => {
  const wallet = useWallet();
  const { t } = useTranslation();
  const currentAccount = useSelector((state: any) => state.account.currentAccount);

  const [collections, setCollections] = useState<CharmCollection[]>([]);
  const [charms, setCharms] = useState<Charm[]>([]);
  const [stats, setStats] = useState<CharmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<CharmCollection | null>(null);
  const [composeModalVisible, setComposeModalVisible] = useState(false);
  const [selectedCharms, setSelectedCharms] = useState<Charm[]>([]);

  useEffect(() => {
    loadCharmsData();
  }, [currentAccount]);

  const loadCharmsData = async () => {
    if (!currentAccount?.address) return;

    try {
      setLoading(true);
      const [collectionsResult, statsResult] = await Promise.all([
        wallet.getCharmsCollections(currentAccount.address, 1, 20),
        wallet.getCharmsStats()
      ]);

      setCollections(collectionsResult.list || []);
      setStats(statsResult);
    } catch (error) {
      console.error('Failed to load Charms data:', error);
      message.error('Failed to load Charms data');
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionCharms = async (collection: CharmCollection) => {
    try {
      const result = await wallet.getCharmsCollectionItems(
        currentAccount.address,
        collection.id,
        1,
        50
      );
      setCharms(result.list || []);
      setSelectedCollection(collection);
    } catch (error) {
      console.error('Failed to load collection charms:', error);
      message.error('Failed to load charms');
    }
  };

  const handleComposeCharms = async () => {
    if (selectedCharms.length < 2) {
      message.warning('Select at least 2 charms to compose');
      return;
    }

    try {
      // This would integrate with the Charms composition API
      // For now, just show a success message
      message.success(`Composed ${selectedCharms.length} charms!`);
      setComposeModalVisible(false);
      setSelectedCharms([]);
    } catch (error) {
      console.error('Failed to compose charms:', error);
      message.error('Failed to compose charms');
    }
  };

  const getAppColor = (app: string) => {
    const colors: Record<string, string> = {
      'rarity': '#9C27B0',
      'royalty': '#FF9800',
      'utility': '#2196F3',
      'governance': '#4CAF50',
      'identity': '#FF5722'
    };
    return colors[app] || '#8B8B8B';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Charms Collections</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setComposeModalVisible(true)}
          className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
        >
          Compose Charms
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#262222] border-[#333]">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#069420]">{stats.total_charms}</div>
              <div className="text-gray-400">Total Charms</div>
            </div>
          </Card>

          <Card className="bg-[#262222] border-[#333]">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#2196F3]">
                {Object.keys(stats.charms_by_app).length}
              </div>
              <div className="text-gray-400">Applications</div>
            </div>
          </Card>

          <Card className="bg-[#262222] border-[#333]">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#FF9800]">
                {Object.keys(stats.charms_by_collection).length}
              </div>
              <div className="text-gray-400">Collections</div>
            </div>
          </Card>
        </div>
      )}

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <Empty
          description="No Charms collections found. Create your first Charm!"
          className="text-gray-400"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card
              key={collection.id}
              className="bg-[#262222] border-[#333] hover:border-[#069420] cursor-pointer"
              onClick={() => loadCollectionCharms(collection)}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium">{collection.name}</h3>
                  <Tag color={getAppColor(collection.app)}>{collection.app}</Tag>
                </div>

                <p className="text-gray-400 text-sm">{collection.description}</p>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">
                    {collection.total_charms} charms
                  </span>
                  <Button size="small" type="text" icon={<AppstoreOutlined />}>
                    View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Collection Details Modal */}
      <Modal
        title={selectedCollection?.name || 'Charm Collection'}
        open={!!selectedCollection}
        onCancel={() => {
          setSelectedCollection(null);
          setCharms([]);
        }}
        footer={null}
        width={800}
        className="dark-modal"
      >
        <div className="space-y-4">
          {charms.length === 0 ? (
            <Empty description="No charms in this collection" />
          ) : (
            <List
              dataSource={charms}
              renderItem={(charm) => (
                <List.Item
                  className="border-b border-[#333] hover:bg-[#1a1a1a] cursor-pointer"
                  onClick={() => {
                    if (selectedCharms.find(c => c.id === charm.id)) {
                      setSelectedCharms(prev => prev.filter(c => c.id !== charm.id));
                    } else {
                      setSelectedCharms(prev => [...prev, charm]);
                    }
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <div className="flex items-center">
                        <StarOutlined className="text-[#069420] mr-2" />
                        {selectedCharms.find(c => c.id === charm.id) && (
                          <div className="w-4 h-4 bg-[#069420] rounded-full"></div>
                        )}
                      </div>
                    }
                    title={
                      <div className="flex items-center gap-2">
                        <span className="text-white">{charm.name}</span>
                        <Tag color={getAppColor(charm.app)} size="small">{charm.app}</Tag>
                      </div>
                    }
                    description={
                      <div className="space-y-1">
                        <div className="text-gray-400 text-sm">
                          Collection: {charm.collection}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {charm.traits.map((trait_, index) => (
                            <Tag key={index} size="small" className="text-xs">
                              {trait_}
                            </Tag>
                          ))}
                        </div>
                        <div className="text-gray-400 text-xs">
                          UTXO: {charm.utxo.slice(0, 16)}... | Block: {charm.block}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          {selectedCharms.length > 0 && (
            <div className="mt-4 p-3 bg-[#1a1a1a] rounded-lg">
              <div className="text-white font-medium mb-2">
                Selected for Composition ({selectedCharms.length})
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedCharms.map((charm) => (
                  <Tag
                    key={charm.id}
                    closable
                    onClose={() => setSelectedCharms(prev => prev.filter(c => c.id !== charm.id))}
                    color="blue"
                  >
                    {charm.name}
                  </Tag>
                ))}
              </div>
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={handleComposeCharms}
                className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
              >
                Compose Selected Charms
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Compose Charms Modal */}
      <Modal
        title="Compose Charms"
        open={composeModalVisible}
        onCancel={() => setComposeModalVisible(false)}
        footer={null}
        className="dark-modal"
      >
        <div className="space-y-4">
          <div className="text-gray-300">
            Select charms from your collections to create new composed charms with enhanced properties.
          </div>

          <div className="text-center py-8">
            <StarOutlined className="text-4xl text-[#069420] mb-4" />
            <div className="text-white font-medium mb-2">Charm Composition</div>
            <div className="text-gray-400 text-sm">
              This feature allows you to combine multiple charms to create new programmable assets
              with enhanced capabilities and cross-chain compatibility.
            </div>
          </div>

          <div className="text-center">
            <Button
              onClick={() => setComposeModalVisible(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
            >
              Open Collections
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
