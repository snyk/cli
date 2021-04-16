import { CustomPoliciesWithMeta } from './types';
import { Payload } from '../../../../lib/snyk-test/types';
import * as config from '../../../../lib/config';
import { isCI } from '../../../../lib/is-ci';
import { api } from '../../../../lib/api-token';
import * as Debug from 'debug';
import request = require('../../../../lib/request');

const debug = Debug('iac-get-iac-org-settings');

/*
 * Fetches custom policies (updated severities) and some org metadata
 * If there is an error, it returns an object of the form {code, message, error}, example:
 * {code: 401, message: 'Invalid auth token provided', error: 'Invalid auth token provided'}
 */
export function getIacOrgSettings(): Promise<CustomPoliciesWithMeta> {
  const payload: Payload = {
    method: 'get',
    url: config.API + '/iac-org-settings',
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: `token ${api()}`,
    },
  };

  return new Promise((resolve, reject) => {
    request(payload, (error, res) => {
      if (error) {
        debug('Could not retrieve custom policies, an error occurred');
        return reject(error);
      }
      resolve(res.body);
    });
  });
}
