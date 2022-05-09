import { IacFileScanResult, IacShareResultsFormat } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { getRepoRoot } from '../../../../../../lib/iac/git';

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
  const unixRelativeFilePath = relativeFilePath.split(path.sep).join('/');

  return {
    targetFilePath: absoluteFilePath,
    projectName: currentDirectoryName,
    targetFile: unixRelativeFilePath,
  };
}

function getGitRootOrCwd(currentPath: string): string {
  try {
    let cwd = currentPath;

    if (fs.statSync(cwd).isFile()) {
      cwd = path.dirname(cwd);
    }

    return getRepoRoot(cwd);
  } catch (e) {
    return process.cwd();
  }
}
