import { CharmsInfo } from '@dojak/core/types';
import { shortDesc } from '@dojak/ui/utils';

import { Column } from '../Column';
import Iframe from '../Iframe';
import { Image } from '../Image';
import { Row } from '../Row';
import { Sizes, Text } from '../Text';

// import './index.less';

const $viewPresets = {
  large: {},

  medium: {},

  small: {}
};

const $stylePresets: {
  [key: string]: {
    width: number;
    height: number;
    borderTopLeftRadius: number;
    borderTopRightRadius: number;
    textSize: Sizes;
    shortLength?: number;
  };
} = {
  large: {
    width: 300,
    height: 300,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    textSize: 'md',
    shortLength: 20
  },
  medium: {
    width: 156,
    height: 156,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    textSize: 'sm',
    shortLength: 20
  },
  small: {
    width: 80,
    height: 80,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    textSize: 'xxs',
    shortLength: 8
  }
};

type Presets = keyof typeof $viewPresets;

export interface InscriptionProps {
  CharmsInfo: CharmsInfo;
  onClick?: (data: any) => void;
  preset: Presets;
}

export default function CharmsNFTPreview({ CharmsInfo, onClick, preset }: InscriptionProps) {
  const style = $stylePresets[preset];

  // Use image from nftData if available, otherwise fallback to logo
  const imageUrl = CharmsInfo.nftData?.image || CharmsInfo.logo || '';
  const contentType = CharmsInfo.nftData?.contentType;
  const contentUrl = CharmsInfo.nftData?.contentUrl;

  const renderContent = () => {
    // If contentType is text/html, use Iframe to display contentUrl
    if (contentType === 'text/html' && contentUrl) {
      return (
        <Iframe
          preview={contentUrl}
          ref={null}
          style={{
            width: style.width,
            height: style.height,
            borderTopLeftRadius: style.borderTopLeftRadius,
            borderTopRightRadius: style.borderTopRightRadius,
            border: 'none',
            pointerEvents: 'none'
          }}
        />
      );
    }

    // Otherwise use image or fallback
    if (imageUrl) {
      return (
        <Image
          src={imageUrl}
          width={style.width}
          height={style.height}
          style={{
            borderTopLeftRadius: style.borderTopLeftRadius,
            borderTopRightRadius: style.borderTopRightRadius
          }}
        />
      );
    }

    // Fallback to text display
    return (
      <Row style={{ width: style.width, height: style.height }} itemsCenter justifyCenter>
        <Text text={CharmsInfo.name} size="xs" color="textDim" />
      </Row>
    );
  };

  return (
    <Column gap="zero" onClick={onClick} style={{}}>
      {renderContent()}

      <Column
        px="lg"
        py="sm"
        gap="zero"
        bg="bg4"
        style={{
          width: style.width,
          borderBottomLeftRadius: style.borderTopLeftRadius,
          borderBottomRightRadius: style.borderTopRightRadius
        }}
      >
        <Row my="xs">
          <Text text={shortDesc(CharmsInfo.name, style.shortLength)} color="white" size={style.textSize} />
        </Row>
        <Row my="xs">
          <Text text={CharmsInfo.charmsid} color="textDim" size={style.textSize} />
        </Row>
      </Column>
    </Column>
  );
}
