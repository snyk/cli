import * as YAML from 'js-yaml';
import { EngineType, IacFileParsed, IacFileData } from '../types';

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

export function tryParsingKubernetesFile(
  fileData: IacFileData,
): IacFileParsed[] {
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
