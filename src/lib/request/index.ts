import request = require('./request');
import alerts = require('../alerts');
import { MetricsCollector } from '../metrics';
import { SnykResponse } from './types';

// A hybrid async function: both returns a promise and takes a callback
async function requestWrapper(payload: any): Promise<SnykResponse>;

async function requestWrapper(
  payload: any,
  callback: (err: Error | null, res?, body?) => void,
): Promise<void>;

async function requestWrapper(
  payload: any,
  callback?: (err: Error | null, res?, body?) => void,
): Promise<void | SnykResponse> {
  const totalNetworkTimeTimer = MetricsCollector.NETWORK_TIME.createInstance();
  totalNetworkTimeTimer.start();
  try {
    const result = await request(payload);
    if (result.body.alerts) {
      alerts.registerAlerts(result.body.alerts);
    }
    // make callbacks and promises work
    if (callback) {
      callback(null, result.res, result.body);
    }
    return result;
  } catch (error) {
    if (callback) {
      return callback(error);
    }
    throw error;
  } finally {
    totalNetworkTimeTimer.stop();
  }
}

export = requestWrapper;
