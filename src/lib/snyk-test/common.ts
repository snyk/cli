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
import * as analytics from '../analytics';

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

const DEFAULT_REQUEST_CONCURRENCY = 5;
const MIN_REQUEST_CONCURRENCY = 1;
const MAX_REQUEST_CONCURRENCY = 50;

/**
 * Returns the maximum number of in-flight Snyk dependency-test or
 * dependency-monitor HTTP requests permitted at once. The wrapping Go CLI
 * resolves the user-facing SNYK_REQUEST_CONCURRENCY env var (and any future
 * config-file/flag sources) and forwards the resolved value via the internal
 * SNYK_INTERNAL_REQUEST_CONCURRENCY env var read here. Values are clamped to
 * [MIN_REQUEST_CONCURRENCY, MAX_REQUEST_CONCURRENCY].
 */
export function getRequestConcurrency(): number {
  const raw = process.env.SNYK_INTERNAL_REQUEST_CONCURRENCY;
  if (!raw) {
    return DEFAULT_REQUEST_CONCURRENCY;
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_REQUEST_CONCURRENCY) {
    return DEFAULT_REQUEST_CONCURRENCY;
  }
  return Math.min(parsed, MAX_REQUEST_CONCURRENCY);
}

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

// PHASE 2: --jsonl will be removed once all consumers use the dep-graph router
// directly. At that point, JSONL will be the only print-graph output format.
export function isJsonl(opts: Options): boolean {
  return !!opts['jsonl'];
}

export function shouldEmbedErrors(opts: Options): boolean {
  return !!opts['embed-errors'];
}

export function shouldPrintGraph(opts: Options): boolean {
  return !opts['print-deps'] && (
    !!opts['print-graph'] ||
    !!opts['print-effective-graph'] ||
    !!opts['print-effective-graph-with-errors'] ||
    !!opts['print-output-jsonl-with-errors']
  );
}

// DEPRECATION: The legacy flag mappings below exist for backward compatibility.
// Once analytics confirm no usage of the old flags, remove the legacyMappings
// table and the deprecation warnings.
export function mapLegacyGraphFlags(opts: Options): void {
  // --prune implies --jsonl (pruned output is always JSONL)
  if (opts['prune']) {
    opts['jsonl'] = true;
    opts['print-graph'] = true;
  }

  // New-style --jsonl or --prune: always embed errors.
  // Consumers of the new model are expected to handle embedded errors.
  if (opts['jsonl']) {
    opts['print-graph'] = true;
    opts['embed-errors'] = true;
    return;
  }

  const legacyMappings: Array<{ flag: keyof Options; prune: boolean; embedErrors: boolean }> = [
    { flag: 'print-effective-graph', prune: true, embedErrors: false },
    { flag: 'print-effective-graph-with-errors', prune: true, embedErrors: true },
    { flag: 'print-output-jsonl-with-errors', prune: false, embedErrors: true },
  ];

  for (const { flag, prune, embedErrors } of legacyMappings) {
    if (opts[flag]) {
      const replacement = prune ? '--print-graph --prune' : '--print-graph --jsonl';
      process.stderr.write(
        `WARNING: --${flag} is deprecated. Use ${replacement} instead.\n`,
      );
      analytics.add('deprecatedLegacyDepGraphFlag', flag);
      opts['print-graph'] = true;
      opts['jsonl'] = true;
      if (prune) {
        opts['prune'] = true;
      }
      if (embedErrors) {
        opts['embed-errors'] = true;
      }
      return;
    }
  }
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
      ? path.relative(
          root,
          path.resolve(root, failedProjectScanError.targetFile),
        )
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
