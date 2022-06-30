import { SEVERITY } from '../../../../snyk-test/common';
import * as PolicyEngineTypes from './policy-engine';

export interface SnykIacTestOutput {
  results?: Results;
  rawResults?: PolicyEngineTypes.Results;
  errors?: ScanError[];
}

export interface Results {
  resources?: Resource[];
  vulnerabilities?: Vulnerability[];
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
}

export interface Resource {
  id: string;
  type: string;
  path?: any[];
  file?: string;
  kind: string;
  line?: number;
  column?: number;
}

export interface ScanError {
  message: string;
  code: number;
  fields?: Record<string, string>;
}
