import { CSSProperties, useEffect } from 'react';

import { colors } from '@dojak/ui/theme/colors';

import { Text } from '../../Text';
import './index.less';

export type ToastPresets = keyof typeof $viewPresets;
export interface ToastProps {
  preset: ToastPresets;
  content: string;
  onClose: () => void;
}

const $baseViewStyle = {
  alignSelf: 'end',
  padding: 4,
  borderRadius: 4,
  paddingLeft: 8,
  paddingRight: 8,
  marginLeft: 16,
  marginRight: 16
} as CSSProperties;

const $viewPresets = {
  info: Object.assign({}, $baseViewStyle, {
    backgroundColor: colors.black_dark
  }) as CSSProperties,

  success: Object.assign({}, $baseViewStyle, {
    backgroundColor: colors.primary
  }) as CSSProperties,

  error: Object.assign({}, $baseViewStyle, {
    backgroundColor: colors.danger
  }) as CSSProperties,

  warning: Object.assign({}, $baseViewStyle, {
    backgroundColor: colors.warning
  }) as CSSProperties
};

export function Toast(props: ToastProps) {
  const { preset, content, onClose } = props;

  useEffect(() => {
    // Calculate duration based on message length
    // Base duration: 2000ms for short messages
    // Add 100ms per word for longer messages
    // Add 50ms per character for very long messages
    const words = content.split(' ').length;
    const characters = content.length;

    let duration = 2000; // Base duration

    // Add time for longer messages
    if (words > 3) {
      duration += (words - 3) * 100; // 100ms per extra word
    }

    if (characters > 50) {
      duration += (characters - 50) * 50; // 50ms per extra character
    }

    // Cap maximum duration at 8 seconds to prevent extremely long messages
    duration = Math.min(duration, 8000);

    setTimeout(() => {
      onClose();
    }, duration);
  }, [content]);

  return (
    <div className="action-container">
      <div className="toast" style={$viewPresets[preset]}>
        <Text text={content} preset="regular" color="white" textCenter />
      </div>
    </div>
  );
}
