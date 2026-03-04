import React from 'react';
import QRCode from 'qrcode.react';
import { Card, Column, Row, Text } from '@/ui/components';

interface QRCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  title?: string;
  showText?: boolean;
}

export const QRCodeComponent: React.FC<QRCodeProps> = ({
  value,
  size = 256,
  level = 'M',
  title,
  showText = true
}) => {
  return (
    <Column gap="md" itemsCenter>
      {title && (
        <Text text={title} preset="sub" textCenter />
      )}

      <Card
        style={{
          padding: '16px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-soft)',
          borderRadius: '12px'
        }}
      >
        <QRCode
          value={value}
          size={size}
          level={level}
          fgColor="#000000"
          bgColor="#FFFFFF"
          style={{
            display: 'block',
            margin: '0 auto'
          }}
        />
      </Card>

      {showText && (
        <Text
          text="Scan with camera or save QR for backup"
          preset="sub"
          textCenter
          style={{
            color: 'var(--text-muted)',
            fontSize: '12px',
            maxWidth: '200px'
          }}
        />
      )}
    </Column>
  );
};

export default QRCodeComponent;
