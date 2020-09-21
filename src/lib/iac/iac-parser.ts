//TODO(orka): take out into a new lib
import * as YAML from 'js-yaml';
import * as debugLib from 'debug';
import { IllegalIacFileError, NotSupportedIacFileError } from '../errors';
import request = require('../request');
import { api as getApiToken } from '../api-token';
import * as config from './../config';
import { IacValidateTerraformResponse } from './constants';

const debug = debugLib('snyk-detect');

const mandatoryKeysForSupportedK8sKinds = {
  deployment: ['apiVersion', 'metadata', 'spec'],
  pod: ['apiVersion', 'metadata', 'spec'],
  service: ['apiVersion', 'metadata', 'spec'],
  podsecuritypolicy: ['apiVersion', 'metadata', 'spec'],
  networkpolicy: ['apiVersion', 'metadata', 'spec'],
};

export function getFileType(filePath: string): string {
  const filePathSplit = filePath.split('.');
  return filePathSplit[filePathSplit.length - 1].toLowerCase();
}

function parseYamlOrJson(fileContent: string, filePath: string): any {
  const fileType = getFileType(filePath);
  switch (fileType) {
    case 'yaml':
    case 'yml':
      try {
        return YAML.safeLoadAll(fileContent);
      } catch (e) {
        debug('Failed to parse iac config as a YAML');
      }
      break;
    case 'json':
      try {
        const objectsArr: any[] = [];
        objectsArr.push(JSON.parse(fileContent));
        return objectsArr;
      } catch (e) {
        debug('Failed to parse iac config as a JSON');
      }
      break;
    default:
      debug(`Unsupported iac config file type (${fileType})`);
  }
  return undefined;
}

// This function validates that there is at least one valid doc with a k8s object kind.
// A valid k8s object has a kind key (.kind) from the keys of `mandatoryKeysForSupportedK8sKinds`
// and all of the keys from `mandatoryKeysForSupportedK8sKinds[kind]`.
// If there is a doc with a supported kind, but invalid, we should fail
// The function return true if the yaml is a valid k8s one, or false otherwise
export function validateK8sFile(
  fileContent: string,
  filePath: string,
  root: string,
) {
  const k8sObjects: any[] = parseYamlOrJson(fileContent, filePath);
  if (!k8sObjects) {
    throw IllegalIacFileError([root]);
  }

  let numOfSupportedKeyDocs = 0;
  for (let i = 0; i < k8sObjects.length; i++) {
    const k8sObject = k8sObjects[i];
    if (!k8sObject || !k8sObject.kind) {
      continue;
    }

    const kind = k8sObject.kind.toLowerCase();
    if (!Object.keys(mandatoryKeysForSupportedK8sKinds).includes(kind)) {
      continue;
    }

    numOfSupportedKeyDocs++;

    for (let i = 0; i < mandatoryKeysForSupportedK8sKinds[kind].length; i++) {
      const key = mandatoryKeysForSupportedK8sKinds[kind][i];
      if (!k8sObject[key]) {
        debug(`Missing key (${key}) from supported k8s object kind (${kind})`);
        throw IllegalIacFileError([root]);
      }
    }
  }

  if (numOfSupportedKeyDocs === 0) {
    throw NotSupportedIacFileError([root]);
  }

  debug(`k8s config found (${filePath})`);
}

export async function makeValidateTerraformRequest(
  terraformFileContent: string,
): Promise<{
  isValidTerraformFile: boolean;
  reason: string;
}> {
  const response = (await request({
    body: {
      contentBase64: Buffer.from(terraformFileContent).toString('base64'),
    },
    url: `${config.API}/iac-validate/terraform`,
    method: 'POST',
    json: true,
    headers: {
      Authorization: `token ${getApiToken()}`,
    },
  })) as IacValidateTerraformResponse;
  return {
    isValidTerraformFile: !!response.body?.isValidTerraformFile,
    reason: response.body?.reason || '',
  };
}
