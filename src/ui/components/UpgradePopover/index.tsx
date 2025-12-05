import { useEffect, useState } from 'react';

import { VersionDetail } from '@/shared/types';
import { useVersionInfo } from '@/ui/state/settings/hooks';
import { fontSizes } from '@/ui/theme/font';
import { useWallet } from '@/ui/utils';

import { Button } from '../Button';
import { Column } from '../Column';
import { Popover } from '../Popover';
import { Row } from '../Row';
import { Text } from '../Text';

export const UpgradePopover = ({ onClose }: { onClose: () => void }) => {
  const versionInfo = useVersionInfo();

  const [versionDetail, setVersionDetail] = useState<VersionDetail | null>(null);
  const wallet = useWallet();
  useEffect(() => {
    if (!versionInfo.newVersion) {
      // No new version, auto-close
      onClose();
      return;
    }
    wallet
      .getVersionDetail(versionInfo.newVersion)
      .then((res) => {
        if (res && res.title) {
          setVersionDetail(res);
        } else {
          // No valid data, auto-close
          onClose();
        }
      })
      .catch((e) => {
        console.log(e);
        // API failed, auto-close
        onClose();
      });
  }, [versionInfo.newVersion]);

  // Don't render until we have valid data
  if (!versionDetail) {
    return null;
  }

  return (
    <Popover onClose={onClose}>
      <Column justifyCenter itemsCenter>
        <Column mt="lg">
          <Text preset="bold" text={versionDetail?.title || 'Update Available'} textCenter />
        </Column>

        <div style={{ marginTop: 8 }}>
          {(versionDetail?.changelogs || []).map((str, index) => (
            <div key={index} style={{ fontSize: fontSizes.sm }}>
              {str}
            </div>
          ))}
        </div>

        <Row full mt="lg">
          <Button
            text="Skip"
            full
            onClick={(e) => {
              if (onClose) {
                onClose();
              }
            }}
          />

          <Button
            text="Go to update"
            full
            preset="primary"
            onClick={(e) => {
              window.open('https://dojak.dog/extension/update');
            }}
          />
        </Row>
      </Column>
    </Popover>
  );
};
