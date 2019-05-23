import * as snykConfig from 'snyk-config';
import * as userConfig from './user-config';
import * as url from 'url';

const DEFAULT_TIMEOUT = 5 * 60; // in seconds
interface Config {
  API: string; // api url
  api: string; // token
  disableSuggestions: string;
  org: string;
  ROOT: string;
  timeout: number;
  PROJECT_NAME: string;
  TOKEN: string;
}

const config: Config = snykConfig(__dirname + '/../..');

// allow user config override of the api end point
const endpoint = userConfig.get('endpoint');
if (endpoint) {
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
  config.timeout = +timeout ? +timeout : DEFAULT_TIMEOUT;
}

// this is a bit of an assumption that our web site origin is the same
// as our API origin, but for now it's okay - RS 2015-10-16
if (!config.ROOT) {
  const apiUrl = url.parse(config.API);
  config.ROOT = apiUrl.protocol + '//' + apiUrl.host;
}

export = config;
