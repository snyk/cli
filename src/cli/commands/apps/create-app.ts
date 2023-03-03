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
    context,
  } = data;
  const payload = {
    method: 'POST',
    url: getAppsURL(EAppsURL.CREATE_APP, { orgId }),
    body: {
      name,
      redirect_uris: redirectUris,
      scopes,
      context,
    },
    qs: {
      version: '2022-03-11~experimental',
    },
    noCompression: true,
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
