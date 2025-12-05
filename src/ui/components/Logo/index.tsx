import { fontSizes } from '@/ui/theme/font';

import { Image } from '../Image';
import { Row } from '../Row';

export function Logo(props: { preset?: 'large' | 'small' | 'intrinsic' }) {
  const { preset } = props;
  if (preset === 'intrinsic') {
    return (
      <Row justifyCenter itemsCenter>
        <Image src="./images/logo/dojak-logo-full.png" width="auto" height="auto" />
      </Row>
    );
  } else if (preset === 'large') {
    return (
      <Row justifyCenter itemsCenter>
        <Image src="./images/logo/dojak-logo-full.png" size={fontSizes.xxxl} />
      </Row>
    );
  } else {
    return (
      <Row justifyCenter itemsCenter>
        <Image src="./images/logo/dojak-logo-full.png" size={fontSizes.xxl} />
      </Row>
    );
  }
}
