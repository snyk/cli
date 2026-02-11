import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import { CLI } from '@snyk/error-catalog-nodejs-public';
import { execGoCommand, GoCommandResult } from '../../go-bridge';
import { UV_MONITOR_ENABLED_ENV_VAR } from '../../package-managers';
import * as types from '../types';

export async function inspect(
  _root: string,
  targetFile: string,
  _options: types.Options = {}, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<MultiProjectResult> {
  if (process.env[UV_MONITOR_ENABLED_ENV_VAR] !== 'true') {
    throw new Error(`uv monitor support is not yet available.`);
  }

  const result = await execGoCommand([
    'depgraph',
    `--file=${targetFile}`,
    '--use-sbom-resolution',
    '--json',
  ]);

  if (result.exitCode !== 0) {
    throw new CLI.GeneralCLIFailureError(extractErrorDetail(result));
  }

  const parsed = JSON.parse(result.stdout);

  const depGraphDataArray: DepGraphData[] = Array.isArray(parsed)
    ? parsed
    : [parsed];

  const scannedProjects = depGraphDataArray.map((data) => ({
    depGraph: createFromJSON(data),
    targetFile,
  }));

  return {
    plugin: {
      name: 'snyk-uv-plugin',
      runtime: process.version,
      targetFile,
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
  return result.stderr || 'depgraph command failed';
}
