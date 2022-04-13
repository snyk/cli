import * as version from '../version';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as crypto from 'crypto';
import { isCI, getCIName, isPullRequest } from '../is-ci';
import {
  getIntegrationName,
  getIntegrationVersion,
  getIntegrationEnvironment,
  getIntegrationEnvironmentVersion,
} from './sources';
import { StandardAnalyticsData } from './types';
import { MetricsCollector } from '../metrics';
import * as createDebug from 'debug';
import { ArgsOptions } from '../../cli/args';

const osName = require('os-name');
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
  const snykVersion = version.getVersion();
  const seed = uuidv4();
  const shasum = crypto.createHash('sha1');
  const durationMs = Date.now() - START_TIME;
  const metrics = getMetrics(durationMs);

  const data = {
    os: osName(os.platform(), os.release()),
    osPlatform: os.platform(),
    osRelease: os.release(),
    osArch: os.arch(),
    version: snykVersion,
    nodeVersion: process.version,
    standalone: isStandalone,
    integrationName: getIntegrationName(args),
    integrationVersion: getIntegrationVersion(args),
    integrationEnvironment: getIntegrationEnvironment(args),
    integrationEnvironmentVersion: getIntegrationEnvironmentVersion(args),
    id: shasum.update(seed).digest('hex'),
    ci: isCI(),
    ciName: getCIName(),
    pr: isPullRequest(),
    durationMs,
    metrics,
  };
  return data;
}
