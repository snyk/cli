import * as path from 'path';
import { createProjectFromWorkspace, TestProject } from './createProject';
import { runCommand } from './runCommand';

/**
 * Parses the dep graph JSON from `snyk test --print-graph` stdout.
 * The CLI emits the graph between "DepGraph data:" and "DepGraph target:" markers.
 */
export function parseDepGraphFromPrintGraphOutput(stdout: string) {
  const startMarker = 'DepGraph data:';
  const endMarker = 'DepGraph target:';
  const start = stdout.indexOf(startMarker);
  const end = stdout.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error('--print-graph output did not contain expected markers');
  }
  return JSON.parse(stdout.substring(start + startMarker.length, end));
}

/**
 * Creates a project from the given workspace and runs `dotnet restore`.
 * Throws an error if dotnet is not installed or if the project cannot be restored.
 */
export async function setupNugetProjectFromWorkspace(
  projectWorkspace: string,
  csprojFile: string,
): Promise<TestProject> {
  const prerequisite = await runCommand('dotnet', ['--version']).catch(() => ({
    code: 1,
    stderr: '',
    stdout: '',
  }));

  if (prerequisite.code !== 0) {
    console.log(prerequisite.stdout);
    console.log(prerequisite.stderr);
    throw new Error('error running dotnet --version');
  }

  const project = await createProjectFromWorkspace(projectWorkspace);

  const restoreResult = await runCommand('dotnet', [
    'restore',
    path.resolve(project.path(), csprojFile),
  ]);

  if (restoreResult.code !== 0) {
    console.log(restoreResult.stdout);
    console.log(restoreResult.stderr);
    throw new Error('error running dotnet restore');
  }

  return project;
}

export type ExpectPackage = {
  name: string;
  version: string;
};

/**
 * Asserts that a dep graph contains the expected package and system runtime packages
 * are resolved to the expected major version.
 */
export function assertDepGraph(
  depGraph: any,
  expectations: {
    expectedPackage: ExpectPackage;
    expectedRuntimeMajor: string;
  },
): void {
  expect(depGraph.pkgManager.name).toBe('nuget');

  const pkg = depGraph.pkgs.find(
    (p: any) => p.info.name === expectations.expectedPackage.name,
  );
  expect(pkg).toBeDefined();
  expect(pkg.info.version).toBe(expectations.expectedPackage.version);

  const systemRuntime = depGraph.pkgs.find(
    (p: any) => p.info.name === 'System.Runtime',
  );
  expect(systemRuntime).toBeDefined();
  expect(systemRuntime.info.version).toMatch(
    new RegExp(`^${expectations.expectedRuntimeMajor}.`),
  );
}
