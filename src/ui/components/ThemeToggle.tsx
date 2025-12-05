import React from 'react';

import { useThemeContext } from '@/ui/app/contexts/ThemeContext';
import { Row, Text } from '@/ui/components';
import { Switch } from '@/ui/components/Switch';
import { useI18n } from '@/ui/hooks/useI18n';

interface ThemeToggleProps {
  style?: React.CSSProperties;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ style }) => {
  const { theme, toggleTheme } = useThemeContext();
  const { t } = useI18n();

  const handleToggle = () => {
    toggleTheme();
  };

  return (
    <Row justifyBetween itemsCenter style={{ width: '100%', ...style }}>
      <Text text={t('theme')} preset="regular" size="sm" />
      <Row itemsCenter gap="sm">
        <Text text={theme === 'light' ? t('light') : t('dark')} preset="sub" size="xs" style={{ minWidth: '40px' }} />
        <Switch checked={theme === 'dark'} onChange={handleToggle} size="small" />
      </Row>
    </Row>
  );
};
