import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import * as types from '../types';
import { Options as FullOptions } from '../../types';
import config from '../../config';
import * as depGraphLib from '@snyk/dep-graph';
export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  const debug = require('debug')('snyk');
  debug(
    `[UV-DEBUG] uv plugin inspect called with root: ${root}, targetFile: ${targetFile}`,
  );

  // SIMPLEST POSSIBLE: Get parent CLI path
  const parentCliPath = process.env.SNYK_INTERNAL_PARENT_APPLICATION;
  if (!parentCliPath) {
    throw new Error('Unable to find parent CLI');
  }
  debug(`[UV-DEBUG] Parent CLI: ${parentCliPath}`);

  // Build minimal args - just depgraph command
  // Use relative path from root, not absolute path
  const lockFilePath = targetFile || 'uv.lock';
  const args = ['depgraph', '--file', lockFilePath];
  debug(`[UV-DEBUG] Executing: ${parentCliPath} ${args.join(' ')}`);
  debug(`[UV-DEBUG] Working directory will be: ${root}`);

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
    debug(`[UV-DEBUG] Success! Output length: ${output.length}`);
    debug(`[UV-DEBUG] Output: ${output.substring(0, 1000)}`);
  } catch (err: any) {
    debug(
      `[UV-DEBUG] Failed! Code: ${err.code}, stdout: ${err.stdout?.substring(0, 500)}, stderr: ${err.stderr?.substring(0, 500)}`,
    );
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
    debug(`[UV-DEBUG] Failed to parse JSON: ${err}`);
    throw new Error(`Failed to parse depgraph output: ${err}`);
  }

  debug(`[UV-DEBUG] Parsed depgraph with ${depGraphData.pkgs?.length || 0} packages`);

  // Convert JSON to DepGraph instance
  let depGraph: depGraphLib.DepGraph;
  try {
    depGraph = depGraphLib.createFromJSON(depGraphData);
    debug(`[UV-DEBUG] Created DepGraph instance with ${depGraph.getPkgs().length} packages`);
  } catch (err) {
    debug(`[UV-DEBUG] Failed to create DepGraph: ${err}`);
    throw new Error(`Failed to create DepGraph from output: ${err}`);
  }

  // Return in the format expected by the monitor command
  // Use 'pip' as packageManager since uv is a Python package manager compatible with pip
  // and the backend API expects 'pip' for Python projects
  return {
    plugin: {
      name: 'bundled:uv',
      runtime: 'unknown',
      packageManager: 'pip',
    },
    scannedProjects: [
      {
        depGraph: depGraph,
        meta: {
          targetFile: targetFile || 'uv.lock',
          packageManager: 'pip',
        },
      },
    ],
  };
}
