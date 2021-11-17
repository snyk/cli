import * as depcheck from 'depcheck';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { config } from '../../check-dependencies.config';

type Result = {
  dependencies: string[];
  devDependencies: string[];
  missingDependencies: { name: string; files: string[] }[];
};

type Workspace = string;

function toResult(results: depcheck.Results): Result {
  return {
    dependencies: results.dependencies,
    devDependencies: results.devDependencies,
    missingDependencies: Object.entries(results.missing).map(
      ([name, files]) => ({
        name,
        files,
      }),
    ),
  };
}

export function hasProblems(results: Result): boolean {
  return (
    results.dependencies.length > 0 ||
    results.devDependencies.length > 0 ||
    results.missingDependencies.length > 0
  );
}

export async function* checkDependencies(): AsyncGenerator<Workspace | Result> {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  for (const workspaceGlob of packageJson.workspaces) {
    const workspacePaths = glob.sync(workspaceGlob).map((p) => path.resolve(p));
    for (const workspacePath of workspacePaths) {
      yield workspacePath;
      yield toResult(await depcheck(workspacePath, config));
    }
  }
}
