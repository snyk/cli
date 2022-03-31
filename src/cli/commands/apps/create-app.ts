import * as Debug from 'debug';
import {
  EAppsURL,
  getAppsURL,
  handleCreateAppRes,
  handleRestError,
  ICreateAppRequest,
  ICreateAppResponse,
  SNYK_APP_DEBUG,
} from '../../../lib/apps';
import { makeRequestRest } from '../../../lib/request/promise';
import { spinner } from '../../../lib/spinner';

const debug = Debug(SNYK_APP_DEBUG);

/**
 * Function to process the app creation request and
 * handle any errors that are request error and print
 * in a formatted string. It throws is error is unknown
 * or cannot be handled.
 * @param {ICreateAppRequest} data to create the app
 * @returns {String} response formatted string
 */
export async function createApp(
  data: ICreateAppRequest,
): Promise<string | void> {
  debug('App data', data);
  const {
    orgId,
    snykAppName: name,
    snykAppRedirectUris: redirectUris,
    snykAppScopes: scopes,
  } = data;
  const payload = {
    method: 'POST',
    url: getAppsURL(EAppsURL.CREATE_APP, { orgId }),
    body: {
      name,
      redirectUris,
      scopes,
    },
    qs: {
      version: '2021-08-11~experimental',
    },
  };

  try {
    await spinner('Creating your Snyk App');
    const response = await makeRequestRest<ICreateAppResponse>(payload);
    debug(response);
    spinner.clearAll();
    return handleCreateAppRes(response);
  } catch (error) {
    spinner.clearAll();
    handleRestError(error);
  }
}
