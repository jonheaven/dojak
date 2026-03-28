import { ToAddressInfo } from '@dojak/core/types';
import { InputInfo } from '@dojak/ui/pages/Approval/components/SignPsbt/types';
import { ColorTypes } from '@dojak/ui/theme/colors';

export interface AddressTextProps {
  address?: string;
  addressInfo?: ToAddressInfo;
  textCenter?: boolean;
  color?: ColorTypes;
  inputInfo?: InputInfo;
}
