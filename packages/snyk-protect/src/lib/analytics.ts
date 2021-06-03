import { AnalyticsPayload, ProtectResult } from './types';
import { postJson } from './http';
import { getApiBaseUrl } from './snyk-api';
import * as os from 'os';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

function getVersion(): string {
  return JSON.parse(
    readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'),
  ).version;
}

function getAnalyticsData(result: ProtectResult): AnalyticsPayload {
  return {
    command: `@snyk/protect`,
    args: [],
    version: getVersion(),
    nodeVersion: process.version,
    metadata: {
      protectResult: result,
    },
  };
}

export async function sendAnalytics(result: ProtectResult) {
  if (!allowAnalytics()) {
    return;
  }
  try {
    const apiBaseUrl = getApiBaseUrl();
    const apiUrl = `${apiBaseUrl}/v1/analytics/cli`;
    const data = {
      data: getAnalyticsData(result),
    };
    await postJson(apiUrl, data);
  } catch (err) {
    // do nothing and log nothing
  }
}

function allowAnalytics(): boolean {
  try {
    const snykConfigFile = getSnykConfigFilePath();
    if (existsSync(snykConfigFile)) {
      const config = JSON.parse(readFileSync(snykConfigFile, 'utf-8'));
      if (
        config['disable-analytics'] === '1' ||
        config['disable-analytics'] === 1
      ) {
        return false;
      }
    }
    if (process.env.SNYK_DISABLE_ANALYTICS) {
      return false;
    }
  } catch (err) {
    // do nothing and log nothing
  }
  return true;
}

function getSnykConfigFilePath(): string {
  return (
    process.env.SNYK_CONFIG_FILE ||
    path.resolve(os.homedir(), '.config', 'configstore', 'snyk.json')
  );
}
