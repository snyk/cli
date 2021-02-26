import * as cppPlugin from 'snyk-cpp-plugin';
import * as dockerPlugin from 'snyk-docker-plugin';
import { codePlugin } from '../plugins/code';
import { Ecosystem, EcosystemPlugin } from './types';

const EcosystemPlugins: {
  readonly [ecosystem in Ecosystem]: EcosystemPlugin;
} = {
  cpp: cppPlugin as EcosystemPlugin,
  // TODO: not any
  docker: dockerPlugin as any,
  code: codePlugin,
};

export function getPlugin(ecosystem: Ecosystem): EcosystemPlugin {
  return EcosystemPlugins[ecosystem];
}
