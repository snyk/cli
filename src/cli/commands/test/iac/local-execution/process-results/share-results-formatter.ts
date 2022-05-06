import { IacFileScanResult, IacShareResultsFormat } from '../types';
import * as path from 'path';
import * as fs from 'fs';

export function formatShareResults(
  scanResults: IacFileScanResult[],
): IacShareResultsFormat[] {
  const resultsGroupedByFilePath = groupByFilePath(scanResults);

  return resultsGroupedByFilePath.map((result) => {
    const { projectName, targetFile } = computePaths(result.filePath);

    return {
      projectName,
      targetFile,
      filePath: result.filePath,
      fileType: result.fileType,
      projectType: result.projectType,
      violatedPolicies: result.violatedPolicies,
    };
  });
}

function groupByFilePath(scanResults: IacFileScanResult[]) {
  const groupedByFilePath = scanResults.reduce((memo, scanResult) => {
    scanResult.violatedPolicies.forEach((violatedPolicy) => {
      violatedPolicy.docId = scanResult.docId;
    });
    if (memo[scanResult.filePath]) {
      memo[scanResult.filePath].violatedPolicies.push(
        ...scanResult.violatedPolicies,
      );
    } else {
      memo[scanResult.filePath] = scanResult;
    }
    return memo;
  }, {} as Record<string, IacFileScanResult>);

  return Object.values(groupedByFilePath);
}

function computePaths(
  filePath: string,
): { targetFilePath: string; projectName: string; targetFile: string } {
  const currentDirectory = getGitRootOrCwd(path.resolve(filePath));
  const currentDirectoryName = path.basename(currentDirectory);
  const absoluteFilePath = path.resolve(filePath);
  const relativeFilePath = path.relative(currentDirectory, absoluteFilePath);

  return {
    targetFilePath: absoluteFilePath,
    projectName: currentDirectoryName,
    targetFile: relativeFilePath,
  };
}

function getGitRootOrCwd(currentPath: string): string {
  const gitRoot = getGitRoot(currentPath);

  if (gitRoot) {
    return gitRoot;
  }

  return process.cwd();
}

function getGitRoot(currentPath: string): string | null {
  if (isGitRoot(currentPath)) {
    return currentPath;
  }

  const parentPath = path.dirname(currentPath);

  if (parentPath === currentPath) {
    return null;
  }

  return getGitRoot(parentPath);
}

function isGitRoot(currentPath: string): boolean {
  return isDirectory(path.join(currentPath, '.git'));
}

function isDirectory(path): boolean {
  try {
    return fs.statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}
