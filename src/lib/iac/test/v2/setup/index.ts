import { TestConfig } from '../types';
import { initLocalCache } from './local-cache';

export async function setup(testConfig: TestConfig) {
  return await initLocalCache(testConfig);
}
