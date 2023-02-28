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

  const errWithoutPath = errors?.find((err) => !err.fields?.path);

  if (errWithoutPath) {
    throw errWithoutPath;
  }

  return {
    results: snykIacOutput.results,
    settings: snykIacOutput.settings,
    errors,
  };
}

export interface TestOutput {
  results?: Results;
  errors?: SnykIacTestError[];
  settings: Settings;
}

export interface SnykIacTestOutput {
  results?: Results;
  rawResults?: PolicyEngineTypes.Results;
  errors?: ScanError[];
  settings: Settings;
}

export interface Results {
  resources?: Resource[];
  vulnerabilities?: Vulnerability[];
  metadata: Metadata;
  scanAnalytics: ScanAnalytics;
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
  ignoredCount: number;
}

export interface Vulnerability {
  rule: Rule;
  message: string;
  remediation: string;
  severity: SEVERITY;
  ignored: boolean;
  resource: Resource;
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
  path?: any[];
  formattedPath: string;
  file: string;
  kind: ResourceKind;
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
