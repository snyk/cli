const snyk = require('../../lib');
const config = require('../config');
import { makeRequest } from '../request';
const debug = require('debug')('snyk');
const stripAnsi = require('strip-ansi');
import * as needle from 'needle';
import { getStandardData } from './getStandardData';

const metadata = {};
// analytics module is required at the beginning of the CLI run cycle

/**
 *
 * @param data the data to merge into that data which has been staged thus far (with the {@link add} function)
 * and then sent to the backend.
 */
export function addDataAndSend(
  data,
): Promise<void | { res: needle.NeedleResponse; body: any }> {
  if (!data) {
    data = {};
  }

  // merge any new data with data we picked up along the way
  if (Array.isArray(data.args)) {
    // this is an overhang from the cli/args.js and we don't want it
    delete (data.args.slice(-1).pop() || {})._;
  }

  if (Object.keys(metadata).length) {
    data.metadata = metadata;
  }

  return postAnalytics(data);
}

export function allowAnalytics(): boolean {
  if (snyk.config.get('disable-analytics') || config.DISABLE_ANALYTICS) {
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
export async function postAnalytics(
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
    debug('analytics', JSON.stringify(analyticsData, null, '  '));

    const headers = {};
    if (snyk.api) {
      headers['authorization'] = 'token ' + snyk.api;
    }

    const queryStringParams = {};
    if (analyticsData.org) {
      queryStringParams['org'] = analyticsData.org;
    }

    const queryString =
      Object.keys(queryStringParams).length > 0 ? queryStringParams : undefined;

    return makeRequest({
      body: {
        data: analyticsData,
      },
      qs: queryString,
      url: config.API + '/analytics/cli',
      json: true,
      method: 'post',
      headers: headers,
    });
  } catch (err) {
    debug('analytics', err); // this swallows the analytics error
  }
}

/**
 * Adds a key-value pair to the analytics data `metadata` field. This doesn't send the analytis, just stages it for
 * sending later (via the {@link addDataAndSend} function).
 * @param key
 * @param value
 */
export function add(key, value) {
  if (typeof value === 'string') {
    value = stripAnsi(value);
  }
  if (metadata[key]) {
    if (!Array.isArray(metadata[key])) {
      metadata[key] = [metadata[key]];
    }
    metadata[key].push(value);
  } else {
    metadata[key] = value;
  }
}
