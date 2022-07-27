import { parseFiles } from './file-parser';
import { scanFiles } from './file-scanner';
import { formatScanResults } from './process-results/results-formatter';
import { trackUsage } from './usage-tracking';
import { cleanLocalCache, initLocalCache } from './local-cache';
import { applyCustomSeverities } from './org-settings/apply-custom-severities';
import { getIacOrgSettings } from './org-settings/get-iac-org-settings';
import { test } from './index';
import { pull } from './rules/oci-pull';
import { performanceAnalyticsObject } from './analytics';
import { PerformanceAnalyticsKey } from './types';
import { loadContentForFiles } from './file-loader';

// Unwrap a promise: https://stackoverflow.com/questions/48011353/how-to-unwrap-type-of-a-promise
type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

// Note: The return type of the returned async function needs to be Promise<Val> for
// the compiler to be happy, so we need to unwrap it with the messy
// Awaiter<ReturnType<T>> rather than just using ReturnType<T> directly.
export function asyncPerformanceAnalyticsDecorator<
  T extends (...args: any[]) => Promise<any>
>(
  measurableMethod: T,
  analyticsKey: PerformanceAnalyticsKey,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async function(...args) {
    const startTime = Date.now();
    const returnValue = await measurableMethod(...args);
    const durationMs = Date.now() - startTime;
    performanceAnalyticsObject[analyticsKey] = durationMs;
    return returnValue;
  };
}

export function performanceAnalyticsDecorator<
  T extends (...args: any[]) => any
>(
  measurableMethod: T,
  analyticsKey: PerformanceAnalyticsKey,
): (...args: Parameters<T>) => ReturnType<T> {
  return function(...args) {
    const startTime = Date.now();
    const returnValue = measurableMethod(...args);
    const durationMs = Date.now() - startTime;
    performanceAnalyticsObject[analyticsKey] = durationMs;
    return returnValue;
  };
}

const measurableInitLocalCache = asyncPerformanceAnalyticsDecorator(
  initLocalCache,
  PerformanceAnalyticsKey.InitLocalCache,
);

const measurableParseFiles = asyncPerformanceAnalyticsDecorator(
  parseFiles,
  PerformanceAnalyticsKey.FileParsing,
);

const measurableloadContentForFiles = asyncPerformanceAnalyticsDecorator(
  loadContentForFiles,
  PerformanceAnalyticsKey.FileLoading,
);

const measurableScanFiles = asyncPerformanceAnalyticsDecorator(
  scanFiles,
  PerformanceAnalyticsKey.FileScanning,
);

const measurableGetIacOrgSettings = asyncPerformanceAnalyticsDecorator(
  getIacOrgSettings,
  PerformanceAnalyticsKey.OrgSettings,
);

const measurableApplyCustomSeverities = asyncPerformanceAnalyticsDecorator(
  applyCustomSeverities,
  PerformanceAnalyticsKey.CustomSeverities,
);

const measurableCleanLocalCache = performanceAnalyticsDecorator(
  cleanLocalCache,
  PerformanceAnalyticsKey.CacheCleanup,
);

const measurableFormatScanResults = performanceAnalyticsDecorator(
  formatScanResults,
  PerformanceAnalyticsKey.ResultFormatting,
);

const measurableTrackUsage = asyncPerformanceAnalyticsDecorator(
  trackUsage,
  PerformanceAnalyticsKey.UsageTracking,
);

const measurableLocalTest = asyncPerformanceAnalyticsDecorator(
  test,
  PerformanceAnalyticsKey.Total,
);

const measurableOciPull = asyncPerformanceAnalyticsDecorator(
  pull,
  PerformanceAnalyticsKey.Total,
);

export {
  measurableInitLocalCache as initLocalCache,
  measurableloadContentForFiles as loadContentForFiles,
  measurableParseFiles as parseFiles,
  measurableScanFiles as scanFiles,
  measurableGetIacOrgSettings as getIacOrgSettings,
  measurableApplyCustomSeverities as applyCustomSeverities,
  measurableFormatScanResults as formatScanResultsV2,
  measurableTrackUsage as trackUsage,
  measurableCleanLocalCache as cleanLocalCache,
  measurableLocalTest as localTest,
  measurableOciPull as pull,
};
