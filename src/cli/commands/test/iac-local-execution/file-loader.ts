import { makeDirectoryIterator } from '../../../../lib/iac/makeDirectoryIterator';
import * as fs from 'fs';
import * as util from 'util';
import { IacFileData, VALID_FILE_TYPES } from './types';
import { getFileType } from '../../../../lib/iac/iac-parser';
import { IacFileTypes } from '../../../../lib/iac/constants';
import { isLocalFolder } from '../../../../lib/detect';

const loadFileContents = util.promisify(fs.readFile);
const DEFAULT_ENCODING = 'utf-8';

export async function loadFiles(pathToScan): Promise<IacFileData[]> {
  let filePaths = [pathToScan];
  if (isLocalFolder(pathToScan)) {
    filePaths = await getFilePathsFromDirectory(pathToScan);
  }

  const filesToScan: IacFileData[] = [];
  for (const filePath of filePaths) {
    const fileData = await tryLoadFileData(filePath);
    if (fileData) filesToScan.push(fileData!);
  }

  if (filesToScan.length === 0) {
    throw Error("Couldn't find valid IaC files");
  }

  return filesToScan;
}

function getFilePathsFromDirectory(pathToScan: string): Array<string> {
  const directoryPaths = makeDirectoryIterator(pathToScan);

  const directoryFilePaths: string[] = [];
  for (const filePath of directoryPaths) {
    directoryFilePaths.push(filePath);
  }
  return directoryFilePaths;
}

async function tryLoadFileData(
  pathToScan: string,
): Promise<IacFileData | null> {
  const fileType = getFileType(pathToScan);
  if (!VALID_FILE_TYPES.includes(fileType)) {
    return null;
  }

  return {
    filePath: pathToScan,
    fileType: fileType as IacFileTypes,
    fileContent: await loadFileContents(pathToScan, DEFAULT_ENCODING),
  };
}
