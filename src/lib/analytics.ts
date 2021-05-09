const snyk = require('../lib');
const config = require('./config');
const version = require('./version');
const request = require('./request');
const {
  getIntegrationName,
  getIntegrationVersion,
  getIntegrationEnvironment,
  getIntegrationEnvironmentVersion,
  getCommandVersion,
} = require('./analytics-sources');
const isCI = require('./is-ci').isCI;
const util = require('util');
const debug = util.debuglog('snyk');
const os = require('os');
const osName = require('os-name');
const crypto = require('crypto');
const uuid = require('uuid');
const stripAnsi = require('strip-ansi');
import * as needle from 'needle';
const { MetricsCollector } = require('./metrics');

const metadata = {};
// analytics module is required at the beginning of the CLI run cycle
const startTime = Date.now();

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
 * @param data the analytics data to send to the backend.
 */
export function postAnalytics(
  data,
): Promise<void | { res: needle.NeedleResponse; body: any }> {
  // if the user opt'ed out of analytics, then let's bail out early
  // ths applies to all sending to protect user's privacy
  if (!allowAnalytics()) {
    debug('analytics disabled');
    return Promise.resolve();
  }

  const isStandalone = version.isStandaloneBuild();

  // get snyk version
  return version
    .getVersion()
    .then(async (version) => {
      data.version = version;
      data.os = osName(os.platform(), os.release());
      data.nodeVersion = process.version;
      data.standalone = isStandalone;
      data.integrationName = getIntegrationName(data.args);
      data.integrationVersion = getIntegrationVersion(data.args);
      data.integrationEnvironment = getIntegrationEnvironment(data.args);
      data.integrationEnvironmentVersion = getIntegrationEnvironmentVersion(
        data.args,
      );

      const seed = uuid.v4();
      const shasum = crypto.createHash('sha1');
      data.id = shasum.update(seed).digest('hex');

      const headers = {};
      if (snyk.api) {
        headers['authorization'] = 'token ' + snyk.api;
      }

      data.ci = isCI();

      data.environment = {};
      if (!isStandalone) {
        data.environment.npmVersion = await getCommandVersion('npm');
      }

      data.durationMs = Date.now() - startTime;

      try {
        const networkTime = MetricsCollector.NETWORK_TIME.getTotal();
        const cpuTime = data.durationMs - networkTime;
        MetricsCollector.CPU_TIME.createInstance().setValue(cpuTime);
        data.metrics = MetricsCollector.getAllMetrics();
      } catch (err) {
        debug('Error with metrics', err);
      }

      const queryStringParams = {};
      if (data.org) {
        queryStringParams['org'] = data.org;
      }

      debug('analytics', JSON.stringify(data, null, '  '));

      const queryString =
        Object.keys(queryStringParams).length > 0
          ? queryStringParams
          : undefined;

      return request({
        body: {
          data: data,
        },
        qs: queryString,
        url: config.API + '/analytics/cli',
        json: true,
        method: 'post',
        headers: headers,
      });
    })
    .catch((error) => {
      debug('analytics', error); // this swallows the analytics error
    });
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
