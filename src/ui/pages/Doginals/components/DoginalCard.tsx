import { EyeOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { Button, Card, Tag } from 'antd';
import React from 'react';

import { DoginalProtocolTag, DoginalViewModel } from '../types';

interface DoginalCardProps {
  pepinal: DoginalViewModel;
  onRefresh: () => void;
}

const getRarityColor = (rarity: Doginal['rarity']) => {
  switch (rarity) {
    case 'common': return '#8B8B8B';
    case 'uncommon': return '#4CAF50';
    case 'rare': return '#2196F3';
    case 'epic': return '#9C27B0';
    case 'legendary': return '#FF9800';
    default: return '#8B8B8B';
  }
};

const tagColorMap: Record<DoginalProtocolTag, string> = {
  pepinal: '#00FF88',
  pepemap: '#2dd4bf',
  dns: '#fcd34d',
  'charms-token': '#60a5fa',
  'charms-nft': '#c084fc',
  collection: '#f472b6',
  vepe: '#34d399',
  unknown: '#9ca3af'
};

export const DoginalCard: React.FC<DoginalCardProps> = ({ pepinal, onRefresh }) => {
  const { pepinal: base, insights, pairedVideo } = pepinal;

  const displaySource = insights.mediaType === 'video' && pairedVideo ? pairedVideo : base;

  const renderMedia = () => {
    switch (insights.mediaType) {
      case 'image':
        return (
          <img
            src={displaySource.content}
            alt={`Doginal ${displaySource.id}`}
            className="max-w-full max-h-full object-contain rounded"
          />
        );
      case 'video':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              controls
              className="w-full h-full object-cover rounded"
              src={displaySource.content}
            />
            {insights.vepe?.caption && (
              <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-60 text-white p-2 rounded">
                <div className="font-semibold">{insights.vepe.caption}</div>
                {insights.vepe.hashtags && insights.vepe.hashtags.length > 0 && (
                  <div className="text-xs text-green-300">#{insights.vepe.hashtags.join(' #')}</div>
                )}
                {insights.vepe.location && <div className="text-xs text-gray-200">📍 {insights.vepe.location}</div>}
              </div>
            )}
          </div>
        );
      case 'audio':
        return (
          <audio controls className="w-full">
            <source src={displaySource.content} type={displaySource.contentType} />
          </audio>
        );
      case 'html':
        return (
          <iframe
            srcDoc={displaySource.content}
            className="w-full h-48 border border-[#00FF88] rounded"
            sandbox="allow-scripts allow-same-origin"
            title={`Doginal ${displaySource.id} HTML`}
          />
        );
      case 'text':
        return (
          <pre className="text-xs text-green-200 whitespace-pre-wrap max-h-48 overflow-auto w-full text-left">
            {displaySource.content}
          </pre>
        );
      default:
        return (
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">🐸</div>
            <div className="text-sm">Doginal #{displaySource.id}</div>
          </div>
        );
    }
  };

  const handleView = () => {
    // Open pepinal details
    window.open(`https://pepeblocks.com/inscription/${base.inscriptionId}`, '_blank');
  };

  const handleList = () => {
    // Open marketplace listing modal
    console.log('List pepinal for sale:', base.id);
  };

  return (
    <Card
      hoverable
      className="bg-[#0f2c1f] border-[#144e38] hover:border-[#00ff88]"
      cover={
        <div className="aspect-square bg-[#1a1a1a] flex items-center justify-center p-4">
          {renderMedia()}
        </div>
      }
      actions={[
        <Button
          key="view"
          type="text"
          icon={<EyeOutlined />}
          onClick={handleView}
          className="text-gray-400 hover:text-white"
        >
          View
        </Button>,
        <Button
          key="list"
          type="text"
          icon={<ShoppingCartOutlined />}
          onClick={handleList}
          className="text-gray-400 hover:text-[#069420]"
        >
          List
        </Button>
      ]}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-white font-medium">#{base.id}</span>
          <Tag
            color={getRarityColor(base.rarity)}
            className="text-xs"
          >
            {base.rarity}
          </Tag>
        </div>

        {base.price && (
          <div className="text-[#069420] font-medium">
            {base.price} DOGE
          </div>
        )}

        <div className="text-xs text-gray-400">
          Score: {base.rarityScore}
        </div>

        {insights.collectionName && (
          <Tag color="#00ff88" className="text-xs font-semibold text-black">
            Collection: {insights.collectionName}
          </Tag>
        )}

        {base.attributes && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(base.attributes).map(([key, value]) => (
              <Tag key={key} size="small" className="text-xs bg-[#333] text-gray-300">
                {key}: {Array.isArray(value) ? value.join(', ') : value}
              </Tag>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1 pt-1">
          {insights.protocolTags.map((tag) => (
            <Tag key={tag} color={tagColorMap[tag]} className="text-xs font-semibold">
              {tag.toUpperCase()}
            </Tag>
          ))}
        </div>
      </div>
    </Card>
  );
};


