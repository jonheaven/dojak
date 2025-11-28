import { DollarOutlined, FilterOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Form, InputNumber, message, Modal, Select, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { useWallet } from '@/ui/utils';
import { useTranslation } from 'react-i18next';
import { Doginal } from './types';

const { Option } = Select;

interface MarketplaceListing {
  id: string;
  pepinal_id: string;
  collection?: string;
  rarity: string;
  price_pep: number;
  seller_addr: string;
  status: string;
  created_at: number;
  pepinal?: Doginal; // Populated from API
}

export const MarketplaceScreen = () => {
  const wallet = useWallet();
  const { t } = useTranslation();
  const currentAccount = useSelector((state: any) => state.account.currentAccount);

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    collection: '',
    rarity: ''
  });
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedDoginal, setSelectedDoginal] = useState<Doginal | null>(null);
  const [userDoginals, setUserDoginals] = useState<Doginal[]>([]);

  useEffect(() => {
    loadListings();
    loadUserDoginals();
  }, [filters]);

  const loadListings = async () => {
    try {
      setLoading(true);
      const result = await wallet.getMarketplaceListings(undefined, 20, filters);
      setListings(result.list || []);
    } catch (error) {
      console.error('Failed to load marketplace listings:', error);
      message.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDoginals = async () => {
    if (!currentAccount?.address) return;

    try {
      const result = await wallet.getDoginals(currentAccount.address);
      setUserDoginals(result.list || []);
    } catch (error) {
      console.error('Failed to load user doginals:', error);
    }
  };

  const handleBuy = async (listing: MarketplaceListing) => {
    if (!currentAccount?.address) {
      message.error('Please connect your wallet');
      return;
    }

    try {
      await wallet.buyMarketplaceListing(listing.id, currentAccount.address);
      message.success('Purchase successful!');
      loadListings(); // Refresh listings
    } catch (error) {
      console.error('Failed to buy listing:', error);
      message.error('Purchase failed');
    }
  };

  const handleListDoginal = async (values: any) => {
    if (!selectedDoginal) return;

    try {
      await wallet.createMarketplaceListing(selectedDoginal.inscriptionId, values.price, currentAccount.address);
      message.success('Doginal listed for sale!');
      setListModalVisible(false);
      setSelectedDoginal(null);
      loadListings();
    } catch (error) {
      console.error('Failed to list pepinal:', error);
      message.error('Failed to list Doginal');
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#8B8B8B';
      case 'uncommon': return '#4CAF50';
      case 'rare': return '#2196F3';
      case 'epic': return '#9C27B0';
      case 'legendary': return '#FF9800';
      default: return '#8B8B8B';
    }
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
        <h1 className="text-2xl font-bold text-white">Doginal Marketplace</h1>
        <Button
          type="primary"
          icon={<ShoppingOutlined />}
          onClick={() => setListModalVisible(true)}
          className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
        >
          List Doginal
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-[#262222] border-[#333]">
        <div className="flex gap-4 items-center">
          <FilterOutlined className="text-gray-400" />
          <Select
            placeholder="Filter by collection"
            value={filters.collection || undefined}
            onChange={(value) => setFilters(prev => ({ ...prev, collection: value }))}
            className="w-48"
            allowClear
          >
            <Option value="doginals">Doginals</Option>
            <Option value="drc20">DRC-20</Option>
            <Option value="pepemaps">PepeMaps</Option>
          </Select>

          <Select
            placeholder="Filter by rarity"
            value={filters.rarity || undefined}
            onChange={(value) => setFilters(prev => ({ ...prev, rarity: value }))}
            className="w-48"
            allowClear
          >
            <Option value="common">Common</Option>
            <Option value="uncommon">Uncommon</Option>
            <Option value="rare">Rare</Option>
            <Option value="epic">Epic</Option>
            <Option value="legendary">Legendary</Option>
          </Select>
        </div>
      </Card>

      {/* Listings */}
      {listings.length === 0 ? (
        <Empty
          description="No listings found. Be the first to list a Doginal!"
          className="text-gray-400"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <Card
              key={listing.id}
              className="bg-[#262222] border-[#333] hover:border-[#069420]"
              cover={
                <div className="aspect-square bg-[#1a1a1a] flex items-center justify-center p-4">
                  <div className="text-center text-gray-400">
                    <div className="text-4xl mb-2">🐸</div>
                    <div className="text-sm">Doginal #{listing.pepinal_id.slice(-4)}</div>
                  </div>
                </div>
              }
              actions={[
                <Button
                  key="buy"
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={() => handleBuy(listing)}
                  className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
                >
                  Buy {listing.price_pep} DOGE
                </Button>
              ]}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">#{listing.pepinal_id.slice(-8)}</span>
                  <span
                    className="px-2 py-1 text-xs rounded"
                    style={{ backgroundColor: getRarityColor(listing.rarity) }}
                  >
                    {listing.rarity}
                  </span>
                </div>

                <div className="text-xs text-gray-400">
                  Seller: {listing.seller_addr.slice(0, 8)}...
                </div>

                <div className="text-xs text-gray-400">
                  Listed: {new Date(listing.created_at * 1000).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* List Doginal Modal */}
      <Modal
        title="List Doginal for Sale"
        open={listModalVisible}
        onCancel={() => {
          setListModalVisible(false);
          setSelectedDoginal(null);
        }}
        footer={null}
        className="dark-modal"
      >
        {!selectedDoginal ? (
          <div>
            <h3 className="text-white mb-4">Select a Doginal to list:</h3>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {userDoginals.map((pepinal) => (
                <Card
                  key={pepinal.id}
                  size="small"
                  className="bg-[#1a1a1a] border-[#333] cursor-pointer hover:border-[#069420]"
                  onClick={() => setSelectedDoginal(pepinal)}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">🐸</div>
                    <div className="text-xs text-gray-300">#{pepinal.id}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Form onFinish={handleListDoginal} layout="vertical">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🐸</div>
              <div className="text-white">Listing Doginal #{selectedDoginal.id}</div>
              <div className="text-gray-400 text-sm">Rarity: {selectedDoginal.rarity}</div>
            </div>

            <Form.Item
              label={<span className="text-white">Price (in DOGE)</span>}
              name="price"
              rules={[{ required: true, message: 'Please enter a price' }]}
            >
              <InputNumber
                min={0.00000001}
                step={0.01}
                className="w-full"
                placeholder="Enter price in DOGE"
              />
            </Form.Item>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => setSelectedDoginal(null)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                className="flex-1 bg-[#069420] border-[#069420] hover:bg-[#07a521]"
              >
                List for Sale
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
};
