import config from '../config';
import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import { FormattedResult } from '../../cli/commands/test/iac-local-execution/types';
import {Contributor} from "../types";
import * as analytics from "../analytics";
import {getContributors} from "../monitor/dev-count-analysis";

export async function sendReport(issues: FormattedResult[]) {
  // TODO: check if allowed
  const contributors = await getContributors();
  console.log(contributors)

  makeRequest({
    method: 'POST',
    url: `${config.API}/iac-cli-report`,
    json: true,
    headers: {
      authorization: getAuthHeader(),
    },
    body: {
      issues,
      contributors,
    },
  });
}