import { CSSProperties, useEffect, useRef, useState } from 'react';

import { Inscription } from '@/shared/types';
import { useI18n } from '@/ui/hooks/useI18n';
import { useDoginalsWebsite } from '@/ui/state/settings/hooks';
import { colors } from '@/ui/theme/colors';
import { fontSizes } from '@/ui/theme/font';
import { getDateShowdate } from '@/ui/utils/getDateShowdate';
import { LoadingOutlined } from '@ant-design/icons';

import { BeamCharmModal } from '../BeamCharmModal';
import { Button } from '../Button';
import { Column } from '../Column';
import Iframe from '../Iframe';
import { Row } from '../Row';
import { Text } from '../Text';
import { Tooltip } from '../Tooltip';
import './index.less';

const $viewPresets = {
  large: {},

  medium: {},

  small: {}
};

const $containerPresets: Record<Presets, CSSProperties> = {
  large: {
    backgroundColor: colors.black,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  medium: {
    backgroundColor: colors.black,
    width: '100%',
    maxWidth: '180px',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  small: {
    backgroundColor: colors.black,
    width: '100%',
    maxWidth: '120px',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  }
};

const $iframePresets: Record<Presets, CSSProperties> = {
  large: {
    width: '100%',
    aspectRatio: '1/1',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none'
  },
  medium: {
    width: '100%',
    maxWidth: '180px',
    aspectRatio: '1/1',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none'
  },
  small: {
    width: '100%',
    maxWidth: '120px',
    aspectRatio: '1/1',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none'
  }
};

const $timePresets: Record<Presets, string> = {
  large: 'sm',
  medium: 'sm',
  small: 'xxs'
};

const $numberPresets: Record<Presets, string> = {
  large: 'md',
  medium: 'sm',
  small: 'xxs'
};

type Presets = keyof typeof $viewPresets;

export interface InscriptionProps {
  data: Inscription;
  onClick?: (data: any) => void;
  preset: Presets;
  asLogo?: boolean;
  hideValue?: boolean;
  style?: CSSProperties;
}

export default function InscriptionPreview({ data, onClick, preset, asLogo, hideValue }: InscriptionProps) {
  const [isVisible, setIsVisible] = useState(false);
  /** iframe loaded */
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showBeamModal, setShowBeamModal] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const date = new Date(data.timestamp * 1000);
  const time = getDateShowdate(date, t);
  const isUnconfirmed = date.getTime() < 100;
  let numberStr = '';
  if (isUnconfirmed) {
    numberStr = t('unconfirmed');
  } else if (data.inscriptionNumber) {
    numberStr = `# ${data.inscriptionNumber}`;
  }

  const url = useDoginalsWebsite();
  let preview = data.preview;
  if (!preview) {
    preview = url + '/preview/' + data.inscriptionId;
  }

  // Check if this inscription is a Charms token
  const isCharmsToken = () => {
    // Check content for Charms metadata
    if (data.content?.includes?.('charms') || data.content?.includes?.('Charms')) {
      return true;
    }
    // Check inscription ID format (placeholder for now)
    if (data.inscriptionId?.startsWith('charms:')) {
      return true;
    }
    // Check content type or other metadata
    return data.contentType === 'application/json' &&
           (data.content?.includes?.('"protocol": "charms"') ||
            data.content?.includes?.('"type": "charms"'));
  };

  const handleBeam = () => {
    setShowMenu(false);
    setShowBeamModal(true);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // 100px ahead
    );

    if (previewRef.current) {
      observer.observe(previewRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleIframeLoaded = () => {
    setIsLoaded(true);
  };

  if (asLogo) {
    return <Iframe preview={preview} style={$iframePresets[preset]} onLoad={handleIframeLoaded} />;
  }

  const valueText = `${data.outputValue} sats`;

  return (
    <div ref={previewRef} style={{ pointerEvents: 'auto', width: '100%', cursor: onClick ? 'pointer' : 'default' }}>
      <Column
        gap="zero"
        onClick={onClick}
        style={Object.assign({ position: 'relative', width: '100%' }, $containerPresets[preset])}>
        {isVisible ? (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', fontSize: 0, lineHeight: 0 }}>
            <Iframe preview={preview} style={$iframePresets[preset]} onLoad={handleIframeLoaded} />
            {!isLoaded && (
              <div
                style={{
                  ...$iframePresets[preset],
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  backgroundColor: colors.bg4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                <LoadingOutlined />
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              ...$iframePresets[preset],
              backgroundColor: colors.bg4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 0,
              lineHeight: 0
            }}></div>
        )}

        {data.outputValue && !hideValue ? (
          <div style={Object.assign({ position: 'absolute', width: '100%', top: 0, left: 0 }, $iframePresets[preset])}>
            <Column fullY>
              <Row style={{ flex: 1 }} />
              <Row fullX justifyBetween itemsCenter mb="sm">
                <Row>
                  {isCharmsToken() && (
                    <div style={{ position: 'relative' }}>
                      <Button
                        icon="more"
                        preset="minimal"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(!showMenu);
                        }}
                        style={{
                          marginRight: 8,
                          width: 24,
                          height: 24
                        }}
                      />
                      {showMenu && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 30,
                            left: 0,
                            backgroundColor: colors.black_dark,
                            border: `1px solid ${colors.line}`,
                            borderRadius: 8,
                            padding: '8px 0',
                            minWidth: 120,
                            zIndex: 1000,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              padding: '8px 16px',
                              cursor: 'pointer',
                              color: colors.white,
                              fontSize: '14px',
                              borderRadius: 4,
                              margin: '0 8px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = colors.black;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={handleBeam}
                          >
                            🚀 Beam Charm
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Row>
                <Tooltip
                  title={`${t('the_utxo_containing_this_inscription_has')} ${data.outputValue} sats`}
                  overlayStyle={{
                    fontSize: fontSizes.xs
                  }}>
                  <div>
                    <Text
                      text={valueText}
                      size="xs"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        padding: 2,
                        borderRadius: 5,
                        paddingLeft: 4,
                        paddingRight: 4
                      }}
                    />
                  </div>
                </Tooltip>
              </Row>
            </Column>
          </div>
        ) : null}

        {numberStr && (
          <Column
            px="md"
            py="sm"
            gap="zero"
            bg="bg4"
            full
            style={{
              borderBottomRightRadius: 8,
              borderBottomLeftRadius: 8,
              width: '100%',
              marginTop: -1,
              fontSize: 0
            }}>
            <Text text={numberStr} color="gold" size={$numberPresets[preset] as any} max1Lines />
            {isUnconfirmed == false && data.timestamp && (
              <Text text={time} preset="sub" size={$timePresets[preset] as any} />
            )}
          </Column>
        )}
      </Column>

      <BeamCharmModal
        inscription={data}
        visible={showBeamModal}
        onClose={() => setShowBeamModal(false)}
      />
    </div>
  );
}


