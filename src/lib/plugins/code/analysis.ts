import { AnalysisSeverity, analyzeFolders } from '@snyk/code-client';
import { Log, ReportingDescriptor, Result } from 'sarif';
import { SEVERITY } from '../../snyk-test/legacy';
import { api } from '../../api-token';
import * as config from '../../config';
import spinner = require('../../spinner');
import { Options } from '../../types';

export async function getCodeAnalysisAndParseResults(
  spinnerLbl: string,
  root: string,
  options: Options,
): Promise<Log> {
  await spinner.clear<void>(spinnerLbl)();
  await spinner(spinnerLbl);

  const codeAnalysis = await getCodeAnalysis(root, options);
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
