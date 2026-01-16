import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import * as types from '../types';
import * as depGraphLib from '@snyk/dep-graph';

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  // Get parent CLI path
  const parentCliPath = process.env.SNYK_INTERNAL_PARENT_APPLICATION;
  if (!parentCliPath) {
    throw new Error('Unable to find parent CLI');
  }

  // Build minimal args - just depgraph command
  // Use relative path from root, not absolute path
  const args = [
    'depgraph',
    `--file=${targetFile}`, // TODO: this doesn't appear to be working
    '--use-sbom-resolution=true', // TODO: this doesn't appear to be working
  ];

  // Execute with minimal environment
  const cleanEnv = { ...process.env };
  delete cleanEnv.SNYK_INTERNAL_PARENT_APPLICATION;

  let output: string;
  try {
    const execFile = promisify(childProcess.execFile);
    const result = await execFile(parentCliPath, args, {
      cwd: root,
      env: cleanEnv,
      maxBuffer: 10 * 1024 * 1024,
    });
    output = result.stdout || result.stderr || '';
  } catch (err: any) {
    throw new Error(
      `Failed to execute depgraph: ${err.message || err.stderr || err.stdout}`,
    );
  }

  // Parse the JSON output
  if (!output || output.trim().length === 0) {
    throw new Error('depgraph command produced no output');
  }

  let depGraphData: any;
  try {
    depGraphData = JSON.parse(output.trim());
  } catch (err) {
    throw new Error(`Failed to parse depgraph output: ${err}`);
  }

  // Convert JSON to DepGraph instance
  let depGraph: depGraphLib.DepGraph;
  try {
    depGraph = depGraphLib.createFromJSON(depGraphData);
  } catch (err) {
    throw new Error(`Failed to create DepGraph from output: ${err}`);
  }

  return {
    plugin: {
      name: 'bundled:uv',
      runtime: 'unknown',
      packageManager: 'pip', // TODO: update to 'uv' once supported by Registry
    },
    scannedProjects: [
      {
        depGraph: depGraph,
        meta: {
          targetFile,
          packageManager: 'pip',
        },
      },
    ],
  };
}
