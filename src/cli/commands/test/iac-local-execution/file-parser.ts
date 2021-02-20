import * as hclToJson from 'hcl-to-json';
import * as YAML from 'js-yaml';
import {
  EngineType,
  IacFileParsed,
  IacFileData,
  ParsingResults,
  IacFileParseFailure,
} from './types';

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

export async function parseFiles(
  filesData: IacFileData[],
): Promise<ParsingResults> {
  const parsedFiles: Array<IacFileParsed> = [];
  const failedFiles: Array<IacFileParseFailure> = [];
  for (const fileData of filesData) {
    try {
      parsedFiles.push(...tryParseIacFile(fileData));
    } catch (err) {
      if (filesData.length === 1) throw err;
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

function tryParseIacFile(fileData: IacFileData): Array<IacFileParsed> {
  switch (fileData.fileType) {
    case 'yaml':
    case 'yml':
    case 'json':
      return tryParsingKubernetesFile(fileData);
    case 'tf':
      return tryParsingTerraformFile(fileData);
    default:
      throw new Error('Invalid IaC file');
  }
}

function tryParsingKubernetesFile(fileData: IacFileData): IacFileParsed[] {
  const yamlDocuments = YAML.safeLoadAll(fileData.fileContent);

  return yamlDocuments.map((parsedYamlDocument, docId) => {
    if (
      REQUIRED_K8S_FIELDS.every((requiredField) =>
        parsedYamlDocument.hasOwnProperty(requiredField),
      )
    ) {
      return {
        ...fileData,
        jsonContent: parsedYamlDocument,
        engineType: EngineType.Kubernetes,
        docId,
      };
    } else {
      throw new Error('Invalid K8s File!');
    }
  });
}

function tryParsingTerraformFile(fileData: IacFileData): Array<IacFileParsed> {
  try {
    // TODO: This parser does not fail on inavlid Terraform files! it is here temporarily.
    // cloud-config team will replace it to a valid parser for the beta release.
    const parsedData = hclToJson(fileData.fileContent);
    return [
      {
        ...fileData,
        jsonContent: parsedData,
        engineType: EngineType.Terraform,
      },
    ];
  } catch (err) {
    throw new Error('Invalid Terraform File!');
  }
}
