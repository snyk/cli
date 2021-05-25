export { auth } from './auth';
export { config } from './config';
export { help } from './help';
export { ignore } from './ignore';
export { monitor } from './monitor';
export { fix } from './fix';
export { displayPolicy as policy } from './policy';
export { protectFunc as protect } from './protect';
export { test } from './test';
export { versionFunc as version } from './version';
export { wizard } from './protect/wizard';
export { woofFunc as woof } from './woof';

import * as abbrev from 'abbrev';
import * as isRequired from '../../lib/spinner';
(isRequired as any).isRequired = false;

export const aliases = abbrev([
  'auth',
  'config',
  'help',
  'ignore',
  'monitor',
  'fix',
  'policy',
  'protect',
  'test',
  'version',
  'wizard',
  'woof',
]);
aliases.t = 'test';
