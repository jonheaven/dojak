import { useMemo } from 'react';

import { spacing } from '@/ui/theme/spacing';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { Column } from '../Column';
import { Icon } from '../Icon';
import { Row } from '../Row';
import { Text } from '../Text';
import './index.module.less';

interface HeaderProps {
  onBack?: () => void;
  title?: string;
  LeftComponent?: React.ReactNode;
  RightComponent?: React.ReactNode;
  children?: React.ReactNode;
  hideLogo?: boolean;
  type?: 'style1' | 'style2' | 'home';
}

function HeaderContainer(props: { children: React.ReactNode; shotHeight?: boolean }) {
  return (
    <div
      style={{ display: 'block', backgroundColor: 'var(--theme-bg2)', borderBottom: '1px solid var(--theme-border)' }}
    >
      <Row
        justifyBetween
        itemsCenter
        style={{
          height: props.shotHeight ? '44px' : '48px',
          paddingLeft: spacing.medium,
          paddingRight: spacing.medium
        }}
      >
        {props.children}
      </Row>
    </div>
  );
}

export function Header(props: HeaderProps) {
  const { onBack, title, LeftComponent, RightComponent, children, type } = props;

  const CenterComponent = useMemo(() => {
    if (children) {
      return children;
    } else if (title) {
      return <Text text={title} preset="regular-bold" size="lg" />;
    } else {
      return;
    }
  }, [title]);

  if (type === 'style2' || type === 'home') {
    return (
      <HeaderContainer shotHeight={type === 'home' ? false : true}>
        <Row>
          <Column selfItemsCenter>{LeftComponent}</Column>
        </Row>
        <Row>
          <Column selfItemsCenter>{RightComponent}</Column>
        </Row>
      </HeaderContainer>
    );
  }

  return (
    <HeaderContainer shotHeight={title ? false : true}>
      <Row full>
        <Column selfItemsCenter>
          {LeftComponent}
          {onBack && (
            <Row
              onClick={() => {
                onBack();
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Use theme-aware icon color */}
              <Icon color="text">
                <FontAwesomeIcon icon={faArrowLeft} />
              </Icon>
            </Row>
          )}
        </Column>
      </Row>

      <Row itemsCenter>{CenterComponent}</Row>

      <Row full justifyEnd>
        <Column selfItemsCenter>{RightComponent}</Column>
      </Row>
    </HeaderContainer>
  );
}
