import { IacProjectType } from '../../../../../lib/iac/constants';
import { EngineType, IacFileData, IacFileParsed } from '../types';

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];
const REQUIRED_CLOUDFORMATION_FIELDS = ['Resources'];

export function detectConfigType(
  fileData: IacFileData,
  parsedIacFiles: any[],
): IacFileParsed[] {
  return parsedIacFiles
    .map((parsedFile, docId): IacFileParsed | null => {
      if (
        checkRequiredFieldsMatch(parsedFile, REQUIRED_CLOUDFORMATION_FIELDS)
      ) {
        return {
          ...fileData,
          jsonContent: parsedFile,
          projectType: IacProjectType.CLOUDFORMATION,
          engineType: EngineType.CloudFormation,
          docId,
        };
      } else if (checkRequiredFieldsMatch(parsedFile, REQUIRED_K8S_FIELDS)) {
        return {
          ...fileData,
          jsonContent: parsedFile,
          projectType: IacProjectType.K8S,
          engineType: EngineType.Kubernetes,
          docId,
        };
      } else {
        return null;
      }
    })
    .filter((f): f is IacFileParsed => !!f);
}

function checkRequiredFieldsMatch(
  parsedDocument: any,
  requiredFields: string[],
): boolean {
  if (!parsedDocument) {
    return false;
  }
  return requiredFields.every((requiredField) =>
    parsedDocument.hasOwnProperty(requiredField),
  );
}
