/**
 * Collection of utility function for the
 * $snyk apps commands
 */
import {
  EAppsURL,
  ICreateAppResponse,
  IGetAppsURLOpts,
  IRestErrorResponse,
  SNYK_APP_DEBUG,
} from '.';
import chalk from 'chalk';
import { AuthFailedError, InternalServerError } from '../errors';
import * as Debug from 'debug';
import config from '../config';

const debug = Debug(SNYK_APP_DEBUG);

export function getAppsURL(
  selection: EAppsURL,
  opts: IGetAppsURLOpts = {},
): string {
  // Get the rest URL from user config
  // Environment variable takes precedence over config
  const baseURL = config.API_REST_URL;
  debug(`API rest base URL => ${baseURL}`);

  switch (selection) {
    case EAppsURL.CREATE_APP:
      return `${baseURL}/orgs/${opts.orgId}/apps`;
    default:
      throw new Error('Invalid selection for URL');
  }
}

export function handleRestError(error: any): void {
  if (error.code) {
    if (error.code === 400) {
      // Bad request
      const responseJSON: IRestErrorResponse = error.body;
      const errString = errorsToDisplayString(responseJSON);
      throw new Error(errString);
    } else if (error.code === 401) {
      // Unauthorized
      throw AuthFailedError();
    } else if (error.code === 403) {
      throw new Error(
        'Forbidden! the authentication token does not have access to the resource.',
      );
    } else if (error.code === 404) {
      const responseJSON: IRestErrorResponse = error.body;
      const errString = errorsToDisplayString(responseJSON);
      throw new Error(errString);
    } else if (error.code === 500) {
      throw new InternalServerError('Internal server error');
    } else {
      throw new Error(error.message);
    }
  } else {
    throw error;
  }
}

/**
 * @param errRes RestError response
 * @returns {String} Iterates over error and
 * converts them into a readible string
 */
function errorsToDisplayString(errRes: IRestErrorResponse): string {
  const resString = `Uh oh! an error occurred while trying to create the Snyk App.
Please run the command with '--debug' or '-d' to get more information`;
  if (!errRes.errors) return resString;
  errRes.errors.forEach((e) => {
    let metaString = '',
      sourceString = '';
    if (e.meta) {
      for (const [key, value] of Object.entries(e.meta)) {
        metaString += `${key}: ${value}\n`;
      }
    }
    if (e.source) {
      for (const [key, value] of Object.entries(e.source)) {
        sourceString += `${key}: ${value}\n`;
      }
    }

    const meta = metaString || '-';
    const source = sourceString || '-';

    return `Uh oh! an error occurred while trying to create the Snyk App.

Error Description:\t${e.detail}
Request Status:\t${e.status}
Source:\t${source}
Meta:\t${meta}`;
  });
  return resString;
}

export function handleCreateAppRes(res: ICreateAppResponse): string {
  const {
    name,
    clientId,
    redirectUris,
    scopes,
    isPublic,
    clientSecret,
  } = res.data.attributes;

  return `Snyk App created successfully!
Please ensure you save the following details:

App Name:\t${name}
Client ID:\t${clientId}
Redirect URIs:\t${redirectUris}
Scopes:\t${scopes}
Is App Public:\t${isPublic}
Client Secret (${chalk.redBright(
    'keep it safe and protected',
  )}):\t${clientSecret}`;
}
