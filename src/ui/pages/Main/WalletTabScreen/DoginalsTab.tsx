import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

import { Column, Content, Text } from '@/ui/components';
import {
  AppstoreOutlined,
  GlobalOutlined,
  PlusOutlined,
  SearchOutlined,
  ShoppingOutlined,
  StarOutlined
} from '@ant-design/icons';

import { useNavigate } from '../../MainRoute';

export function DoginalsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleViewGallery = () => {
    navigate('/doginals/gallery');
  };

  const handleCreateDoginal = () => {
    // For now, navigate to gallery - we can add a create modal later
    navigate('/doginals/gallery');
  };

  const handleViewDNSDomains = () => {
    navigate('/dns/domains');
  };

  const handleViewMarketplace = () => {
    navigate('/marketplace');
  };

  const handleViewCharmsCollections = () => {
    navigate('/charms/collections');
  };

  const handleGlobalSearch = () => {
    navigate('/search');
  };

  return (
    <Column>
      <Content>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-6">🐸</div>
          <Text text="Doginals" preset="title-bold" textCenter />
          <Text text="Create and collect unique Doginals on Dogecoin" color="textDim" textCenter mt="lg" />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={handleCreateDoginal}
              className="bg-[#069420] border-[#069420] hover:bg-[#07a521] h-auto py-3"
            >
              Create Doginal
            </Button>

            <Button
              icon={<AppstoreOutlined />}
              size="large"
              onClick={handleViewGallery}
              className="border-gray-600 text-gray-300 hover:border-[#069420] hover:text-[#069420] h-auto py-3"
            >
              View Gallery
            </Button>

            <Button
              icon={<SearchOutlined />}
              size="large"
              onClick={handleGlobalSearch}
              className="border-gray-600 text-gray-300 hover:border-[#069420] hover:text-[#069420] h-auto py-3"
            >
              Global Search
            </Button>

            <Button
              icon={<ShoppingOutlined />}
              size="large"
              onClick={handleViewMarketplace}
              className="border-gray-600 text-gray-300 hover:border-[#069420] hover:text-[#069420] h-auto py-3"
            >
              Marketplace
            </Button>

            <Button
              icon={<StarOutlined />}
              size="large"
              onClick={handleViewCharmsCollections}
              className="border-gray-600 text-gray-300 hover:border-[#069420] hover:text-[#069420] h-auto py-3"
            >
              Charms
            </Button>

            <Button
              icon={<GlobalOutlined />}
              size="large"
              onClick={handleViewDNSDomains}
              className="border-gray-600 text-gray-300 hover:border-[#069420] hover:text-[#069420] h-auto py-3"
            >
              DNS Domains
            </Button>
          </div>

          <div className="mt-8 p-4 bg-[#262222] rounded-lg max-w-md">
            <Text text="What are Doginals?" preset="sub" textCenter mb="md" />
            <Text
              text="Doginals are unique digital collectibles inscribed on the Dogecoin blockchain. Each Doginal has its own rarity score and attributes."
              color="textDim"
              textCenter
              size="sm"
            />
          </div>
        </div>
      </Content>
    </Column>
  );
}
