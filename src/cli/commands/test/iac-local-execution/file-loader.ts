import { makeDirectoryIterator } from '../../../../lib/iac/makeDirectoryIterator';
import { promises as fs } from 'fs';
import {
  IacVarsFileData,
  IaCErrorCodes,
  IacFileData,
  IaCTestFlags,
  VALID_VARS_FILE_TYPES,
  VALID_FILE_TYPES,
  IacVarsFilesDataByExtension,
} from './types';
import { getFileType } from '../../../../lib/iac/iac-parser';
import { IacVarsFileTypes, IacFileTypes } from '../../../../lib/iac/constants';
import { isLocalFolder } from '../../../../lib/detect';
import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import path = require('path');

const DEFAULT_ENCODING = 'utf-8';

export async function loadFiles(
  pathToScan: string,
  options: IaCTestFlags = {},
): Promise<IacFileData[]> {
  let iacFilesData: IacFileData[] = [];

  if (isLocalFolder(pathToScan)) {
    iacFilesData = await getIacFilesData(pathToScan, {
      maxDepth: options.detectionDepth,
    });
  } else {
    const iacFileData = await tryLoadFileData(pathToScan);
    if (iacFileData) {
      iacFilesData.push(iacFileData);
    }
  }

  if (iacFilesData.length === 0) {
    throw new NoFilesToScanError();
  }

  return iacFilesData.filter((fileData) => fileData.fileContent);
}

async function getIacFilesData(
  pathToScan: string,
  options: { maxDepth?: number } = {},
): Promise<IacFileData[]> {
  const directoryPaths = makeDirectoryIterator(pathToScan, {
    maxDepth: options.maxDepth,
  });

  const filesToScan: IacFileData[] = [];
  for (const filePath of directoryPaths) {
    const fileData = await tryLoadFileData(filePath);
    if (fileData) {
      filesToScan.push(fileData);
    }
  }

  return filesToScan;
}

export async function tryLoadVarsFiles(
  filePath: string,
  fileType: IacFileTypes,
) {
  const varsFilesByExt: IacVarsFilesDataByExtension = {};
  switch (fileType) {
    case 'tf':
      const dirPath = path.dirname(filePath);
      const varsFilesPaths = makeDirectoryIterator(dirPath, {
        maxDepth: 0,
      });

      for (const varsFilePath of varsFilesPaths) {
        const varsFileType = getFileType(varsFilePath) as IacVarsFileTypes;
        if (VALID_VARS_FILE_TYPES.tf.includes(varsFileType)) {
          const varsFileContent = (
            await fs.readFile(varsFilePath, DEFAULT_ENCODING)
          ).toString();

          if (!varsFilesByExt[varsFileType]) {
            varsFilesByExt[varsFileType] = [];
          }

          varsFilesByExt[varsFileType]!.push({
            fileContent: varsFileContent,
            fileType: varsFileType,
          });
        }
      }
    default:
      return varsFilesByExt;
  }
}

export async function tryLoadFileData(
  pathToScan: string,
): Promise<IacFileData | null> {
  try {
    const fileType = getFileType(pathToScan) as IacFileTypes;
    if (!VALID_FILE_TYPES.includes(fileType)) {
      return null;
    }

    const fileContent = (
      await fs.readFile(pathToScan, DEFAULT_ENCODING)
    ).toString();

    const varsFilesByExt = await tryLoadVarsFiles(pathToScan, fileType);

    return {
      filePath: pathToScan,
      fileType,
      fileContent,
      varsFilesByExt,
    };
  } catch (err) {
    throw new FailedToLoadFileError(pathToScan);
  }
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
