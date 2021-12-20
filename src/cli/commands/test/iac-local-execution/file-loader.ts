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
  const iacFilesData: IacFileData[] = await getIacFilesData(pathToScan, {
    maxDepth: options.detectionDepth,
  });

  if (iacFilesData.length === 0) {
    throw new NoFilesToScanError();
  }

  return iacFilesData.filter((fileData) => fileData.fileContent);
}

async function getIacFilesData(
  pathToScan: string,
  options: { maxDepth?: number } = {},
): Promise<IacFileData[]> {
  let directoryPaths: string[] | Generator<string> = [pathToScan];

  if (isLocalFolder(pathToScan)) {
    directoryPaths = makeDirectoryIterator(pathToScan, {
      maxDepth: options.maxDepth,
    });
  }

  const filesToScan: IacFileData[] = [];
  for (const filePath of directoryPaths) {
    try {
      const fileData = await tryLoadFileData(filePath);
      if (fileData) {
        filesToScan.push(fileData);
      }
    } catch {
      throw new FailedToLoadFileError(filePath);
    }
  }
  return filesToScan;
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
