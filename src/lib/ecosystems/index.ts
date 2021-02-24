import { Options } from '../types';
import { Ecosystem } from './types';

export { testEcosystem } from './test';
export { monitorEcosystem } from './monitor';
export { getPlugin } from './plugins';

/**
 * Ecosystems are listed here if you opt in to the new plugin test flow.
 * This is a breaking change to the old plugin formats, so only a select few
 * plugins currently work with it.
 *
 * Currently container scanning is not yet ready to work with this flow,
 * hence this is in a separate function from getEcosystem().
 */
export function getEcosystemForTest(options: Options): Ecosystem | null {
  if (options.source) {
    return 'cpp';
  }
  if (options.code) {
    return 'code';
  }
  return null;
}

export function getEcosystem(options: Options): Ecosystem | null {
  if (options.source) {
    return 'cpp';
  }

  if (options.docker) {
    return 'docker';
  }
  return null;
}
