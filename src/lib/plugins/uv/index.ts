import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import { CLI } from '@snyk/error-catalog-nodejs-public';
import { debug as Debug } from 'debug';
import * as path from 'path';
import { execGoCommand, GoCommandResult } from '../../go-bridge';
import { truncateForLog } from '../../utils';
import * as types from '../types';

export const UV_MONITOR_ENABLED_ENV_VAR = 'SNYK_INTERNAL_UV_MONITOR_ENABLED';
const debug = Debug('snyk:plugins:uv');
const UV_LOCKFILE_NAME = 'uv.lock';
const PYPROJECT_MANIFEST_NAME = 'pyproject.toml';

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  if (process.env[UV_MONITOR_ENABLED_ENV_VAR] !== 'true') {
    throw new Error(`uv monitor support is not yet available.`);
  }

  const args = [
    'depgraph',
    `--file=${targetFile}`,
    '--use-sbom-resolution',
    '--json',
  ];
  const org = (options as types.Options & { org?: string | null }).org;
  if (org) {
    args.push(`--org=${org}`);
  }

  const result = await execGoCommand(args, { cwd: root });

  if (result.exitCode !== 0) {
    throw new CLI.GeneralCLIFailureError(extractErrorDetail(result));
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
    throw new CLI.GeneralCLIFailureError(
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
      packageManager: 'pip',
    },
    scannedProjects,
  };
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
