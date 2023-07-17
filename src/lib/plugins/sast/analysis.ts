import {
  analyzeFolders,
  analyzeScmProject,
  AnalysisSeverity,
  MAX_FILE_SIZE,
  FileAnalysis,
  ScmAnalysis,
} from '@snyk/code-client';
import { ReportingDescriptor, Result } from 'sarif';
import { SEVERITY } from '../../snyk-test/legacy';
import { getAuthHeader } from '../../api-token';
import config from '../../config';
import { spinner } from '../../spinner';
import { Options } from '../../types';
import {
  SastSettings,
  Log,
  CodeTestResults,
  CodeAnalysisResults,
} from './types';
import { analysisProgressUpdate } from './utils';
import {
  FeatureNotSupportedBySnykCodeError,
  MissingConfigurationError,
} from './errors';
import { getProxyForUrl } from 'proxy-from-env';
import { bootstrap } from 'global-agent';
import chalk from 'chalk';
import * as debugLib from 'debug';
import { getCodeClientProxyUrl } from '../../code-config';

const debug = debugLib('snyk-code');

export async function getCodeTestResults(
  root: string,
  options: Options,
  sastSettings: SastSettings,
  requestId: string,
): Promise<CodeTestResults | null> {
  await spinner.clearAll();
  analysisProgressUpdate();
  const codeAnalysis = await getCodeAnalysis(
    root,
    options,
    sastSettings,
    requestId,
  );
  spinner.clearAll();

  if (!codeAnalysis) {
    return null;
  }

  return {
    reportResults: codeAnalysis.reportResults,
    analysisResults: codeAnalysis.analysisResults,
  };
}

async function getCodeAnalysis(
  root: string,
  options: Options,
  sastSettings: SastSettings,
  requestId: string,
): Promise<CodeAnalysisResults | null> {
  const isLocalCodeEngineEnabled = isLocalCodeEngine(sastSettings);
  if (isLocalCodeEngineEnabled) {
    validateLocalCodeEngineUrl(sastSettings.localCodeEngine.url);
  }

  const source = 'snyk-cli';
  const baseURL = isLocalCodeEngineEnabled
    ? sastSettings.localCodeEngine.url
    : getCodeClientProxyUrl();

  const org = sastSettings.org;

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

  const sessionToken = getAuthHeader();

  const severity = options.severityThreshold
    ? severityToAnalysisSeverity(options.severityThreshold)
    : AnalysisSeverity.info;

  const connectionOptions = {
    baseURL,
    sessionToken,
    source,
    requestId,
    org,
  };

  const analysisOptions = { severity };

  const analysisContext = {
    initiator: 'CLI',
    flow: source,
    projectName: config.PROJECT_NAME,
    project: {
      name: options['project-name'] || config.PROJECT_NAME || 'unknown',
      publicId: options['project-id'] || 'unknown',
      type: 'sast',
    },
    org: {
      name: sastSettings.org || 'unknown',
      displayName: 'unknown',
      publicId: 'unknown',
      flags: {},
    },
  } as const;

  let result: FileAnalysis | ScmAnalysis | null = null;

  // When the "report" arg is provided the test results are published on the platform.
  const isReportFlow = options.report ?? false;
  // We differentiate between file-based reporting flows
  // and SCM-based ones by looking at the "project-id" arg.
  const isScmReportFlow = isReportFlow && options['project-id'];

  if (isScmReportFlow) {
    // Run an SCM analysis test with reporting.
    result = await analyzeScmProject({
      connection: connectionOptions,
      analysisOptions,
      reportOptions: {
        projectId: options['project-id'],
        commitId: options['commit-id'],
      },
    });
  } else {
    // Run a file-based test, optionally with reporting.
    result = await analyzeFolders({
      connection: connectionOptions,
      analysisOptions,
      fileOptions: { paths: [root] },
      ...(isReportFlow && {
        reportOptions: {
          enabled: true,
          projectName: options['project-name'],
          targetName: options['target-name'],
          targetRef: options['target-reference'],
          remoteRepoUrl: options['remote-repo-url'],
        },
      }),
      analysisContext,
      languages: sastSettings.supportedLanguages,
    });

    if (result?.fileBundle.skippedOversizedFiles?.length) {
      debug(
        '\n',
        chalk.yellow(
          `Warning!\nFiles were skipped in the analysis due to their size being greater than ${MAX_FILE_SIZE}B. Skipped files: ${[
            ...result.fileBundle.skippedOversizedFiles,
          ].join(', ')}`,
        ),
      );
    }
  }

  if (!result || result.analysisResults.type !== 'sarif') {
    return null;
  }

  result.analysisResults.sarif = parseSecurityResults(
    result.analysisResults.sarif,
  );

  return result as CodeAnalysisResults;
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
    const securityRule = securityRules.find((sr) => sr === result?.ruleId);
    if (securityRule) {
      result.ruleIndex = securityRules.indexOf(securityRule);
      acc.push(result);
    }
    return acc;
  }, []);

  return securityResults;
}

function isLocalCodeEngine(sastSettings: SastSettings): boolean {
  const { sastEnabled, localCodeEngine } = sastSettings;

  return sastEnabled && localCodeEngine.enabled;
}

function validateLocalCodeEngineUrl(localCodeEngineUrl: string): void {
  if (localCodeEngineUrl.length === 0) {
    throw new MissingConfigurationError(
      'Snyk Code Local Engine. Refer to our docs on https://docs.snyk.io/products/snyk-code/deployment-options/snyk-code-local-engine/cli-and-ide to learn more',
    );
  }
}
