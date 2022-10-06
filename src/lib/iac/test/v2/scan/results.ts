import { SEVERITY } from '../../../../snyk-test/common';
import { IacProjectType } from '../../../constants';
import { SnykIacTestError } from '../errors';
import * as PolicyEngineTypes from './policy-engine';

export function mapSnykIacTestOutputToTestOutput(
  snykIacOutput: SnykIacTestOutput,
): TestOutput {
  const errors = snykIacOutput.errors?.map((err) => new SnykIacTestError(err));

  const errWithoutPath = errors?.find((err) => !err.fields?.path);
  if (errWithoutPath) {
    throw errWithoutPath;
  }

  return {
    results: snykIacOutput.results,
    errors,
  };
}

export interface TestOutput {
  results?: Results;
  errors?: SnykIacTestError[];
}

export interface SnykIacTestOutput {
  results?: Results;
  rawResults?: PolicyEngineTypes.Results;
  errors?: ScanError[];
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
  documentation: string; // TODO: revisit this field when adding support for custom rules
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
