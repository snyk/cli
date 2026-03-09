import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import { CLI } from '@snyk/error-catalog-nodejs-public';
import { debug as Debug } from 'debug';
import * as path from 'path';
import { CustomError } from '../../errors';
import { execGoCommand, GoCommandResult } from '../../go-bridge';
import { truncateForLog } from '../../utils';
import * as types from '../types';

const debug = Debug('snyk:plugins:uv');
const UV_LOCKFILE_NAME = 'uv.lock';
const PYPROJECT_MANIFEST_NAME = 'pyproject.toml';

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  const args = [
    'depgraph',
    `--file=${targetFile}`,
    '--use-sbom-resolution',
    '--json',
  ];
  const {
    org,
    debug: debugEnabled,
    dev,
    strictOutOfSync,
  } = options as types.Options & { org?: string | null };
  if (org) {
    args.push(`--org=${org}`);
  }
  if (debugEnabled) {
    args.push('--debug');
  }
  if (dev) {
    args.push('--dev');
  }
  if (strictOutOfSync !== undefined) {
    args.push(`--strict-out-of-sync=${strictOutOfSync}`);
  }

  const result = await execGoCommand(args, { cwd: root });

  if (result.exitCode !== 0) {
    throw createDepgraphError(extractErrorDetail(result));
  }

  let depGraphData: DepGraphData;
  try {
    depGraphData = JSON.parse(result.stdout);
  } catch (error) {
    const parseError = error instanceof Error ? error.message : String(error);
    debug(
      'Failed to parse dependency information JSON: %s\nstdout preview:\n%s\nstderr preview:\n%s',
      parseError,
      truncateForLog(result.stdout),
      truncateForLog(result.stderr),
    );
    throw createDepgraphError(
      result.stderr || 'Unable to process dependency information',
    );
  }

  const resolvedTargetFile = getResolvedTargetFile(targetFile);

  const scannedProjects = [
    {
      depGraph: createFromJSON(depGraphData),
      targetFile: resolvedTargetFile,
    },
  ];

  return {
    plugin: {
      name: 'snyk-uv-plugin',
      targetFile: resolvedTargetFile,
      packageManager: 'uv',
    },
    scannedProjects,
  };
}

function createDepgraphError(detail: string): CustomError {
  const error = new CustomError(detail);
  error.userMessage = detail;
  error.errorCatalog = new CLI.GeneralCLIFailureError(detail);
  return error;
}

function extractErrorDetail(result: GoCommandResult): string {
  if (result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      // stdout wasn't valid JSON; fall through to stderr
    }
  }
  return result.stderr || 'Unable to process dependency information';
}

function getResolvedTargetFile(targetFile: string): string {
  if (path.basename(targetFile) !== UV_LOCKFILE_NAME) {
    return targetFile;
  }

  const targetFileDir = path.dirname(targetFile);
  return path.join(targetFileDir, PYPROJECT_MANIFEST_NAME);
}
