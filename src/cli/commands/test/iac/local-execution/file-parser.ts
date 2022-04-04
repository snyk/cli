import { detectConfigType } from './parsers/config-type-detection';
import {
  FailedToParseTerraformFileError,
  tryParsingTerraformFile,
} from './parsers/terraform-file-parser';
import {
  isTerraformPlan,
  tryParsingTerraformPlan,
} from './parsers/terraform-plan-parser';

import {
  EngineType,
  IaCErrorCodes,
  IacFileData,
  IacFileParsed,
  IacFileParseFailure,
  IaCTestFlags,
  ParsingResults,
  TerraformPlanScanMode,
  VALID_TERRAFORM_FILE_TYPES,
} from './types';
import * as analytics from '../../../../../lib/analytics';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { parseYAMLOrJSONFileData } from './yaml-parser';
import hclToJsonV2 from './parsers/hcl-to-json-v2';
import { IacProjectType } from '../../../../../lib/iac/constants';

import * as Debug from 'debug';
const debug = Debug('snyk-test');

export async function parseFiles(
  filesData: IacFileData[],
  options: IaCTestFlags = {},
  isTFVarSupportEnabled = false,
): Promise<ParsingResults> {
  let tfFileData: IacFileData[] = [];
  let nonTfFileData: IacFileData[] = [];

  if (!isTFVarSupportEnabled) {
    nonTfFileData = filesData;
  } else {
    tfFileData = filesData.filter((fileData) =>
      VALID_TERRAFORM_FILE_TYPES.includes(fileData.fileType),
    );
    nonTfFileData = filesData.filter(
      (fileData) => !VALID_TERRAFORM_FILE_TYPES.includes(fileData.fileType),
    );
  }

  let { parsedFiles, failedFiles } = parseNonTerraformFiles(
    nonTfFileData,
    options,
  );

  if (tfFileData.length > 0) {
    const {
      parsedFiles: parsedTfFiles,
      failedFiles: failedTfFiles,
    } = parseTerraformFiles(tfFileData);
    parsedFiles = parsedFiles.concat(parsedTfFiles);
    failedFiles = failedFiles.concat(failedTfFiles);
  }

  return {
    parsedFiles,
    failedFiles,
  };
}

export function parseNonTerraformFiles(
  filesData: IacFileData[],
  options: IaCTestFlags,
): ParsingResults {
  const parsedFiles: IacFileParsed[] = [];
  const failedFiles: IacFileParseFailure[] = [];
  for (const fileData of filesData) {
    try {
      parsedFiles.push(...tryParseIacFile(fileData, options));
    } catch (err) {
      failedFiles.push(generateFailedParsedFile(fileData, err));
    }
  }

  return {
    parsedFiles,
    failedFiles,
  };
}

export function parseTerraformFiles(filesData: IacFileData[]): ParsingResults {
  // the parser expects a map of <filePath>:<fileContent> key-value pairs
  const files = filesData.reduce((map, fileData) => {
    map[fileData.filePath] = fileData.fileContent;
    return map;
  }, {});
  const { parsedFiles, failedFiles, debugLogs } = hclToJsonV2(files);

  const parsingResults: ParsingResults = {
    parsedFiles: [],
    failedFiles: [],
  };
  for (const fileData of filesData) {
    if (parsedFiles[fileData.filePath]) {
      parsingResults.parsedFiles.push({
        ...fileData,
        jsonContent: JSON.parse(parsedFiles[fileData.filePath]),
        projectType: IacProjectType.TERRAFORM,
        engineType: EngineType.Terraform,
      });
    } else if (failedFiles[fileData.filePath]) {
      if (debugLogs[fileData.filePath]) {
        debug(
          'File %s failed to parse with: %s',
          fileData.filePath,
          debugLogs[fileData.filePath],
        );
      }
      parsingResults.failedFiles.push(
        generateFailedParsedFile(
          fileData,
          new FailedToParseTerraformFileError(fileData.filePath),
        ),
      );
    }
  }
  return parsingResults;
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

export function tryParseIacFile(
  fileData: IacFileData,
  options: IaCTestFlags = {},
): IacFileParsed[] {
  analytics.add('iac-terraform-plan', false);
  switch (fileData.fileType) {
    case 'yaml':
    case 'yml': {
      const parsedIacFile = parseYAMLOrJSONFileData(fileData);
      return detectConfigType(fileData, parsedIacFile);
    }
    case 'json': {
      const parsedIacFile = parseYAMLOrJSONFileData(fileData);
      // the Kubernetes file can have more than one JSON object in it
      // but the Terraform plan can only have one
      if (parsedIacFile.length === 1 && isTerraformPlan(parsedIacFile[0])) {
        analytics.add('iac-terraform-plan', true);
        return tryParsingTerraformPlan(fileData, parsedIacFile[0], {
          isFullScan: options.scan === TerraformPlanScanMode.FullScan,
        });
      } else {
        return detectConfigType(fileData, parsedIacFile);
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
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `Unable to process the file with extension ${fileType}. Supported file extensions are tf, yml, yaml & json.\nMore information can be found by running \`snyk iac test --help\` or through our documentation:\nhttps://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool\nhttps://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool`;
  }
}
