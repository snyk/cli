import { CreateAppPromptData } from './constants';
import { validInput, validateAllURL, validateUUID } from './input-validator';

/**
 * Prompts for $snyk apps create command
 */
export const createAppPrompts = [
  {
    name: CreateAppPromptData.SNYK_APP_NAME.name,
    message: CreateAppPromptData.SNYK_APP_NAME.message,
    validate: validInput,
  },
  {
    name: CreateAppPromptData.SNYK_APP_REDIRECT_URIS.name,
    message: CreateAppPromptData.SNYK_APP_REDIRECT_URIS.message,
    validate: validateAllURL,
  },
  {
    name: CreateAppPromptData.SNYK_APP_SCOPES.name,
    message: CreateAppPromptData.SNYK_APP_SCOPES.message,
    validate: validInput,
  },
  {
    name: CreateAppPromptData.SNYK_APP_ORG_ID.name,
    message: CreateAppPromptData.SNYK_APP_ORG_ID.message,
    validate: validateUUID,
  },
];
