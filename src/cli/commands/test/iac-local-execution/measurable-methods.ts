import { loadFiles } from './file-loader';
import { parseFiles } from './file-parser';
import { scanFiles } from './file-scanner';
import { formatScanResults } from './results-formatter';
import { cleanLocalCache, initLocalCache } from './local-cache';
import {
  FormattedResult,
  IacFileData,
  IacFileScanResult,
  IacOrgSettings,
  ParsingResults,
  TestReturnValue,
} from './types';
import { applyCustomSeverities } from './org-settings/apply-custom-severities';
import { getIacOrgSettings } from './org-settings/get-iac-org-settings';
import { test } from './index';
import {
  PerformanceAnalyticsKey,
  performanceAnalyticsObject,
} from './analytics';

export type AsyncMeasurableMethod<ReturnValue> = (
  ...args: unknown[]
) => Promise<ReturnValue>;

export type MeasurableMethod<ReturnValue> = (...args: unknown[]) => ReturnValue;

export function asyncPerformanceAnalyticsDecorator<ReturnValue>(
  measurableMethod: AsyncMeasurableMethod<ReturnValue>,
  analyticsKey: PerformanceAnalyticsKey,
) {
  return async function(...args: unknown[]): Promise<ReturnValue> {
    const startTime = Date.now();
    const returnValue = await measurableMethod(...args);
    const durationMs = Date.now() - startTime;
    performanceAnalyticsObject[analyticsKey] = durationMs;
    return returnValue;
  };
}

export function performanceAnalyticsDecorator<ReturnValue>(
  measurableMethod: MeasurableMethod<ReturnValue>,
  analyticsKey: PerformanceAnalyticsKey,
) {
  return function(...args: unknown[]): ReturnValue {
    const startTime = Date.now();
    const returnValue = measurableMethod(...args);
    const durationMs = Date.now() - startTime;
    performanceAnalyticsObject[analyticsKey] = durationMs;
    return returnValue;
  };
}

const measurableInitLocalCache = asyncPerformanceAnalyticsDecorator<void>(
  initLocalCache as AsyncMeasurableMethod<void>,
  PerformanceAnalyticsKey.InitLocalCache,
);

const measurableLoadFiles = asyncPerformanceAnalyticsDecorator<IacFileData[]>(
  loadFiles as AsyncMeasurableMethod<IacFileData[]>,
  PerformanceAnalyticsKey.FileLoading,
);

const measurableParseFiles = asyncPerformanceAnalyticsDecorator<ParsingResults>(
  parseFiles as AsyncMeasurableMethod<ParsingResults>,
  PerformanceAnalyticsKey.FileParsing,
);

const measurableScanFiles = asyncPerformanceAnalyticsDecorator<
  IacFileScanResult[]
>(
  scanFiles as AsyncMeasurableMethod<IacFileScanResult[]>,
  PerformanceAnalyticsKey.FileScanning,
);

const measurableGetIacOrgSettings = asyncPerformanceAnalyticsDecorator<
  IacOrgSettings
>(
  getIacOrgSettings as AsyncMeasurableMethod<IacOrgSettings>,
  PerformanceAnalyticsKey.OrgSettings,
);

const measurableApplyCustomSeverities = asyncPerformanceAnalyticsDecorator<
  IacFileScanResult[]
>(
  applyCustomSeverities as AsyncMeasurableMethod<IacFileScanResult[]>,
  PerformanceAnalyticsKey.CustomSeverities,
);

const measurableCleanLocalCache = performanceAnalyticsDecorator<void>(
  cleanLocalCache as MeasurableMethod<void>,
  PerformanceAnalyticsKey.CacheCleanup,
);

export const measurableFormatScanResults = performanceAnalyticsDecorator<
  FormattedResult[]
>(
  formatScanResults as MeasurableMethod<FormattedResult[]>,
  PerformanceAnalyticsKey.ResultFormatting,
);

export const measurableLocalTest = asyncPerformanceAnalyticsDecorator<
  TestReturnValue
>(
  test as AsyncMeasurableMethod<TestReturnValue>,
  PerformanceAnalyticsKey.Total,
);

export {
  measurableInitLocalCache as initLocalCache,
  measurableLoadFiles as loadFiles,
  measurableParseFiles as parseFiles,
  measurableScanFiles as scanFiles,
  measurableGetIacOrgSettings as getIacOrgSettings,
  measurableApplyCustomSeverities as applyCustomSeverities,
  measurableFormatScanResults as formatScanResults,
  measurableCleanLocalCache as cleanLocalCache,
  measurableLocalTest as localTest,
};
