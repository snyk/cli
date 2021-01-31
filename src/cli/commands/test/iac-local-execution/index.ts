import * as fs from 'fs';
import * as YAML from 'js-yaml';
import { isLocalFolder } from '../../../../lib/detect';
import { getFileType } from '../../../../lib/iac/iac-parser';
import * as util from 'util';
import { IacFileTypes } from '../../../../lib/iac/constants';
import { IacFileScanResult, IacFileMetadata, IacFileData } from './types';
import { buildPolicyEngine } from './policy-engine';
import { formatResults } from './results-formatter';

const readFileContentsAsync = util.promisify(fs.readFile);
const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// the current version is dependent on files to be present locally which are not part of the source code.
// without these files this method would fail.
// if you're interested in trying out the experimental local execution model for IaC scanning, please reach-out.
export async function test(pathToScan: string, options) {
  // TODO: add support for proper typing of old TestResult interface.
  const results = await localProcessing(pathToScan);
  const formattedResults = formatResults(results, options);
  const singleFileFormattedResult = formattedResults[0];

  return singleFileFormattedResult as any;
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
          docId,
        });
      } else {
        throw new Error('Invalid K8s File!');
      }
    });
  }

  return parsedFileData;
}
