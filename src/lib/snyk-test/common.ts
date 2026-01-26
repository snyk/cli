import { Readable, Writable } from 'stream';
import { JsonStreamStringify } from 'json-stream-stringify';
import { DepGraphData } from '@snyk/dep-graph';

import config from '../config';
import { color } from '../theme';
import * as path from 'path';
import { Options } from '../types';
import { ConcatStream } from '../stream';
import { ContainerTarget, GitTarget } from '../project-metadata/types';
import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from '../errors';
import { FailedProjectScanError } from '../plugins/get-multi-plugin-result';

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
 * printDepGraphLegacy writes the given dep-graph and target name to the destination
 * stream as expected by the `depgraph` CLI workflow.
 */
export async function printDepGraphLegacy(
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

/**
 * printDepGraphJSON writes the given dep-graph and target file to the destination
 * stream as a JSON object containing both depGraph, normalisedTargetFile and targetFile from plugin.
 * This allows structured parsing by CLI extensions.
 */
export async function printDepGraphJSON(
  depGraph: DepGraphData,
  normalisedTargetFile: string,
  targetFileFromPlugin: string | undefined,
  target: GitTarget | ContainerTarget | null | undefined,
  destination: Writable,
): Promise<void> {
  return new Promise((res, rej) => {
    const graphOutput = {
      depGraph,
      normalisedTargetFile,
      targetFileFromPlugin,
      target,
    };

    new ConcatStream(
      new JsonStreamStringify(graphOutput),
      Readable.from('\n'),
    )
      .on('end', res)
      .on('error', rej)
      .pipe(destination);
  });
}

/**
 * printDepGraphJSONError writes an error output for failed dependency graph resolution
 * to the destination stream in a format consistent with printDepGraphJSON.
 * This is used when structured graph output with errors is requested but dependency resolution failed.
 */
export async function printDepGraphJSONError(
  root: string,
  failedProjectScanError: FailedProjectScanError,
  destination: Writable,
): Promise<void> {
  return new Promise((res, rej) => {
    // Normalize the target file path to be relative to root, consistent with printDepGraphJSON
    const normalisedTargetFile = failedProjectScanError.targetFile
      ? path.relative(root, failedProjectScanError.targetFile)
      : failedProjectScanError.targetFile;

    const problemError = getOrCreateErrorCatalogError(failedProjectScanError);
    const serializedError = problemError.toJsonApi().body();

    const errorOutput = {
      error: serializedError,
      normalisedTargetFile,
    };

    new ConcatStream(
      new JsonStreamStringify(errorOutput),
      Readable.from('\n'),
    )
      .on('end', res)
      .on('error', rej)
      .pipe(destination);
  });
}

/** Checks if dep-graphs should be output in legacy text format. */
export function shouldPrintDepGraphLegacy(opts: Options): boolean {
  return (
    !!opts['print-graph'] &&
    !opts['print-deps'] &&
    !shouldPrintDepGraphWithErrors(opts)
  );
}

/** Checks if dep-graphs should be output as JSONL, including errors. */
export function shouldPrintDepGraphWithErrors(opts: Options): boolean {
  return !!opts['print-graph-with-errors'];
}

/** Checks if effective dep-graphs should be output as JSONL. */
export function shouldPrintEffectiveDepGraph(opts: Options): boolean {
  return (
    !!opts['print-effective-graph'] ||
    shouldPrintEffectiveDepGraphWithErrors(opts)
  );
}

/** Checks if effective dep-graphs should be output as JSONL, including errors. */
export function shouldPrintEffectiveDepGraphWithErrors(opts: Options): boolean {
  return !!opts['print-effective-graph-with-errors'];
}

/** Checks if any dep-graph output mode is active. */
export function shouldPrintAnyDepGraph(opts: Options): boolean {
  return (
    shouldPrintDepGraphLegacy(opts) ||
    shouldPrintDepGraphWithErrors(opts) ||
    shouldPrintEffectiveDepGraph(opts)
  );
}

/** Checks if errors from failed dependency resolution should be included in dep-graph JSONL output. */
export function shouldIncludeDepGraphErrors(opts: Options): boolean {
  return (
    shouldPrintDepGraphWithErrors(opts) ||
    shouldPrintEffectiveDepGraphWithErrors(opts)
  );
}

/**
 * getOrCreateErrorCatalogError returns a ProblemError instance for consistent error catalog usage.
 * This helper is used to ensure errors are wrapped in a ProblemError so they can be reported in a standardized way,
 * especially when converting thrown errors from plugins and flows to error catalog format.
 */
export function getOrCreateErrorCatalogError(
  failedProjectScanError: FailedProjectScanError,
): ProblemError {
  const { error, errMessage } = failedProjectScanError;
  if (error instanceof ProblemError) {
    return error;
  }

  if (error instanceof CustomError) {
    if (error.errorCatalog) {
      return error.errorCatalog;
    }
    return new CLI.GeneralCLIFailureError(
      error.userMessage ?? error.message ?? errMessage,
    );
  }

  return new CLI.GeneralCLIFailureError(errMessage);
}
