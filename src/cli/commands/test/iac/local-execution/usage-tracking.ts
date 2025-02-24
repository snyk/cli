import { makeRequest } from '../../../../../lib/request';
import config from '../../../../../lib/config';
import { getAuthHeader } from '../../../../../lib/api-token';
import { CustomError } from '../../../../../lib/errors';
import { CLI } from '@snyk/error-catalog-nodejs-public';

export async function trackUsage(
  formattedResults: TrackableResult[],
  org: string, // e.g. "my.org"
): Promise<void> {
  const trackingData = formattedResults.map((res) => {
    return {
      isPrivate: res.meta.isPrivate,
      issuesPrevented: res.result.cloudConfigResults.length,
    };
  });
  const trackingResponse = await makeRequest({
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
    },
    url: `${config.API}/track-iac-usage/cli`,
    body: { results: trackingData },
    qs: { org },
    gzip: true,
    json: true,
  });
  switch (trackingResponse.res.statusCode) {
    case 200:
      break;
    case 429:
      throw new TestLimitReachedError();
    default:
      throw new CustomError(
        'An error occurred while attempting to track test usage: ' +
          JSON.stringify(trackingResponse.res.body),
      );
  }
}

export class TestLimitReachedError extends CustomError {
  constructor() {
    super(
      'Test limit reached! You have exceeded your infrastructure as code test allocation for this billing period.',
    );
    this.errorCatalog = new CLI.GeneralIACFailureError('');
  }
}

// Sub-interface of FormattedResult that we really only use to make test
// fixtures easier to create.
export interface TrackableResult {
  meta: {
    isPrivate: boolean;
  };
  result: {
    cloudConfigResults: any[];
  };
}
