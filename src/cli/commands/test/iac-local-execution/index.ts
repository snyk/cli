import * as fs from 'fs';
import * as YAML from 'js-yaml';
import { isLocalFolder } from '../../../../lib/detect';
import { getFileType } from '../../../../lib/iac/iac-parser';
import * as util from 'util';
import { IacFileTypes } from '../../../../lib/iac/constants';
import { IacFileScanResult, IacFileMetadata, IacFileData } from './types';
import { buildPolicyEngine } from './policy-engine';
import { transformToLegacyResults } from './legacy-adapter';

const readFileContentsAsync = util.promisify(fs.readFile);

export default async function legacyWrapper(pathToScan: string, options) {
  const results = await localProcessing(pathToScan);
  const legacyResults = transformToLegacyResults(results, options);
  const singleFileLegacyResult = legacyResults[0];

  return singleFileLegacyResult as any;
}

async function localProcessing(
  pathToScan: string,
): Promise<IacFileScanResult[]> {
  const policyEngine = await buildPolicyEngine();
  const filePathsToScan = await getFilePathsToScan(pathToScan);
  const fileDataToScan = await parseFileContentsForPolicyEngine(
    filePathsToScan,
  );
  const scanResults = await policyEngine.scanFiles(fileDataToScan);
  return scanResults;
}

async function getFilePathsToScan(pathToScan): Promise<IacFileMetadata[]> {
  if (isLocalFolder(pathToScan)) {
    throw new Error(
      'IaC Experimental version does not support directory scan yet.',
    );
  }
  if (getFileType(pathToScan) === 'tf') {
    throw new Error(
      'IaC Experimental version does not support Terraform scan yet.',
    );
  }

  return [
    { filePath: pathToScan, fileType: getFileType(pathToScan) as IacFileTypes },
  ];
}

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

async function parseFileContentsForPolicyEngine(
  filesMetadata: IacFileMetadata[],
): Promise<IacFileData[]> {
  const parsedFileData: Array<IacFileData> = [];
  for (const fileMetadata of filesMetadata) {
    const fileContent = await readFileContentsAsync(
      fileMetadata.filePath,
      'utf-8',
    );
    const yamlDocuments = YAML.safeLoadAll(fileContent);

    yamlDocuments.forEach((parsedYamlDocument, docId) => {
      if (
        REQUIRED_K8S_FIELDS.every((requiredField) =>
          parsedYamlDocument.hasOwnProperty(requiredField),
        )
      ) {
        parsedFileData.push({
          ...fileMetadata,
          fileContent: fileContent,
          jsonContent: parsedYamlDocument,
          docId: yamlDocuments.length > 1 ? docId : undefined,
        });
      } else {
        throw new Error('Invalid K8s File!');
      }
    });
  }

  return await Promise.all(parsedFileData);
}
