import config from '../../../../../../../lib/config';
import { makeRequest } from '../../../../../../../lib/request';
import { getAuthHeader } from '../../../../../../../lib/api-token';
import {
  IacShareResultsFormat,
  IaCTestFlags,
  ShareResultsOutput,
} from '../../types';
import { convertIacResultToScanResult } from '../../../../../../../lib/iac/envelope-formatters';
import { Policy } from '../../../../../../../lib/policy/find-and-load-policy';
import { getInfo } from '../../../../../../../lib/project-metadata/target-builders/git';
import { GitTarget } from '../../../../../../../lib/ecosystems/types';
import { Contributor } from '../../../../../../../lib/types';
import * as analytics from '../../../../../../../lib/analytics';
import { getContributors } from '../../../../../../../lib/monitor/dev-count-analysis';
import * as Debug from 'debug';
import {
  AuthFailedError,
  ValidationError,
} from '../../../../../../../lib/errors';
import * as pathLib from 'path';

const debug = Debug('iac-cli-share-results');
import { ProjectAttributes, Tag } from '../../../../../../../lib/types';
import { TestLimitReachedError } from '../../usage-tracking';
import { getRepositoryRootForPath } from '../../../../../../../lib/iac/git';

export async function shareResults({
  results,
  policy,
  tags,
  attributes,
  options,
  projectRoot,
}: {
  results: IacShareResultsFormat[];
  policy: Policy | undefined;
  tags?: Tag[];
  attributes?: ProjectAttributes;
  options?: IaCTestFlags;
  projectRoot: string;
}): Promise<ShareResultsOutput> {
  const gitTarget = await readGitInfoForProjectRoot(projectRoot);
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

async function readGitInfoForProjectRoot(
  projectRoot: string,
): Promise<GitTarget> {
  const repositoryRoot = getRepositoryRootForPath(projectRoot);

  const resolvedRepositoryRoot = pathLib.resolve(repositoryRoot);
  const resolvedProjectRoot = pathLib.resolve(projectRoot);

  if (resolvedRepositoryRoot != resolvedProjectRoot) {
    return {};
  }

  const gitInfo = await getInfo({
    isFromContainer: false,
    cwd: projectRoot,
  });

  if (gitInfo) {
    return gitInfo;
  }

  return {};
}
