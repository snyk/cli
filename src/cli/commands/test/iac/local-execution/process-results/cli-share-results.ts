import config from '../../../../../../lib/config';
import { makeRequest } from '../../../../../../lib/request';
import { getAuthHeader } from '../../../../../../lib/api-token';
import {
  IacShareResultsFormat,
  IaCTestFlags,
  ShareResultsOutput,
} from '../types';
import { convertIacResultToScanResult } from '../../../../../../lib/iac/envelope-formatters';
import { Policy } from '../../../../../../lib/policy/find-and-load-policy';
import {
  Contributor,
  IacOutputMeta,
  ProjectAttributes,
  Tag,
} from '../../../../../../lib/types';
import * as analytics from '../../../../../../lib/analytics';
import { getContributors } from '../../../../../../lib/monitor/dev-count-analysis';
import * as Debug from 'debug';
import { AuthFailedError, ValidationError } from '../../../../../../lib/errors';
import { TestLimitReachedError } from '../usage-tracking';

const debug = Debug('iac-cli-share-results');

export async function shareResults({
  results,
  policy,
  tags,
  attributes,
  options,
  meta,
}: {
  results: IacShareResultsFormat[];
  policy: Policy | undefined;
  tags?: Tag[];
  attributes?: ProjectAttributes;
  options?: IaCTestFlags;
  meta: IacOutputMeta;
}): Promise<ShareResultsOutput> {
  const scanResults = results.map((result) =>
    convertIacResultToScanResult(result, policy, meta, options),
  );

  let contributors: Contributor[] = [];
  if (meta.gitRemoteUrl) {
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

  if (res.statusCode === 401) {
    throw AuthFailedError();
  } else if (res.statusCode === 429) {
    throw new TestLimitReachedError();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  } else if (res.statusCode! < 200 || res.statusCode! > 299) {
    throw new ValidationError(
      res.body.error ?? 'An error occurred, please contact Snyk support',
    );
  }

  return { projectPublicIds: body, gitRemoteUrl: meta.gitRemoteUrl };
}
