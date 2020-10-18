//TODO(orka): take out into a new lib
import * as YAML from 'js-yaml';
import * as debugLib from 'debug';
import { IllegalIacFileErrorMsg, NotSupportedIacFileErrorMsg } from '../errors';
import request = require('../request');
import { api as getApiToken } from '../api-token';
import * as config from './../config';
import {
  IacValidateTerraformResponse,
  IacValidationResponse,
} from './constants';

const debug = debugLib('snyk-detect');

const requiredK8SObjectFields = ['apiVersion', 'kind', 'metadata', 'spec'];

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
// If there is a doc with a supported kind, but invalid, we should fail
// The function return true if the yaml is a valid k8s one, or false otherwise
export function validateK8sFile(
  fileContent: string,
  filePath: string,
  fileName: string,
): IacValidationResponse {
  const k8sObjects: any[] = parseYamlOrJson(fileContent, filePath);
  if (!k8sObjects) {
    return { isValidFile: false, reason: IllegalIacFileErrorMsg(fileName) };
  }

  let numOfSupportedKeyDocs = 0;
  for (let i = 0; i < k8sObjects.length; i++) {
    const k8sObject = k8sObjects[i];
    if (!k8sObject || !k8sObject.kind) {
      continue;
    }

    numOfSupportedKeyDocs++;

    for (const key of requiredK8SObjectFields) {
      if (!k8sObject[key]) {
        debug(`Missing required field (${key})`);
        return {
          isValidFile: false,
          reason: IllegalIacFileErrorMsg(fileName),
        };
      }
    }
  }

  if (numOfSupportedKeyDocs === 0) {
    return {
      isValidFile: false,
      reason: NotSupportedIacFileErrorMsg(fileName),
    };
  }

  debug(`k8s config found (${filePath})`);
  return { isValidFile: true, reason: '' };
}

export async function makeValidateTerraformRequest(
  terraformFileContent: string,
): Promise<IacValidationResponse> {
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
    isValidFile: !!response.body?.isValidTerraformFile,
    reason: response.body?.reason || '',
  };
}
