import {
  AppContext,
  AppsErrorMessages,
  createAppPrompts,
  ICreateAppRequest,
  ICreateAppOptions,
  SNYK_APP_NAME,
  SNYK_APP_REDIRECT_URIS,
  SNYK_APP_SCOPES,
  SNYK_APP_ORG_ID,
  SNYK_APP_CONTEXT,
  validateUUID,
  validateAllURL,
} from '..';
import * as enquirer from 'enquirer';
import { ValidationError } from '../../errors';

/**
 * Validates and parsed the data required to create app.
 * Throws error if option is not provided or is invalid
 * @param {ICreateAppOptions} options required to create an app
 * @returns {ICreateAppRequest} data that is used to make the request
 */
export function createAppDataScriptable(
  options: ICreateAppOptions,
): ICreateAppRequest {
  if (!options.org) {
    throw new ValidationError(AppsErrorMessages.orgRequired);
  } else if (typeof validateUUID(options.org) === 'string') {
    // Combines to form "Invalid UUID provided for org id"
    throw new ValidationError(`${validateUUID(options.org)} for org id`);
  } else if (!options.name) {
    throw new ValidationError(AppsErrorMessages.nameRequired);
  } else if (!options['redirect-uris']) {
    throw new ValidationError(AppsErrorMessages.redirectUrisRequired);
  } else if (typeof validateAllURL(options['redirect-uris']) === 'string') {
    throw new ValidationError(
      validateAllURL(options['redirect-uris']) as string,
    );
  } else if (!options.scopes) {
    throw new ValidationError(AppsErrorMessages.scopesRequired);
  } else if (
    options.context != null &&
    !(options.context == 'user' || options.context == 'tenant')
  ) {
    throw new ValidationError(AppsErrorMessages.invalidContext);
  } else {
    return {
      orgId: options.org,
      snykAppName: options.name,
      snykAppRedirectUris: options['redirect-uris']
        .replace(/\s+/g, '')
        .split(','),
      snykAppScopes: options.scopes.replace(/\s+/g, '').split(','),
      context: options.context,
    };
  }
}

// Interactive format
export async function createAppDataInteractive(): Promise<ICreateAppRequest> {
  // Proceed with interactive
  const answers = await enquirer.prompt(createAppPrompts);
  // Process answers
  const snykAppName = answers[SNYK_APP_NAME].trim() as string;
  const snykAppRedirectUris = answers[SNYK_APP_REDIRECT_URIS].replace(
    /\s+/g,
    '',
  ).split(',') as string[];
  const snykAppScopes = answers[SNYK_APP_SCOPES].replace(/\s+/g, '').split(
    ',',
  ) as string[];
  const orgId = answers[SNYK_APP_ORG_ID].trim() as string;
  const context = answers[SNYK_APP_CONTEXT].trim() as AppContext;
  // POST: to create an app
  return {
    orgId,
    snykAppName,
    snykAppRedirectUris,
    snykAppScopes,
    context,
  };
}
