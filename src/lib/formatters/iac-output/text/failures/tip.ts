import { EOL } from 'os';
import { contactSupportMessage, reTryMessage } from '../../../../common';
import { colors } from '../utils';

export const failuresTipOutput = colors.info.bold(
  reTryMessage + EOL + contactSupportMessage,
);
