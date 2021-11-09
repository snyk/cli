import omit = require('lodash.omit');
import { TestProject } from './createProject';

/**
 * Removes authentication tokens from environment variables and persisted
 * config stores. The latter is done by pointing the config path to a local
 * directory within the test project rather than using the user's
 * home directory.
 */
export const removeAuth = (
  project: TestProject,
  env: Record<string, string>,
): Record<string, string> => {
  return {
    ...omit(env, ['SNYK_TOKEN']),
    XDG_CONFIG_HOME: project.path('.config'),
  };
};
