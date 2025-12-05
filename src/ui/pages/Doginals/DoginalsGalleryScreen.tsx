import { Button, Empty, Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useWallet } from '@/ui/utils';
import { PlusOutlined } from '@ant-design/icons';

import { CreateDoginalModal } from './components/CreateDoginalModal';
import { DoginalCard } from './components/DoginalCard';
import { Doginal, DoginalViewModel } from './types';
import { buildDoginalViewModel } from './utils/inscription-intel';

export const DoginalsGalleryScreen = () => {
  const wallet = useWallet();
  const { t } = useTranslation();
  const currentAccount = useSelector((state: any) => state.account.currentAccount);

  const [doginals, setDoginals] = useState<DoginalViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  useEffect(() => {
    loadDoginals();
  }, [currentAccount]);

  const loadDoginals = async () => {
    if (!currentAccount?.address) return;

    try {
      setLoading(true);
      const result = await wallet.getDoginals(currentAccount.address);
      const rawList: Doginal[] = result.list || [];
      const enriched = rawList.map(buildDoginalViewModel);
      setDoginals();
    } catch (error) {
      console.error('Failed to load doginals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoginal = async (content: string, feeRate: number) => {
    try {
      await wallet.createDoginalInscription(content, feeRate);
      setCreateModalVisible(false);
      loadDoginals(); // Refresh the list
    } catch (error) {
      console.error('Failed to create doginal:', error);
    }
  };

  const toggleFilter = (key: string) => {
    setActiveFilters((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const matchesFilters = (item: DoginalViewModel) => {
    if (activeFilters.length === 0) return true;

    return activeFilters.some((filter) => {
      switch (filter) {
        case 'vepe':
          return item.insights.protocolTags.includes('vepe');
        case 'dogemap':
          return item.insights.protocolTags.includes('dogemap');
        case 'dns':
          return item.insights.protocolTags.includes('dns');
        case 'charms':
          return (
            item.insights.protocolTags.includes('charms-token') || item.insights.protocolTags.includes('charms-nft')
          );
        case 'collections':
          return item.insights.protocolTags.includes('collection');
        default:
          return true;
      }
    });
  };

  const filteredDoginals = doginals.filter(matchesFilters);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Doginals Gallery</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
          className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
        >
          Create Doginal
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'vepe', label: 'Vepe' },
          { key: 'dogemap', label: 'Dogemaps' },
          { key: 'dns', label: 'DNS' },
          { key: 'charms', label: 'Charms' },
          { key: 'collections', label: 'Collections' }
        ].map((filter) => (
          <Tag.CheckableTag
            key={filter.key}
            checked={activeFilters.includes(filter.key)}
            onChange={() => toggleFilter(filter.key)}
            style={{
              borderColor: '#00FF88',
              color: activeFilters.includes(filter.key) ? '#000' : '#00FF88',
              background: activeFilters.includes(filter.key)
                ? 'linear-gradient(90deg, #00FF88, #00CC55)'
                : 'rgba(0, 255, 136, 0.1)'
            }}
          >
            {filter.label}
          </Tag.CheckableTag>
        ))}
      </div>

      {filteredDoginals.length === 0 ? (
        <Empty description="No Doginals found. Create your first Doginal!" className="text-gray-400" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDoginals.map((doginal) => (
            <DoginalCard key={doginal.doginal.id} doginal={doginal} onRefresh={loadDoginals} />
          ))}
        </div>
      )}

      <CreateDoginalModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onCreate={handleCreateDoginal}
      />
    </div>
  );
};
