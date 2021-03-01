import {
  analyzeFolders,
  emitter as codeEmitter,
  AnalysisSeverity,
} from '@snyk/code-client';
import { Log, ReportingDescriptor, Result } from 'sarif';
import { SEVERITY } from '../../snyk-test/legacy';
import { api } from '../../api-token';
import * as config from '../../config';
import spinner = require('../../spinner');
import { Options } from '../../types';
import { FeatureNotSupportedBySnykCodeError } from './errors/unsupported-feature-snyk-code-error';

export async function getCodeAnalysisAndParseResults(
  root: string,
  options: Options,
): Promise<Log> {
  let currentLabel = '';
  await spinner.clearAll();
  codeEmitter.on('scanFilesProgress', async (processed: number) => {
    const spinnerLbl = `Indexed ${processed} files`;
    spinner.clear<void>(currentLabel)();
    currentLabel = spinnerLbl;
    await spinner(spinnerLbl);
  });
  codeEmitter.on(
    'uploadBundleProgress',
    async (processed: number, total: number) => {
      const spinnerLbl = `Upload bundle progress: ${processed}/${total}`;
      spinner.clear<void>(currentLabel)();
      currentLabel = spinnerLbl;
      await spinner(spinnerLbl);
    },
  );
  codeEmitter.on('analyseProgress', async (data: any) => {
    const spinnerLbl = `Analysis ${data.status}: ${Math.round(
      data.progress * 100,
    )}%`;
    spinner.clear<void>(currentLabel)();
    currentLabel = spinnerLbl;
    await spinner(spinnerLbl);
  });

  codeEmitter.on('sendError', (error) => {
    throw error;
  });
  const codeAnalysis = await getCodeAnalysis(root, options);
  spinner.clearAll();
  return parseSecurityResults(codeAnalysis);
}

async function getCodeAnalysis(root: string, options: Options): Promise<Log> {
  const baseURL = config.CODE_CLIENT_PROXY_URL;
  const sessionToken = api() || '';

  const severity = options.severityThreshold
    ? severityToAnalysisSeverity(options.severityThreshold)
    : AnalysisSeverity.info;
  const paths: string[] = [root];
  const sarif = true;

  const result = await analyzeFolders({
    baseURL,
    sessionToken,
    severity,
    paths,
    sarif,
  });

  return result.sarifResults!;
}

function severityToAnalysisSeverity(severity: SEVERITY): AnalysisSeverity {
  if (severity === SEVERITY.CRITICAL) {
    throw new FeatureNotSupportedBySnykCodeError(SEVERITY.CRITICAL);
  }
  const severityLevel = {
    low: 1,
    medium: 2,
    high: 3,
  };
  return severityLevel[severity];
}

function parseSecurityResults(codeAnalysis: Log): Log {
  let securityRules;

  const rules = codeAnalysis.runs[0].tool.driver.rules;
  const results = codeAnalysis.runs[0].results;

  if (rules) {
    securityRules = getSecurityRulesMap(rules);
    codeAnalysis.runs[0].tool.driver.rules = Object.values(securityRules);
  }
  if (results && securityRules) {
    codeAnalysis.runs[0].results = getSecurityResults(
      results,
      Object.keys(securityRules),
    );
  }

  return codeAnalysis;
}

function getSecurityRulesMap(
  rules: ReportingDescriptor[],
): { [ruleId: string]: ReportingDescriptor[] } {
  const securityRules = rules.reduce((acc, rule) => {
    const { id: ruleId, properties } = rule;
    const isSecurityRule = properties?.tags?.some(
      (tag) => tag.toLowerCase() === 'security',
    );
    if (isSecurityRule) {
      acc[ruleId] = rule;
    }
    return acc;
  }, {});

  return securityRules;
}

function getSecurityResults(
  results: Result[],
  securityRules: string[],
): Result[] {
  const securityResults = results.reduce((acc: Result[], result: Result) => {
    const isSecurityResult = securityRules.some(
      (securityRule) => securityRule === result?.ruleId,
    );
    if (isSecurityResult) {
      acc.push(result);
    }
    return acc;
  }, []);

  return securityResults;
}
