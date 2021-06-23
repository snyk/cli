import { analyzeFolders, AnalysisSeverity } from '@snyk/code-client';
import { Log, ReportingDescriptor, Result } from 'sarif';
import { SEVERITY } from '../../snyk-test/legacy';
import { api } from '../../api-token';
import * as config from '../../config';
import spinner = require('../../spinner');
import { Options } from '../../types';
import { analysisProgressUpdate } from './utils';
import { FeatureNotSupportedBySnykCodeError } from './errors/unsupported-feature-snyk-code-error';
import { getProxyForUrl } from 'proxy-from-env';
import { bootstrap } from 'global-agent';

export async function getCodeAnalysisAndParseResults(
  root: string,
  options: Options,
): Promise<Log> {
  const currentLabel = '';
  await spinner.clearAll();
  analysisProgressUpdate(currentLabel);
  const codeAnalysis = await getCodeAnalysis(root, options);
  spinner.clearAll();
  return parseSecurityResults(codeAnalysis);
}

async function getCodeAnalysis(root: string, options: Options): Promise<Log> {
  const baseURL = config.CODE_CLIENT_PROXY_URL;

  // TODO(james) This mirrors the implementation in request.ts and we need to use this for deeproxy calls
  // This ensures we support lowercase http(s)_proxy values as well
  // The weird IF around it ensures we don't create an envvar with
  // a value of undefined, which throws error when trying to use it as a proxy
  if (process.env.HTTP_PROXY || process.env.http_proxy) {
    process.env.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
  }
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    process.env.HTTPS_PROXY =
      process.env.HTTPS_PROXY || process.env.https_proxy;
  }

  const proxyUrl = getProxyForUrl(baseURL);
  if (proxyUrl) {
    bootstrap({
      environmentVariableNamespace: '',
    });
  }

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
  let securityRulesMap;

  const rules = codeAnalysis.runs[0].tool.driver.rules;
  const results = codeAnalysis.runs[0].results;

  if (rules) {
    securityRulesMap = getSecurityRulesMap(rules);
    codeAnalysis.runs[0].tool.driver.rules = Object.values(securityRulesMap);
  }
  if (results && securityRulesMap) {
    codeAnalysis.runs[0].results = getSecurityResultsOnly(
      results,
      Object.keys(securityRulesMap),
    );
  }

  return codeAnalysis;
}

function getSecurityRulesMap(
  rules: ReportingDescriptor[],
): { [ruleId: string]: ReportingDescriptor[] } {
  const securityRulesMap = rules.reduce((acc, rule) => {
    const { id: ruleId, properties } = rule;
    const isSecurityRule = properties?.categories?.some(
      (category) => category.toLowerCase() === 'security',
    );
    if (isSecurityRule) {
      acc[ruleId] = rule;
    }
    return acc;
  }, {});

  return securityRulesMap;
}

function getSecurityResultsOnly(
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
