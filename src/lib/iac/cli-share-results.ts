import config from '../config';
import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import {
  IaCErrorCodes,
  IacShareResultsFormat,
  IaCTestFlags,
  ShareResultsOutput,
} from '../../cli/commands/test/iac-local-execution/types';
import { convertIacResultToScanResult } from './envelope-formatters';
import { Policy } from '../policy/find-and-load-policy';
import { getInfo } from '../project-metadata/target-builders/git';
import { GitTarget } from '../ecosystems/types';
import { Contributor } from '../types';
import * as analytics from '../analytics';
import { getContributors } from '../monitor/dev-count-analysis';
import * as Debug from 'debug';
import { AuthFailedError, CustomError, ValidationError } from '../errors';

const debug = Debug('iac-cli-share-results');
import { ProjectAttributes, Tag } from '../types';
import { getErrorStringCode } from '../../cli/commands/test/iac-local-execution/error-utils';

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

  if (res.statusCode === 200) {
    return { projectPublicIds: body, gitRemoteUrl: gitTarget?.remoteUrl };
  } else {
    if (res.statusCode === 401) {
      throw AuthFailedError();
    } else if (res.statusCode === 422 && body.error) {
      throw new ValidationError(body.error);
    } else {
      throw new FailedToShareResults();
    }
  }
}

class FailedToShareResults extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to share results');
    this.code = IaCErrorCodes.FailedToShareResults;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'An error occurred when trying to share your results, please contact Snyk support (support@snyk.io)';
  }
}
