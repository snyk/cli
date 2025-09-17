import * as createDebug from 'debug';
import * as needle from 'needle';
import stripAnsi = require('strip-ansi');
import { getAuthHeader, someTokenExists } from '../api-token';
import config from '../config';
import { makeRequest } from '../request';
import { config as userConfig } from '../user-config';
import { getStandardData } from './getStandardData';

// Add flags whose values should be redacted in analytics here.
// TODO make this less error-prone by baking the concept of sensitivity into the
// flag-parsing code, but this is a start.
const sensitiveFlags = [
  'tfc-token',
  'azurerm-account-key',
  'fetch-tfstate-headers',
];

const debug = createDebug('snyk');
const metadata = {};
// analytics module is required at the beginning of the CLI run cycle

/**
 *
 * @param data the data to merge into that data which has been staged thus far (with the {@link add} function)
 * and then sent to the backend.
 */
export async function addDataAndSend(
  data,
): Promise<void | { res: needle.NeedleResponse; body: any }> {
  if (!data) {
    data = {};
  }

  // merge any new data with data we picked up along the way
  if (Array.isArray(data.args)) {
    // this is an overhang from the cli/args.js and we don't want it
    delete (data.args.slice(-1).pop() || {})._;

    data.args.forEach((argObj) => {
      if (typeof argObj === 'object') {
        Object.keys(argObj).forEach((field) => {
          if (sensitiveFlags.includes(field)) {
            argObj[field] = 'REDACTED';
          }
        });
      }
    });
  }

  if (Object.keys(metadata).length) {
    data.metadata = metadata;
  }

  return postAnalytics(data);
}

export function allowAnalytics(): boolean {
  if (userConfig.get('disable-analytics') || config.DISABLE_ANALYTICS) {
    return false;
  } else {
    return true;
  }
}

/**
 * Actually send the analytics to the backend. This can be used standalone to send only the data
 * given by the data parameter, or called from {@link addDataAndSend}.
 * @param customData the analytics data to send to the backend.
 */
async function postAnalytics(
  customData,
): Promise<void | { res: needle.NeedleResponse; body: any }> {
  // if the user opt'ed out of analytics, then let's bail out early
  // ths applies to all sending to protect user's privacy
  if (!allowAnalytics()) {
    debug('analytics disabled');
    return Promise.resolve();
  }

  try {
    const standardData = await getStandardData(customData.args);
    const analyticsData = {
      ...customData,
      ...standardData,
    };

    const headers = {};
    if (someTokenExists()) {
      headers['authorization'] = getAuthHeader();
    }

    const queryStringParams = {};
    if (analyticsData.org) {
      queryStringParams['org'] = analyticsData.org;
    }

    const queryString =
      Object.keys(queryStringParams).length > 0 ? queryStringParams : undefined;

    // CLI-586 - do not send CLI args to analytics
    analyticsData.args = [];

    debug('analytics', JSON.stringify(analyticsData, null, '  '));
    const res = await makeRequest({
      body: {
        data: analyticsData,
      },
      qs: queryString,
      url: config.API + '/analytics/cli',
      json: true,
      method: 'post',
      headers: headers,
    });

    return res;
  } catch (err) {
    debug('analytics', err); // this swallows the analytics error
  }
}

/**
 * Adds a key-value pair to the analytics data `metadata` field. This doesn't send the analytics, just stages it for
 * sending later (via the {@link addDataAndSend} function).
 * @param key
 * @param value
 */
export function add(key: string, value: unknown): void {
  if (typeof value === 'string') {
    value = stripAnsi(value);
  }

  if (metadata[key]) {
    switch (key) {
      case 'iac-metrics':
        break;
      case 'iac-type':
        if (typeof value === 'object') {
          for (const type in value) {
            if (metadata[key][type]) {
              for (const metric in value[type]) {
                metadata[key][type][metric] &&
                typeof value[type][metric] === 'number'
                  ? (metadata[key][type][metric] += value[type][metric])
                  : (metadata[key][type][metric] = value[type][metric]);
              }
            } else {
              metadata[key][type] = value[type];
            }
          }
        }
        break;
      default:
        if (typeof value === 'number' && typeof metadata[key] === 'number') {
          metadata[key] += value;
        } else {
          if (!Array.isArray(metadata[key])) {
            metadata[key] = [metadata[key]];
          }
          Array.isArray(value)
            ? metadata[key].push(...value)
            : metadata[key].push(value);
        }
    }
  } else {
    metadata[key] = value;
  }
}
