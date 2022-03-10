import config from '../config';
import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import { IacShareResultsFormat } from '../../cli/commands/test/iac-local-execution/types';
import { convertIacResultToScanResult } from './envelope-formatters';
import { AuthFailedError } from '../errors/authentication-failed-error';
import { Policy } from '../policy/find-and-load-policy';

export async function shareResults(
  results: IacShareResultsFormat[],
  policy: Policy | undefined,
): Promise<Record<string, string>> {
  const scanResults = results.map((result) =>
    convertIacResultToScanResult(result, policy),
  );

  const { res, body } = await makeRequest({
    method: 'POST',
    url: `${config.API}/iac-cli-share-results`,
    json: true,
    headers: {
      authorization: getAuthHeader(),
    },
    body: scanResults,
  });

  if (res.statusCode === 401) {
    throw AuthFailedError();
  }

  return body;
}
