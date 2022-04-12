import { promises as fs } from 'fs';
import { IaCErrorCodes, IacFileData } from './types';
import { IacFileTypes } from '../../../../../lib/iac/constants';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { getFileType } from './directory-loader';

const DEFAULT_ENCODING = 'utf-8';

export async function loadContentForFiles(
  filePaths: string[],
): Promise<IacFileData[]> {
  const loadedFiles = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return await tryLoadFileData(filePath);
      } catch (e) {
        throw new FailedToLoadFileError(filePath);
      }
    }),
  );
  return loadedFiles.filter((file) => file.fileContent !== '');
}

export async function tryLoadFileData(
  pathToScan: string,
): Promise<IacFileData> {
  const fileType = getFileType(pathToScan);

  const fileContent = removeBom(
    await fs.readFile(pathToScan, DEFAULT_ENCODING),
  );

  return {
    filePath: pathToScan,
    fileType: fileType as IacFileTypes,
    fileContent,
  };
}

function removeBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) {
    return s.slice(1);
  }
  return s;
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
