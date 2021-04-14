import * as YAML from 'js-yaml';
import {
  MissingRequiredFieldsInKubernetesYamlError,
  REQUIRED_K8S_FIELDS,
  tryParsingKubernetesFile,
} from './parsers/kubernetes-parser';
import { tryParsingTerraformFile } from './parsers/terraform-file-parser';
import {
  isTerraformPlan,
  tryParsingTerraformPlan,
} from './parsers/terraform-plan-parser';

import {
  IacFileParsed,
  IacFileData,
  ParsingResults,
  IacFileParseFailure,
  IaCErrorCodes,
} from './types';
import * as analytics from '../../../../lib/analytics';
import { CustomError } from '../../../../lib/errors';

export async function parseFiles(
  filesData: IacFileData[],
): Promise<ParsingResults> {
  const parsedFiles: IacFileParsed[] = [];
  const failedFiles: IacFileParseFailure[] = [];
  for (const fileData of filesData) {
    try {
      parsedFiles.push(...tryParseIacFile(fileData));
    } catch (err) {
      if (filesData.length === 1) {
        throw err;
      }
      failedFiles.push(generateFailedParsedFile(fileData, err));
    }
  }

  return {
    parsedFiles,
    failedFiles,
  };
}

function generateFailedParsedFile(
  { fileType, filePath, fileContent }: IacFileData,
  err: Error,
) {
  return {
    err,
    failureReason: err.message,
    fileType,
    filePath,
    fileContent,
    engineType: null,
    jsonContent: null,
  };
}

function parseIacFileData(fileData: IacFileData): any[] {
  let yamlDocuments;

  try {
    yamlDocuments = YAML.safeLoadAll(fileData.fileContent);
  } catch (e) {
    if (fileData.fileType === 'json') {
      throw new InvalidJsonFileError(fileData.filePath);
    } else {
      throw new InvalidYamlFileError(fileData.filePath);
    }
  }

  return yamlDocuments;
}

export function tryParseIacFile(fileData: IacFileData): IacFileParsed[] {
  analytics.add('iac-terraform-plan', false);
  switch (fileData.fileType) {
    case 'yaml':
    case 'yml': {
      const parsedIacFile = parseIacFileData(fileData);
      return tryParsingKubernetesFile(fileData, parsedIacFile);
    }
    case 'json': {
      const parsedIacFile = parseIacFileData(fileData);
      // the Kubernetes file can have more than one JSON object in it
      // but the Terraform plan can only have one
      if (parsedIacFile.length === 1 && isTerraformPlan(parsedIacFile[0])) {
        analytics.add('iac-terraform-plan', true);
        return tryParsingTerraformPlan(fileData, parsedIacFile[0]);
      } else {
        try {
          return tryParsingKubernetesFile(fileData, parsedIacFile);
        } catch (e) {
          if (e instanceof MissingRequiredFieldsInKubernetesYamlError) {
            throw new FailedToDetectJsonFileError(fileData.filePath);
          } else {
            throw e;
          }
        }
      }
    }
    case 'tf':
      return tryParsingTerraformFile(fileData);
    default:
      throw new UnsupportedFileTypeError(fileData.fileType);
  }
}

export class UnsupportedFileTypeError extends CustomError {
  constructor(fileType: string) {
    super('Unsupported file extension');
    this.code = IaCErrorCodes.UnsupportedFileTypeError;
    this.userMessage = `Unable to process the file with extension ${fileType}. Supported file extensions are tf, yml, yaml & json.\nMore information can be found by running \`snyk iac test --help\` or through our documentation:\nhttps://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool\nhttps://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool`;
  }
}

export class InvalidJsonFileError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse JSON file');
    this.code = IaCErrorCodes.InvalidJsonFileError;
    this.userMessage = `We were unable to parse the JSON file "${filename}". Please ensure that it contains properly structured JSON`;
  }
}

export class InvalidYamlFileError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse YAML file');
    this.code = IaCErrorCodes.InvalidYamlFileError;
    this.userMessage = `We were unable to parse the YAML file "${filename}". Please ensure that it contains properly structured YAML`;
  }
}

export class FailedToDetectJsonFileError extends CustomError {
  constructor(filename: string) {
    super(
      'Failed to detect either a Kubernetes file or Terraform Plan, missing required fields',
    );
    this.code = IaCErrorCodes.FailedToDetectJsonFileError;
    this.userMessage = `We were unable to detect whether the JSON file "${filename}" is a valid Kubernetes file or Terraform Plan. For Kubernetes it is missing the following fields: "${REQUIRED_K8S_FIELDS.join(
      '", "',
    )}". For Terraform Plan it was expected to contain fields "planned_values.root_module" and "resource_changes". Please contact support@snyk.io, if possible with a redacted version of the file`;
  }
}
