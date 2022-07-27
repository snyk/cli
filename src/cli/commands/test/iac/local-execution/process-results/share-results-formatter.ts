import { IacFileScanResult, IacShareResultsFormat } from '../types';
import * as path from 'path';
import { IacOutputMeta } from '../../../../../../lib/types';

export function formatShareResults(
  projectRoot: string,
  scanResults: IacFileScanResult[],
  meta: IacOutputMeta,
): IacShareResultsFormat[] {
  const resultsGroupedByFilePath = groupByFilePath(scanResults);

  return resultsGroupedByFilePath.map((result) => {
    const { projectName, targetFile } = computePaths(
      projectRoot,
      result.filePath,
      meta,
    );

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
  projectRoot: string,
  filePath: string,
  meta: IacOutputMeta,
): { targetFilePath: string; projectName: string; targetFile: string } {
  const projectDirectory = path.resolve(projectRoot);
  const absoluteFilePath = path.resolve(filePath);
  const relativeFilePath = path.relative(projectDirectory, absoluteFilePath);
  const unixRelativeFilePath = relativeFilePath.split(path.sep).join('/');

  return {
    targetFilePath: absoluteFilePath,
    projectName: meta.projectName,
    targetFile: unixRelativeFilePath,
  };
}
