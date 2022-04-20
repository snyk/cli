import { EOL } from 'os';
import { contactSupportMessage, reTryMessage } from '../../../../common';
import { colors } from '../color-utils';

export const failuresTipOutput = colors.failure.bold(
  reTryMessage + EOL + contactSupportMessage,
);
