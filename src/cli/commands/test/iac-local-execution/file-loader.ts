import { makeDirectoryIterator } from '../../../../lib/iac/makeDirectoryIterator';
import { promises as fs } from 'fs';
import { IacFileData, VALID_FILE_TYPES } from './types';
import { getFileType } from '../../../../lib/iac/iac-parser';
import { IacFileTypes } from '../../../../lib/iac/constants';
import { isLocalFolder } from '../../../../lib/detect';

const DEFAULT_ENCODING = 'utf-8';

export async function loadFiles(pathToScan: string): Promise<IacFileData[]> {
  let filePaths = [pathToScan];

  if (isLocalFolder(pathToScan)) {
    filePaths = getFilePathsFromDirectory(pathToScan);
  }

  const filesToScan: IacFileData[] = [];
  for (const filePath of filePaths) {
    const fileData = await tryLoadFileData(filePath);
    if (fileData) filesToScan.push(fileData);
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

  const fileContent = (
    await fs.readFile(pathToScan, DEFAULT_ENCODING)
  ).toString();

  return {
    filePath: pathToScan,
    fileType: fileType as IacFileTypes,
    fileContent,
  };
}
