import * as hclToJson from 'hcl-to-json';
import { EngineType, IacFileData, IacFileParsed } from '../types';

export function tryParsingTerraformFile(
  fileData: IacFileData,
): Array<IacFileParsed> {
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
