import * as cloneDeep from 'lodash.clonedeep';
import { DepGraph } from '@snyk/dep-graph';
import { ArgsOptions, MethodArgs } from '../cli/args';
import { MAX_STRING_LENGTH } from './constants';

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

export function truncateForLog(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? value.slice(0, MAX_STRING_LENGTH) + '...(log line truncated)'
    : value;
}
