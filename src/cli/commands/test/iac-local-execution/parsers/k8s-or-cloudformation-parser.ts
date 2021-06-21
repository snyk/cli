import { CustomError } from '../../../../../lib/errors';
import { IacProjectType } from '../../../../../lib/iac/constants';
import { getErrorStringCode } from '../error-utils';
import {
  EngineType,
  IaCErrorCodes,
  IacFileData,
  IacFileParsed,
} from '../types';

export const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];
export const REQUIRED_CLOUDFORMATION_FIELDS = ['Resources'];

export function assertHelmAndThrow(fileData: IacFileData) {
  const lines: string[] = fileData.fileContent.split(/\r\n|\r|\n/);

  lines.forEach((line) => {
    const isHelmFile = line.includes('{{') && line.includes('}}');
    if (isHelmFile) {
      throw new HelmFileNotSupportedError(fileData.filePath);
    }
  });
}

export function detectConfigType(
  fileData: IacFileData,
  parsedIacFiles: any[],
): IacFileParsed[] {
  assertHelmAndThrow(fileData);

  return parsedIacFiles.map((parsedIaCFile, docId) => {
    if (
      checkRequiredFieldsMatch(parsedIaCFile, REQUIRED_CLOUDFORMATION_FIELDS)
    ) {
      return {
        ...fileData,
        jsonContent: parsedIaCFile,
        projectType: IacProjectType.CLOUDFORMATION,
        engineType: EngineType.CloudFormation,
        docId,
      };
    } else if (checkRequiredFieldsMatch(parsedIaCFile, REQUIRED_K8S_FIELDS)) {
      return {
        ...fileData,
        jsonContent: parsedIaCFile,
        projectType: IacProjectType.K8S,
        engineType: EngineType.Kubernetes,
        docId,
      };
    } else {
      if (fileData.fileType === 'json') {
        throw new FailedToDetectJsonConfigError(fileData.filePath);
      } else {
        throw new FailedToDetectYamlConfigError(fileData.filePath);
      }
    }
  });
}

export function checkRequiredFieldsMatch(
  parsedDocument: any,
  requiredFields: string[],
) {
  return requiredFields.every((requiredField) =>
    parsedDocument.hasOwnProperty(requiredField),
  );
}

export class HelmFileNotSupportedError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse Helm file');
    this.code = IaCErrorCodes.FailedToParseHelmError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to parse the YAML file "${filename}" as we currently do not support scanning of Helm files. More information can be found through our documentation:\nhttps://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool`;
  }
}

export class MissingRequiredFieldsInKubernetesYamlError extends CustomError {
  constructor(filename: string) {
    super('Failed to detect Kubernetes file, missing required fields');
    this.code = IaCErrorCodes.MissingRequiredFieldsInKubernetesYamlError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to detect whether the YAML file "${filename}" is a valid Kubernetes file, it is missing the following fields: "${REQUIRED_K8S_FIELDS.join(
      '", "',
    )}"`;
  }
}

export class FailedToDetectYamlConfigError extends CustomError {
  constructor(filename: string) {
    super(
      'Failed to detect either a Kubernetes or CloudFormation file, missing required fields',
    );
    this.code = IaCErrorCodes.FailedToDetectYamlConfigError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to detect whether the YAML file "${filename}" is a valid Kubernetes or CloudFormation file. For Kubernetes required fields are: "${REQUIRED_K8S_FIELDS.join(
      '", "',
    )}". For CloudFormation required fields are: "${REQUIRED_CLOUDFORMATION_FIELDS.join(
      '", "',
    )}". Please contact support@snyk.io, if possible with a redacted version of the file`;
  }
}

export class FailedToDetectJsonConfigError extends CustomError {
  constructor(filename: string) {
    super(
      'Failed to detect either a Kubernetes file, a CloudFormation file or a Terraform Plan, missing required fields',
    );
    this.code = IaCErrorCodes.FailedToDetectJsonConfigError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to detect whether the JSON file "${filename}" is either a valid Kubernetes file, CloudFormation file or a Terraform Plan. For Kubernetes it is missing the following fields: "${REQUIRED_K8S_FIELDS.join(
      '", "',
    )}".  For CloudFormation required fields are: "Resources". For Terraform Plan it was expected to contain fields "planned_values.root_module" and "resource_changes". Please contact support@snyk.io, if possible with a redacted version of the file`;
  }
}
