import * as fs from 'fs';
import * as pathLib from 'path';
import * as debugLib from 'debug';
import { isLocalFolder, localFileSuppliedButNotFound } from '../detect';
import { CustomError } from '../errors';
import { validateK8sFile, makeValidateTerraformRequest } from './iac-parser';
import {
  projectTypeByFileType,
  IacProjectType,
  IacFileTypes,
} from './constants';
import { makeDirectoryIterator } from './makeDirectoryIterator';
import {
  SupportLocalFileOnlyIacError,
  UnsupportedOptionFileIacError,
  IacDirectoryWithoutAnyIacFileError,
} from '../errors/unsupported-options-iac-error';
import {
  IllegalIacCustomError,
  InvalidK8SFileError,
  IllegalTerraformFileError,
} from '../errors/invalid-iac-file';
import { Options, TestOptions, IacFileInDirectory } from '../types';

const debug = debugLib('snyk-detect-iac');

export async function getProjectType(
  root: string,
  options: Options & TestOptions,
): Promise<string> {
  if (options.file) {
    debug('Iac - --file specified ' + options.file);
    throw UnsupportedOptionFileIacError(options.file);
  }

  if (isLocalFolder(root)) {
    // Due to the fact we are first getting the project type and only then
    // scanning the projects - we need save the files we need to scan on the options
    // so we could create assembly payloads for the relevant files.
    // We are sending it as a `Multi IaC` project - and later assign the relevant type for each project
    const directoryFiles = await getDirectoryFiles(root, {
      maxDepth: options.detectionDepth,
    });
    options.iacDirFiles = directoryFiles;
    return IacProjectType.MULTI_IAC;
  }

  if (localFileSuppliedButNotFound(root, '.') || !fs.existsSync(root)) {
    throw SupportLocalFileOnlyIacError();
  }

  const filePath = pathLib.resolve(root, '.');
  return getProjectTypeForIacFile(filePath);
}

async function getProjectTypeForIacFile(filePath: string) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const fileType = pathLib.extname(filePath).substr(1);
  const fileName = pathLib.basename(filePath);
  const projectType = projectTypeByFileType[fileType];
  switch (projectType) {
    case IacProjectType.K8S: {
      const { isValidFile, reason } = validateK8sFile(
        fileContent,
        filePath,
        fileName,
      );
      if (!isValidFile) {
        throw InvalidK8SFileError(reason);
      }
      break;
    }
    case IacProjectType.TERRAFORM: {
      const { isValidFile, reason } = await makeValidateTerraformRequest(
        fileContent,
      );
      if (!isValidFile) {
        throw IllegalTerraformFileError([fileName], reason);
      }
      break;
    }
    default:
      throw IllegalIacCustomError(fileName);
  }

  return projectType;
}

async function getDirectoryFiles(
  root: string,
  options: { maxDepth?: number } = {},
) {
  const dirPath = pathLib.resolve(root, '.');
  const supportedExtensions = new Set(Object.keys(projectTypeByFileType));

  const directoryPaths = makeDirectoryIterator(dirPath, {
    maxDepth: options.maxDepth,
  });

  const promises: Promise<IacFileInDirectory>[] = [];
  for (const filePath of directoryPaths) {
    const fileType = pathLib
      .extname(filePath)
      .substr(1)
      .toLowerCase() as IacFileTypes;
    if (!fileType || !supportedExtensions.has(fileType)) {
      continue;
    }

    promises.push(
      (async () => {
        try {
          const projectType = await getProjectTypeForIacFile(filePath);
          return {
            filePath,
            projectType,
            fileType,
          };
        } catch (err) {
          return {
            filePath,
            fileType,
            failureReason:
              err instanceof CustomError ? err.userMessage : 'Unhandled Error',
          };
        }
      })(),
    );
  }

  const iacFiles = await Promise.all(promises);
  if (iacFiles.length === 0) {
    throw IacDirectoryWithoutAnyIacFileError();
  }

  return iacFiles;
}
