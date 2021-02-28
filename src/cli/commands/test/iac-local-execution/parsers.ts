import * as hclToJson from 'hcl-to-json';
import * as YAML from 'js-yaml';
import { EngineType, IacFileData, IacFileMetadata } from './types';

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

export function tryParseIacFile(
  fileMetadata: IacFileMetadata,
  fileContent: string,
): Array<IacFileData> {
  switch (fileMetadata.fileType) {
    case 'yaml':
    case 'yml':
    case 'json':
      return tryParsingKubernetesFile(fileContent, fileMetadata);
    case 'tf':
      return [tryParsingTerraformFile(fileContent, fileMetadata)];
    default:
      throw new Error('Invalid IaC file');
  }
}

function tryParsingKubernetesFile(
  fileContent: string,
  fileMetadata: IacFileMetadata,
): IacFileData[] {
  const yamlDocuments = YAML.safeLoadAll(fileContent);

  return yamlDocuments.map((parsedYamlDocument, docId) => {
    if (
      REQUIRED_K8S_FIELDS.every((requiredField) =>
        parsedYamlDocument.hasOwnProperty(requiredField),
      )
    ) {
      return {
        ...fileMetadata,
        fileContent: fileContent,
        jsonContent: parsedYamlDocument,
        engineType: EngineType.Kubernetes,
        docId,
      };
    } else {
      throw new Error('Invalid K8s File!');
    }
  });
}

function tryParsingTerraformFile(
  fileContent: string,
  fileMetadata: IacFileMetadata,
): IacFileData {
  try {
    // TODO: This parser does not fail on inavlid Terraform files! it is here temporarily.
    // cloud-config team will replace it to a valid parser for the beta release.
    const parsedData = hclToJson(fileContent);
    return {
      ...fileMetadata,
      fileContent: fileContent,
      jsonContent: parsedData,
      engineType: EngineType.Terraform,
    };
  } catch (err) {
    throw new Error('Invalid Terraform File!');
  }
}
