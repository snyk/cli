import { makeDirectoryIterator } from '../../../../lib/iac/makeDirectoryIterator';
import { promises as fs } from 'fs';
import {
  IaCErrorCodes,
  IacFileData,
  IaCTestFlags,
  VALID_FILE_TYPES,
} from './types';
import { getFileType } from '../../../../lib/iac/iac-parser';
import { IacFileTypes } from '../../../../lib/iac/constants';
import { isLocalFolder } from '../../../../lib/detect';
import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';

const DEFAULT_ENCODING = 'utf-8';

export async function loadFiles(
  pathToScan: string,
  options: IaCTestFlags = {},
): Promise<IacFileData[]> {
  let filePaths = [pathToScan];

  if (isLocalFolder(pathToScan)) {
    filePaths = getFilePathsFromDirectory(pathToScan, {
      maxDepth: options.detectionDepth,
    });
  }

  const filesToScan: IacFileData[] = [];
  for (const filePath of filePaths) {
    try {
      const fileData = await tryLoadFileData(filePath);
      if (fileData) {
        filesToScan.push(fileData);
      }
    } catch (e) {
      throw new FailedToLoadFileError(filePath);
    }
  }

  if (filesToScan.length === 0) {
    throw new NoFilesToScanError();
  }
  return filesToScan.filter((file) => file.fileContent !== '');
}

function getFilePathsFromDirectory(
  pathToScan: string,
  options: { maxDepth?: number } = {},
): string[] {
  const directoryPaths = makeDirectoryIterator(pathToScan, {
    maxDepth: options.maxDepth,
  });

  const directoryFilePaths: string[] = [];
  for (const filePath of directoryPaths) {
    directoryFilePaths.push(filePath);
  }
  return directoryFilePaths;
}

export async function tryLoadFileData(
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

export class NoFilesToScanError extends CustomError {
  constructor(message?: string) {
    super(message || 'Could not find any valid IaC files');
    this.code = IaCErrorCodes.NoFilesToScanError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'Could not find any valid infrastructure as code files. Supported file extensions are tf, yml, yaml & json.\nMore information can be found by running `snyk iac test --help` or through our documentation:\nhttps://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool\nhttps://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool';
  }
}

export class FailedToLoadFileError extends CustomError {
  constructor(filename: string) {
    super('Failed to load file content');
    this.code = IaCErrorCodes.FailedToLoadFileError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to read file "${filename}" for scanning. Please ensure that it is readable.`;
  }
}
