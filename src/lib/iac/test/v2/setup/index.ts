import pick = require('lodash.pick');
import { TestConfig } from '../types';
import { initLocalCache } from './local-cache';

export async function setup(setupConfig: TestConfig) {
  return await initLocalCache(
    setupConfig.iacCachePath,
    pick(setupConfig.options, 'userBundlePath', 'userPolicyEnginePath'),
  );
}
