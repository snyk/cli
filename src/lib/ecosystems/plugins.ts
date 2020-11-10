import * as cppPlugin from 'snyk-cpp-plugin';
import * as dockerPlugin from 'snyk-docker-plugin';
import { Ecosystem, EcosystemPlugin } from './types';

const EcosystemPlugins: {
  readonly [ecosystem in Ecosystem]: EcosystemPlugin;
} = {
  cpp: cppPlugin as EcosystemPlugin,
  // TODO: not any
  docker: dockerPlugin as any,
};

export function getPlugin(ecosystem: Ecosystem): EcosystemPlugin {
  return EcosystemPlugins[ecosystem];
}
