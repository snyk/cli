import config from '../config';
import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import { FormattedResult } from '../../cli/commands/test/iac-local-execution/types';

export function sendReport(issues: FormattedResult[]) {
  makeRequest({
    method: 'POST',
    url: `${config.API}/iac-cli-report`,
    json: true,
    headers: {
      authorization: getAuthHeader(),
    },
    body: {
      issues,
    },
  });
}
