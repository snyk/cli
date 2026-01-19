import { Readable, Writable } from 'stream';
import { JsonStreamStringify } from 'json-stream-stringify';
import { DepGraphData } from '@snyk/dep-graph';

import config from '../config';
import { color } from '../theme';
import { Options } from '../types';
import { ConcatStream } from '../stream';
import { ContainerTarget, GitTarget } from '../project-metadata/types';

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
 * printDepGraph writes the given dep-graph and target name to the destination
 * stream as expected by the `depgraph` CLI workflow.
 */
export async function printDepGraph(
  depGraph: DepGraphData,
  targetName: string,
  destination: Writable,
): Promise<void> {
  return new Promise((res, rej) => {
    new ConcatStream(
      Readable.from('DepGraph data:\n'),
      new JsonStreamStringify(depGraph),
      Readable.from(`\nDepGraph target:\n${targetName}\nDepGraph end\n\n`),
    )
      .on('end', res)
      .on('error', rej)
      .pipe(destination);
  });
}

export function shouldPrintDepGraph(opts: Options): boolean {
  return opts['print-graph'] && !opts['print-deps'];
}

/**
 * printEffectiveDepGraph writes the given, possibly pruned dep-graph and target file to the destination
 * stream as a JSON object containing both depGraph, normalisedTargetFile and targetFile from plugin.
 * This allows extracting the effective dep-graph which is being used for the test.
 */
export async function printEffectiveDepGraph(
  depGraph: DepGraphData,
  normalisedTargetFile: string,
  targetFileFromPlugin: string | undefined,
  target: GitTarget | ContainerTarget | null | undefined,
  destination: Writable,
): Promise<void> {
  return new Promise((res, rej) => {
    const effectiveGraphOutput = {
      depGraph,
      normalisedTargetFile,
      targetFileFromPlugin,
      target,
    };

    new ConcatStream(
      new JsonStreamStringify(effectiveGraphOutput),
      Readable.from('\n'),
    )
      .on('end', res)
      .on('error', rej)
      .pipe(destination);
  });
}

/**
 * printEffectiveDepGraphError writes an error output for failed dependency graph resolution
 * to the destination stream in a format consistent with printEffectiveDepGraph.
 * This is used when --print-effective-graph-with-errors is set but dependency resolution failed.
 */
export async function printEffectiveDepGraphError(
  errorTitle: string,
  errorDetail: string,
  normalisedTargetFile: string | undefined,
  destination: Writable,
): Promise<void> {
  return new Promise((res, rej) => {
    const effectiveGraphErrorOutput = {
      error: {
        id: 'SNYK-CLI-0000',
        title: errorTitle,
        detail: errorDetail,
      },
      normalisedTargetFile,
    };

    new ConcatStream(
      new JsonStreamStringify(effectiveGraphErrorOutput),
      Readable.from('\n'),
    )
      .on('end', res)
      .on('error', rej)
      .pipe(destination);
  });
}

/**
 * Checks if either --print-effective-graph or --print-effective-graph-with-errors is set.
 */
export function shouldPrintEffectiveDepGraph(opts: Options): boolean {
  return (
    !!opts['print-effective-graph'] ||
    shouldPrintEffectiveDepGraphWithErrors(opts)
  );
}

/**
 * shouldPrintEffectiveDepGraphWithErrors checks if the --print-effective-graph-with-errors flag is set.
 * This is used to determine if the effective dep-graph with errors should be printed.
 */
export function shouldPrintEffectiveDepGraphWithErrors(opts: Options): boolean {
  return !!opts['print-effective-graph-with-errors'];
}
