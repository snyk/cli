export type DriftctlExecutionResult = {
  code: number;
  stdout: string;
};

interface DriftCTLOptions {
  kind: string;
}

export interface FmtOptions extends DriftCTLOptions {
  json: boolean;
  html: boolean;
  'html-file-output': string;
}

export interface GenDriftIgnoreOptions {
  'exclude-missing'?: boolean;
  'exclude-unmanaged'?: boolean;
}

export interface DescribeOptions extends DriftCTLOptions {
  quiet?: boolean;
  filter?: string;
  to?: string;
  'fetch-tfstate-headers'?: string;
  'tfc-token'?: string;
  'tfc-endpoint'?: string;
  'tf-provider-version'?: string;
  strict?: true;
  driftignore?: string;
  'tf-lockfile'?: string;
  'config-dir'?: string;
  json?: boolean;
  html?: boolean;
  'html-file-output'?: string;
  service?: string;
  from?: string; // snyk cli args parsing does not support variadic args so this will be coma separated values
  ignore?: string[];
}

export type DriftResource = {
  id: string;
  type: string;
  human_readable_attributes?: DriftResourceAttributes;
  source?: DriftSource;
};

export type DriftSource = {
  source: string;
  namespace: string;
  internal_name: string;
};

export type DriftResourceAttributes = Map<string, unknown>;

export type DriftAnalysisSummary = {
  total_resources: number;
  total_unmanaged: number;
  total_missing: number;
  total_managed: number;
  total_iac_source_count: number;
};

export type DriftAlert = {
  message: string;
};

export type DriftAlerts = {
  [key: string]: DriftAlert[];
};

export type DriftAnalysis = {
  summary: DriftAnalysisSummary;
  managed?: DriftResource[];
  unmanaged?: DriftResource[];
  missing?: DriftResource[];
  alerts?: DriftAlerts;
  coverage: number;
  scan_duration: number;
  provider_name: string;
  provider_version: string;
};

interface AnalysisByType {
  count: number;
}

export interface MissingByType extends AnalysisByType {
  missingByType: Map<string, DriftResource[]>;
}

export interface UnmanagedByType extends AnalysisByType {
  unmanagedByType: Map<string, DriftResource[]>;
}
