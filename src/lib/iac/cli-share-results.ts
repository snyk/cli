import config from '../config';
import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import { IacShareResultsFormat } from '../../cli/commands/test/iac-local-execution/types';
import { convertIacResultToScanResult } from './envelope-formatters';
import { AuthFailedError } from '../errors/authentication-failed-error';

export async function shareResults(
  results: IacShareResultsFormat[],
): Promise<Record<string, string>> {
  const scanResults = results.map(convertIacResultToScanResult);

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
