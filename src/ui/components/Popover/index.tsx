import React from 'react';

import { CloseOutlined } from '@ant-design/icons';

import { Row } from '../Row';

export const Popover = ({
  children,
  onClose,
  contentStyle = {}
}: {
  children: React.ReactNode;
  onClose?: () => void;
  contentStyle?: React.CSSProperties;
}) => {
  return (
    <div
      className="popover-container"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)'
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-card)',
          border: '1px solid var(--theme-border)',
          width: 340,
          padding: 20,
          borderRadius: 15,
          position: 'relative',
          ...contentStyle
        }}
      >
        {onClose && (
          <Row
            style={{ position: 'absolute', top: 20, right: 20, cursor: 'pointer' }}
            justifyEnd
            onClick={() => {
              onClose();
            }}
          >
            <CloseOutlined style={{ color: 'var(--theme-text)' }} />
          </Row>
        )}

        {children}
      </div>
    </div>
  );
};
