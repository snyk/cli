import { SEVERITY } from '../../../../../lib/snyk-test/common';
import * as PolicyEngineTypes from './policy-engine-types';

export interface SnykIacTestOutput {
  results?: Results;
  rawResults?: PolicyEngineTypes.Results;
  errors?: scanError[];
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

interface Rule {
  id: string;
  title: string;
  description: string;
}

interface Resource {
  id: string;
  type: string;
  path?: any[];
  file?: string;
  kind: string;
  line?: number;
  column?: number;
}

interface scanError {
  message: string;
  code: number;
  fields?: { [key: string]: string };
}
