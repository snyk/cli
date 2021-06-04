//TODO(orka): take out into a new lib
import * as YAML from 'yaml';
import * as debugLib from 'debug';
import {
  IllegalIacFileErrorMsg,
  InternalServerError,
  MissingApiTokenError,
  NotSupportedIacFileErrorMsg,
} from '../errors';
import request = require('../request');
import { api as getApiToken } from '../api-token';
import * as config from './../config';
import {
  IacValidateTerraformResponse,
  IacValidationResponse,
} from './constants';
import { shouldThrowErrorFor } from '../../cli/commands/test/iac-local-execution/file-utils';

const debug = debugLib('snyk-detect');

const requiredK8SObjectFields = ['apiVersion', 'kind', 'metadata'];

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
        return YAML.parseAllDocuments(fileContent).map((doc) => {
          if (shouldThrowErrorFor(doc)) {
            throw doc.errors[0];
          }
          return doc.toJSON();
        });
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
  const response = await request({
    body: {
      contentBase64: Buffer.from(terraformFileContent).toString('base64'),
    },
    url: `${config.API}/iac-validate/terraform`,
    method: 'POST',
    json: true,
    headers: {
      Authorization: `token ${getApiToken()}`,
    },
  });

  // Token may have expired, so we need to ask the client to re-auth.
  if (response.res.statusCode === 401) {
    throw new MissingApiTokenError();
  }

  if (
    !response.res.statusCode ||
    (response.res.statusCode < 200 && response.res.statusCode >= 300)
  ) {
    debug(`internal server error - ${response.body}`);
    throw new InternalServerError('Error occurred validating terraform file');
  }

  const { body } = response as IacValidateTerraformResponse;
  return {
    isValidFile: body?.isValidTerraformFile ?? false,
    reason: body?.reason ?? '',
  };
}
