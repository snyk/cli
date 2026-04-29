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

/**
 * Determines workspace information from the plugin name and scanned project metadata.
 * Returns workspace metadata if the plugin is a workspace plugin, otherwise undefined.
 */
function getWorkspaceInfo(
  pluginName: string | undefined,
  workspacePluginName: string | undefined,
): { type: string } | undefined {
  // Check workspace plugin name from scannedProject.meta (--all-projects) or parent plugin (--yarn-workspaces)
  if (
    workspacePluginName === 'snyk-nodejs-yarn-workspaces' ||
    pluginName === 'snyk-nodejs-yarn-workspaces'
  ) {
    return { type: 'yarn' };
  }
  if (
    workspacePluginName === 'snyk-nodejs-npm-workspaces' ||
    pluginName === 'snyk-nodejs-npm-workspaces'
  ) {
    return { type: 'npm' };
  }
  if (
    workspacePluginName === 'snyk-nodejs-pnpm-workspaces' ||
    pluginName === 'snyk-nodejs-pnpm-workspaces'
  ) {
    return { type: 'pnpm' };
  }

  return undefined;
}

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
 * printDepGraphJsonl writes dep-graph metadata to the destination stream as one JSON object
 * per line (JSONL): depGraph, normalisedTargetFile, optional targetFileFromPlugin, optional target.
 * Callers supply the dep-graph payload (full or pruned) they want to serialize.
 */
export async function printDepGraphJsonl(
  depGraph: DepGraphData,
  normalisedTargetFile: string,
  targetFileFromPlugin: string | undefined,
  target: GitTarget | ContainerTarget | null | undefined,
  targetRuntime: string | undefined,
  pluginName: string | undefined,
  workspacePluginName: string | undefined,
  destination: Writable,
): Promise<void> {
  return new Promise((res, rej) => {
    const graphOutput: any = {
      depGraph,
      normalisedTargetFile,
      targetFileFromPlugin,
      target,
      targetRuntime,
      workspace: getWorkspaceInfo(pluginName, workspacePluginName),
    };

    new ConcatStream(new JsonStreamStringify(graphOutput), Readable.from('\n'))
      .on('end', res)
      .on('error', rej)
      .pipe(destination);
  });
}

/**
 * printDepGraphError writes an error output for failed dependency graph resolution
 * to the destination stream in a format consistent with printDepGraphJsonl.
 */
export async function printDepGraphError(
  root: string,
  failedProjectScanError: FailedProjectScanError,
  destination: Writable,
): Promise<void> {
  return new Promise((res, rej) => {
    // Normalize the target file path to be relative to root, consistent with printDepGraphJsonl
    const normalisedTargetFile = failedProjectScanError.targetFile
      ? path.relative(root, failedProjectScanError.targetFile)
      : failedProjectScanError.targetFile;

    const problemError = getOrCreateErrorCatalogError(failedProjectScanError);
    const serializedError = problemError.toJsonApi().body();

    const errorRecord = {
      error: serializedError,
      normalisedTargetFile,
    };

    new ConcatStream(new JsonStreamStringify(errorRecord), Readable.from('\n'))
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
