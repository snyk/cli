import * as snykConfig from 'snyk-config';
import { InvalidEndpointConfigError } from './errors/invalid-endpoint-config-error';
import { config as userConfig } from './user-config';
import * as url from 'url';

const DEFAULT_TIMEOUT = 5 * 60; // in seconds
interface Config {
  PRUNE_DEPS_THRESHOLD: number;
  MAX_PATH_COUNT: number;
  API: string;
  api: string;
  disableSuggestions: string;
  org: string;
  ROOT: string;
  timeout: number;
  PROJECT_NAME: string;
  TOKEN: string;
  CODE_CLIENT_PROXY_URL: string;
}

// TODO: fix the types!
const config = (snykConfig.loadConfig(
  __dirname + '/../..',
) as unknown) as Config;

// allow user config override of the API endpoint
const endpoint = userConfig.get('endpoint');
if (endpoint && endpoint !== config.API) {
  const parsedEndpoint = url.parse(endpoint);
  // Endpoint option must be a valid URL including protocol
  if (!parsedEndpoint || !parsedEndpoint.protocol || !parsedEndpoint.host) {
    throw new InvalidEndpointConfigError();
  }
  console.warn(
    'Using a custom API endpoint from `snyk config` (tip: it should contain path to `/api`):',
    endpoint,
  );
  config.API = endpoint;
}

const disableSuggestions = userConfig.get('disableSuggestions');
if (disableSuggestions) {
  config.disableSuggestions = disableSuggestions;
}

const org = userConfig.get('org');
if (!config.org && org) {
  config.org = org;
}

// client request timeout
// to change, set this config key to the desired value in seconds
// invalid (non-numeric) value will fallback to the default
const timeout = userConfig.get('timeout');
if (!config.timeout) {
  config.timeout = timeout && +timeout ? +timeout : DEFAULT_TIMEOUT;
}

// this is a bit of an assumption that our web site origin is the same
// as our API origin, but for now it's okay - RS 2015-10-16
if (!config.ROOT) {
  const apiUrl = url.parse(config.API);
  config.ROOT = apiUrl.protocol + '//' + apiUrl.host;
}

export = config;
