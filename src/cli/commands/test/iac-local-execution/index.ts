import * as fs from 'fs';
import { isLocalFolder } from '../../../../lib/detect';
import { getFileType } from '../../../../lib/iac/iac-parser';
import * as util from 'util';
import { IacFileTypes } from '../../../../lib/iac/constants';
import { IacFileScanResult, IacFileMetadata, IacFileData } from './types';
import { getPolicyEngine } from './policy-engine';
import { formatResults } from './results-formatter';
import { tryParseIacFile } from './parsers';
import { isLocalCacheExists, REQUIRED_LOCAL_CACHE_FILES } from './local-cache';

const readFileContentsAsync = util.promisify(fs.readFile);

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// the current version is dependent on files to be present locally which are not part of the source code.
// without these files this method would fail.
// if you're interested in trying out the experimental local execution model for IaC scanning, please reach-out.
export async function test(pathToScan: string, options) {
  if (!isLocalCacheExists())
    throw Error(
      `Missing IaC local cache data, please validate you have: \n${REQUIRED_LOCAL_CACHE_FILES.join(
        '\n',
      )}`,
    );
  // TODO: add support for proper typing of old TestResult interface.
  const results = await localProcessing(pathToScan);
  const formattedResults = formatResults(results, options);
  const singleFileFormattedResult = formattedResults[0];

  return singleFileFormattedResult as any;
}

async function localProcessing(
  pathToScan: string,
): Promise<IacFileScanResult[]> {
  const filePathsToScan = await getFilePathsToScan(pathToScan);
  const fileDataToScan = await parseFilesForScan(filePathsToScan);
  const scanResults = await scanFilesForIssues(fileDataToScan);
  return scanResults;
}

async function getFilePathsToScan(pathToScan): Promise<IacFileMetadata[]> {
  if (isLocalFolder(pathToScan)) {
    throw new Error(
      'IaC Experimental version does not support directory scan yet.',
    );
  }

  return [
    { filePath: pathToScan, fileType: getFileType(pathToScan) as IacFileTypes },
  ];
}

async function parseFilesForScan(
  filesMetadata: IacFileMetadata[],
): Promise<IacFileData[]> {
  const parsedFileData: Array<IacFileData> = [];
  for (const fileMetadata of filesMetadata) {
    const fileContent = await readFileContentsAsync(
      fileMetadata.filePath,
      'utf-8',
    );
    const parsedFiles = tryParseIacFile(fileMetadata, fileContent);
    parsedFileData.push(...parsedFiles);
  }

  return parsedFileData;
}

async function scanFilesForIssues(
  parsedFiles: Array<IacFileData>,
): Promise<IacFileScanResult[]> {
  // TODO: when adding dir support move implementation to queue.
  // TODO: when adding dir support gracefully handle failed scans
  return Promise.all(
    parsedFiles.map(async (file) => {
      const policyEngine = await getPolicyEngine(file.engineType);
      const scanResults = policyEngine.scanFile(file);
      return scanResults;
    }),
  );
}
