import * as stream from 'stream';
import { DepGraphData, DepGraph } from '@snyk/dep-graph';
import { JsonStreamStringify } from 'json-stream-stringify';

import config from '../config';
import { color } from '../theme';
import { jsonStringifyLargeObject } from '../json';
import { ContainerTarget, ScanResult } from '../ecosystems/types';
import { Options, TestOptions } from '../types';
import { ConcatStream } from '../stream';

export function assembleQueryString(options) {
  const org = options.org || config.org || null;
  const qs: {
    org: string;
    severityThreshold?: boolean;
    ignorePolicy?: boolean;
  } = {
    org,
  };

  if (options.severityThreshold) {
    qs.severityThreshold = options.severityThreshold;
  }
  if (options['ignore-policy']) {
    qs.ignorePolicy = true;
  }

  return Object.keys(qs).length !== 0 ? qs : null;
}

export enum SEVERITY {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
export const SEVERITIES: Array<{
  verboseName: SEVERITY;
  value: number;
}> = [
  {
    verboseName: SEVERITY.LOW,
    value: 1,
  },
  {
    verboseName: SEVERITY.MEDIUM,
    value: 2,
  },
  {
    verboseName: SEVERITY.HIGH,
    value: 3,
  },
  {
    verboseName: SEVERITY.CRITICAL,
    value: 4,
  },
];

export function colorTextBySeverity(
  severity: string,
  textToColor: string,
): string {
  return (color.severity[(severity || '').toLowerCase()] || color.severity.low)(
    textToColor,
  );
}

export enum FAIL_ON {
  all = 'all',
  upgradable = 'upgradable',
  patchable = 'patchable',
}

export type FailOn = 'all' | 'upgradable' | 'patchable';

export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY = 500;

/**
 * depGraphToOutputString formats the given depGrahData with the targetName as expected by
 * the `depgraph` CLI workflow.
 * @deprecated use depGraphsToOutputStream instead.
 */
export function depGraphToOutputString(
  dg: DepGraphData,
  targetName: string,
): string {
  return `DepGraph data:
${jsonStringifyLargeObject(dg)}
DepGraph target:
${targetName}
DepGraph end`;
}

/**
 * depGraphsToOutputStreams takes a set depGraphData indexed by their target name, and returns a
 * stream that can be pipe to a write stream (e.g. process.stdout) as expected by the `depgraph`
 * CLI workflow.
 */
export function depGraphsToOutputStream(
  depGraphs: Map<string, DepGraphData>,
): stream.Readable {
  const cStream = new ConcatStream();
  for (const [targetName, depGraph] of depGraphs.entries())
    cStream.append(
      stream.Readable.from('DepGraph data:\n'),
      new JsonStreamStringify(depGraph),
      stream.Readable.from(
        `\nDepGraph target:\n${targetName}\nDepGraph end\n\n`,
      ),
    );
  return cStream;
}

// @tommyknows (2023-08-15): constructProjectName attempts to construct the project
// name the same way that registry does. This is a bit difficult because in Registry,
// the code is distributed over multiple functions and files that need to be kept
// in sync...
// See https://github.com/snyk/cli/commit/28eeb789b5d3831df8751f2ff5cf552b64282a26
export function constructProjectName(sr: ScanResult): string {
  let suffix = '';
  if (sr.identity.targetFile) {
    suffix = ':' + sr.identity.targetFile;
  }

  if (sr.name) {
    return sr.name + suffix;
  }

  const targetImage = (sr.target as ContainerTarget | undefined)?.image;
  if (targetImage) {
    return targetImage + suffix;
  }

  const dgFact = sr.facts.find((d) => d.type === 'depGraph');
  // not every scanResult has a depGraph, for example the JAR fingerprints.
  if (dgFact) {
    const name = (dgFact.data as DepGraph | undefined)?.rootPkg.name;
    if (name) {
      return name + suffix;
    }
  }

  return 'no-name' + suffix;
}

export function shouldPrintDepGraphs(options: Options & TestOptions): boolean {
  return options['print-graph'] && !options['print-deps'];
}
