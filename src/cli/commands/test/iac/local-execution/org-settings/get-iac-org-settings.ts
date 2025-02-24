import { IaCErrorCodes, IacOrgSettings } from '../types';
import { Payload } from '../../../../../../lib/snyk-test/types';
import config from '../../../../../../lib/config';
import { isCI } from '../../../../../../lib/is-ci';
import { getAuthHeader } from '../../../../../../lib/api-token';
import { makeRequest } from '../../../../../../lib/request';
import { CustomError } from '../../../../../../lib/errors';
import { getErrorStringCode } from '../error-utils';
import { CLI } from '@snyk/error-catalog-nodejs-public';

export function getIacOrgSettings(
  publicOrgId?: string,
): Promise<IacOrgSettings> {
  const payload: Payload = {
    method: 'get',
    url: config.API + '/iac-org-settings',
    json: true,
    qs: { org: publicOrgId },
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
  };

  return new Promise((resolve, reject) => {
    makeRequest(payload, (error, res) => {
      if (error) {
        return reject(error);
      }
      if (res.statusCode < 200 || res.statusCode > 299) {
        return reject(new FailedToGetIacOrgSettingsError());
      }
      resolve(res.body);
    });
  });
}

export class FailedToGetIacOrgSettingsError extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to fetch IaC organization settings');
    this.code = IaCErrorCodes.FailedToGetIacOrgSettingsError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We failed to fetch your organization settings, including custom severity overrides for infrastructure-as-code policies. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output.';
    this.errorCatalog = new CLI.GeneralIACFailureError('');
  }
}
