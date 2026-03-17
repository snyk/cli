import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import { CLI } from '@snyk/error-catalog-nodejs-public';
import { debug as Debug } from 'debug';
import * as path from 'path';
import { CustomError } from '../../errors';
import { execGoCommand, GoCommandResult } from '../../go-bridge';
import { truncateForLog } from '../../utils';
import * as types from '../types';
import { ScannedProjectCustom } from '../get-multi-plugin-result';

const debug = Debug('snyk:plugins:uv');
const UV_LOCKFILE_NAME = 'uv.lock';
const PYPROJECT_MANIFEST_NAME = 'pyproject.toml';

// JSON type returned from the Go plugin when using the --internal-uv-workspace-packages flag
interface WorkspacePackageResult {
  depGraph: DepGraphData;
  targetFile: string;
}

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
  if (options?.allProjects) {
    args.push('--internal-uv-workspace-packages');
  }

  const result = await execGoCommand(args, { cwd: root });

  if (result.exitCode !== 0) {
    throw createDepgraphError(extractErrorDetail(result));
  }

  const resolvedTargetFile = getResolvedTargetFile(targetFile);

  let scannedProjects: ScannedProjectCustom[];
  try {
    if (options?.allProjects) {
      scannedProjects = result.stdout
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as WorkspacePackageResult)
        .map((workspacePkg) => ({
          depGraph: createFromJSON(workspacePkg.depGraph),
          targetFile: workspacePkg.targetFile,
          packageManager: 'uv',
          plugin: {
            name: 'snyk-uv-plugin',
            packageManager: 'uv',
            targetFile: workspacePkg.targetFile,
          },
        }));
    } else {
      const depGraphData = JSON.parse(result.stdout) as DepGraphData;
      scannedProjects = [
        {
          depGraph: createFromJSON(depGraphData),
          targetFile: resolvedTargetFile,
          packageManager: 'uv',
          plugin: {
            name: 'snyk-uv-plugin',
            packageManager: 'uv',
            targetFile: resolvedTargetFile,
          },
        },
      ];
    }
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
  for (const output of [result.stderr, result.stdout]) {
    if (output) {
      try {
        const parsed = JSON.parse(output);
        if (parsed.error) {
          return parsed.error;
        }
      } catch {
        // not valid JSON; try next source, or fall back to returning plain stderr
      }
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
