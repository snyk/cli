import { SEVERITY } from '../../../../snyk-test/common';
import { IacProjectType } from '../../../constants';
import { SnykIacTestError } from '../errors';
import * as PolicyEngineTypes from './policy-engine';
import { IaCErrorCodes } from '../../../../../cli/commands/test/iac/local-execution/types';
import { UnsupportedEntitlementError } from '../../../../errors/unsupported-entitlement-error';
import { FailedToGetIacOrgSettingsError } from '../../../../../cli/commands/test/iac/local-execution/org-settings/get-iac-org-settings';

export function mapSnykIacTestOutputToTestOutput(
  snykIacOutput: SnykIacTestOutput,
): TestOutput {
  const entitlementError = snykIacOutput.errors?.find(
    (err) => err.code === IaCErrorCodes.EntitlementNotEnabled,
  );

  if (entitlementError) {
    throw new UnsupportedEntitlementError(
      entitlementError?.fields?.entitlement || '',
    );
  }

  const readSettingsError = snykIacOutput.errors?.find(
    (err) => err.code === IaCErrorCodes.ReadSettings,
  );

  if (readSettingsError) {
    throw new FailedToGetIacOrgSettingsError();
  }

  const errors = snykIacOutput.errors?.map((err) => new SnykIacTestError(err));
  const warnings = snykIacOutput.warnings?.map(
    (err) => new SnykIacTestError(err),
  );

  const errWithoutPath = errors?.find((err) => !err.fields?.path);

  if (errWithoutPath) {
    throw errWithoutPath;
  }

  return {
    results: enhanceResultsWithPassedVulerabilities(
      snykIacOutput.results,
      snykIacOutput.rawResults,
    ),
    settings: snykIacOutput.settings,
    errors,
    warnings,
  };
}

export function enhanceResultsWithPassedVulerabilities(
  results: SnykIacTestResults | undefined,
  rawResults?: PolicyEngineTypes.Results,
): Results | undefined {
  if (!results) {
    return undefined;
  }

  return {
    ...results,
    passedVulnerabilities: buildPassedVulnerabilitiesFromRawResults(rawResults),
  };
}

function buildPassedVulnerabilitiesFromRawResults(
  rawResults?: PolicyEngineTypes.Results,
): PassedVulnerability[] {
  if (!rawResults) {
    return [];
  }

  const passedVulnerabilities: PassedVulnerability[] = [];

  for (const resourceResult of rawResults.results) {
    resourceResult.rule_results
      .filter((ruleResults) => ruleResults.results.length)
      .forEach((ruleResults) => {
        ruleResults.results
          .filter((ruleResult) => ruleResult.passed)
          .forEach((ruleResult) => {
            const filePath = resolveResourcePath(ruleResult, resourceResult);
            if (filePath) {
              const vulnerability = buildPassedVulnerabilityFromRawResult(
                resourceResult,
                ruleResults,
                ruleResult,
                filePath,
              );
              passedVulnerabilities.push(vulnerability);
            }
          });
      });
  }
  return passedVulnerabilities;
}
function buildPassedVulnerabilityFromRawResult(
  resourceResult: PolicyEngineTypes.Result,
  ruleResult: PolicyEngineTypes.RuleResults,
  result: PolicyEngineTypes.RuleResult,
  filePath: string,
): PassedVulnerability {
  const vulnerability: PassedVulnerability = {
    rule: {
      id: ruleResult.id,
      title: ruleResult.title,
      description: ruleResult.description,
      category: ruleResult.category,
    },
    resource: {
      id: result.resource_id,
      type: result.resource_type,
      file: filePath,
    },
    ignored: result.ignored,
  };

  if (result.severity) {
    vulnerability.severity = severityMap[result.severity];
  }

  return vulnerability;
}

function resolveResourcePath(
  ruleResult: PolicyEngineTypes.RuleResult,
  resourceResult: PolicyEngineTypes.Result,
): string | null {
  if (ruleResult.resource_type && ruleResult.resource_id) {
    return resourceResult.input.resources[ruleResult.resource_type]?.[
      ruleResult.resource_id
    ]?.meta?.location[0]?.filepath;
  }
  return null;
}

const severityMap: Record<
  PolicyEngineTypes.RuleResult.SeverityEnum,
  SEVERITY
> = {
  [PolicyEngineTypes.RuleResult.SeverityEnum.Low]: SEVERITY.LOW,
  [PolicyEngineTypes.RuleResult.SeverityEnum.Medium]: SEVERITY.MEDIUM,
  [PolicyEngineTypes.RuleResult.SeverityEnum.High]: SEVERITY.HIGH,
  [PolicyEngineTypes.RuleResult.SeverityEnum.Critical]: SEVERITY.CRITICAL,
};

export interface TestOutput {
  results?: Results;
  errors?: SnykIacTestError[];
  warnings?: SnykIacTestError[];
  settings: Settings;
}

export interface SnykIacTestOutput {
  results?: SnykIacTestResults;
  rawResults?: PolicyEngineTypes.Results;
  errors?: ScanError[];
  warnings?: ScanError[];
  settings: Settings;
}

export interface SnykIacTestResults {
  // formattedPath is not included in the results
  resources?: Omit<Resource, 'formattedPath'>[];
  vulnerabilities?: Vulnerability[];
  metadata: Metadata;
  scanAnalytics: ScanAnalytics;
}

export interface Results extends SnykIacTestResults {
  passedVulnerabilities: PassedVulnerability[];
}

export interface Metadata {
  projectName: string;
  ignoredCount: number;
}

export interface Settings {
  org: string;
  ignoreSettings: IgnoreSettings;
}

export interface IgnoreSettings {
  adminOnly: boolean;
  disregardFilesystemIgnores: boolean;
  reasonRequired: boolean;
}

export interface ScanAnalytics {
  suppressedResults?: Record<string, string[]>;
  ignoredCount?: number;
}

export interface Vulnerability {
  rule: Rule;
  message: string;
  remediation: string;
  severity: SEVERITY;
  ignored: boolean;
  resource: Resource;
}

export interface PassedVulnerability {
  rule: Partial<Rule>;
  severity?: SEVERITY;
  ignored: boolean;
  resource: Partial<Resource>;
}

export interface Rule {
  id: string;
  title: string;
  description: string;
  references?: string;
  labels?: string[];
  category?: string;
  documentation?: string;
  isGeneratedByCustomRule?: boolean;
}

export interface Resource {
  id: string;
  type: string;
  kind: ResourceKind;
  formattedPath: string;
  path?: any[];
  file?: string;
  line?: number;
  column?: number;
}

export type ResourceKind =
  | IacProjectType
  | PolicyEngineTypes.State.InputTypeEnum;

export interface ScanError {
  message: string;
  code: number;
  fields?: Record<string, string>;
}
