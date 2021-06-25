import * as cloneDeep from 'lodash.clonedeep';
import { DepGraph } from '@snyk/dep-graph';
import { ArgsOptions, MethodArgs } from '../cli/args';

export function countPathsToGraphRoot(graph: DepGraph): number {
  return graph
    .getPkgs()
    .reduce((acc, pkg) => acc + graph.countPathsToRoot(pkg), 0);
}

export function obfuscateArgs(
  args: ArgsOptions | MethodArgs,
): ArgsOptions | MethodArgs {
  const obfuscatedArgs = cloneDeep(args);
  if (obfuscatedArgs['username']) {
    obfuscatedArgs['username'] = 'username-set';
  }
  if (obfuscatedArgs[1] && obfuscatedArgs[1]['username']) {
    obfuscatedArgs[1]['username'] = 'username-set';
  }

  if (obfuscatedArgs['password']) {
    obfuscatedArgs['password'] = 'password-set';
  }
  if (obfuscatedArgs[1] && obfuscatedArgs[1]['password']) {
    obfuscatedArgs[1]['password'] = 'password-set';
  }

  return obfuscatedArgs;
}
