import * as version from '../version';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
const osName = require('os-name');
import crypto from 'crypto';
import { isCI } from '../is-ci';
import {
  getIntegrationName,
  getIntegrationVersion,
  getIntegrationEnvironment,
  getIntegrationEnvironmentVersion,
  getCommandVersion,
} from './sources';

import { StandardAnalyticsData } from './types';
import { MetricsCollector } from '../metrics';
import createDebug from 'debug';
import { ArgsOptions } from '../../cli/args';

const debug = createDebug('snyk');
const START_TIME = Date.now();

function getMetrics(durationMs: number): any[] | undefined {
  try {
    const networkTime = MetricsCollector.NETWORK_TIME.getTotal();
    const cpuTime = durationMs - networkTime;
    MetricsCollector.CPU_TIME.createInstance().setValue(cpuTime);
    return MetricsCollector.getAllMetrics();
  } catch (err) {
    debug('Error with metrics', err);
  }
}

export async function getStandardData(
  args: ArgsOptions[],
): Promise<StandardAnalyticsData> {
  const isStandalone = version.isStandaloneBuild();
  const snykVersion = await version.getVersion();
  const seed = uuidv4();
  const shasum = crypto.createHash('sha1');
  const environment = isStandalone
    ? {}
    : {
        npmVersion: await getCommandVersion('npm'),
      };
  const durationMs = Date.now() - START_TIME;

  const metrics = getMetrics(durationMs);

  const data = {
    os: osName(os.platform(), os.release()),
    version: snykVersion,
    nodeVersion: process.version,
    standalone: isStandalone,
    integrationName: getIntegrationName(args),
    integrationVersion: getIntegrationVersion(args),
    integrationEnvironment: getIntegrationEnvironment(args),
    integrationEnvironmentVersion: getIntegrationEnvironmentVersion(args),
    id: shasum.update(seed).digest('hex'),
    ci: isCI(),
    environment,
    durationMs,
    metrics,
  };
  return data;
}
