import config from '../config';
import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import { IacShareResultsFormat } from '../../cli/commands/test/iac-local-execution/types';
import { convertIacResultToScanResult } from './envelope-formatters';
import { AuthFailedError } from '../errors/authentication-failed-error';
import { Policy } from '../policy/find-and-load-policy';
import { getInfo } from '../project-metadata/target-builders/git';
import { GitTarget } from '../ecosystems/types';
import { Contributor } from '../types';
import * as analytics from '../analytics';
import { getContributors } from '../monitor/dev-count-analysis';
import * as Debug from 'debug';
const debug = Debug('iac-cli-share-results');

export async function shareResults(
  results: IacShareResultsFormat[],
  policy: Policy | undefined,
): Promise<Record<string, string>> {
  const gitTarget = (await getInfo(false)) as GitTarget;
  const scanResults = results.map((result) =>
    convertIacResultToScanResult(result, policy, gitTarget),
  );

  let contributors: Contributor[] = [];
  if (gitTarget.remoteUrl) {
    if (analytics.allowAnalytics()) {
      try {
        contributors = await getContributors();
      } catch (err) {
        debug('error getting repo contributors', err);
      }
    }
  }
  const { res, body } = await makeRequest({
    method: 'POST',
    url: `${config.API}/iac-cli-share-results`,
    json: true,
    headers: {
      authorization: getAuthHeader(),
    },
    body: {
      scanResults,
      contributors,
    },
  });

  if (res.statusCode === 401) {
    throw AuthFailedError();
  }

  return body;
}
