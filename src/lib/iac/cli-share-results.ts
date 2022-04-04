import config from '../config';
import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import {
  IacShareResultsFormat,
  IaCTestFlags,
  ShareResultsOutput,
} from '../../cli/commands/test/iac/local-execution/types';
import { convertIacResultToScanResult } from './envelope-formatters';
import { Policy } from '../policy/find-and-load-policy';
import { getInfo } from '../project-metadata/target-builders/git';
import { GitTarget } from '../ecosystems/types';
import { Contributor } from '../types';
import * as analytics from '../analytics';
import { getContributors } from '../monitor/dev-count-analysis';
import * as Debug from 'debug';
import { AuthFailedError, ValidationError } from '../errors';

const debug = Debug('iac-cli-share-results');
import { ProjectAttributes, Tag } from '../types';
import { TestLimitReachedError } from '../../cli/commands/test/iac/local-execution/usage-tracking';

export async function shareResults({
  results,
  policy,
  tags,
  attributes,
  options,
}: {
  results: IacShareResultsFormat[];
  policy: Policy | undefined;
  tags?: Tag[];
  attributes?: ProjectAttributes;
  options?: IaCTestFlags;
}): Promise<ShareResultsOutput> {
  const gitTarget = (await getInfo(false)) as GitTarget;
  const scanResults = results.map((result) =>
    convertIacResultToScanResult(result, policy, gitTarget, options),
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
    qs: { org: options?.org ?? config.org },
    headers: {
      authorization: getAuthHeader(),
    },
    body: {
      scanResults,
      contributors,
      tags,
      attributes,
    },
  });

  switch (res.statusCode) {
    case 401:
      throw AuthFailedError();
    case 422:
      throw new ValidationError(
        res.body.error ?? 'An error occurred, please contact Snyk support',
      );
    case 429:
      throw new TestLimitReachedError();
  }

  return { projectPublicIds: body, gitRemoteUrl: gitTarget?.remoteUrl };
}
