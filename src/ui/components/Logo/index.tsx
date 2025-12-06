import { useEffect, useState } from 'react';

import { fontSizes } from '@/ui/theme/font';

import { Image } from '../Image';
import { Row } from '../Row';

export function Logo(props: { preset?: 'large' | 'small' | 'intrinsic' }) {
  const { preset } = props;
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check if we're in dark mode
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      setIsDarkMode(theme === 'dark');
    };

    // Check initially
    checkTheme();

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // Use dark logo in dark mode, regular logo in light mode
  const logoSrc = isDarkMode
    ? './images/logo/dojak-logo-full-dark.png'
    : './images/logo/dojak-logo-full.png';

  if (preset === 'intrinsic') {
    return (
      <Row justifyCenter itemsCenter>
        <Image src={logoSrc} width="auto" height="auto" />
      </Row>
    );
  } else if (preset === 'large') {
    return (
      <Row justifyCenter itemsCenter>
        <Image src={logoSrc} size={fontSizes.xxxl} />
      </Row>
    );
  } else {
    return (
      <Row justifyCenter itemsCenter>
        <Image src={logoSrc} size={fontSizes.xxl} />
      </Row>
    );
  }
}
