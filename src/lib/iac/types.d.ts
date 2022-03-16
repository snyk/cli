export type DriftctlExecutionResult = {
  code: number;
  stdout: string;
};

interface DriftCTLOptions {
  kind: string;
}

export interface FmtOptions extends DriftCTLOptions {
  json: boolean;
  'json-file-output': string;
  html: boolean;
  'html-file-output': string;
}

export interface GenDriftIgnoreOptions extends DriftCTLOptions {
  input?: string;
  output?: string;
  'exclude-changed'?: boolean;
  'exclude-missing'?: boolean;
  'exclude-unmanaged'?: boolean;
}

export interface DescribeOptions extends DriftCTLOptions {
  quiet?: true;
  filter?: string;
  to?: string;
  'fetch-tfstate-headers'?: string;
  'tfc-token'?: string;
  'tfc-endpoint'?: string;
  'tf-provider-version'?: string;
  strict?: true;
  deep?: true;
  'only-managed'?: true;
  'only-unmanaged'?: true;
  driftignore?: string;
  'tf-lockfile'?: string;
  'config-dir'?: string;
  json?: boolean;
  'json-file-output'?: string;
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
  total_changed: number;
  total_unmanaged: number;
  total_missing: number;
  total_managed: number;
  total_iac_source_count: number;
};

export type DriftAnalysisDifference = {
  res: DriftResource;
  changelog: DriftChange[];
};

export type DriftChange = {
  type: string;
  path: string[];
  from: unknown;
  to: unknown;
  computed: boolean;
  json_string?: boolean;
};

export type DriftAlert = {
  message: string;
};

export type DriftAlerts = {
  [key: string]: DriftAlert[];
};

export type DriftAnalysisOptions = {
  deep: boolean;
  only_managed: boolean;
  only_unmanaged: boolean;
};

export type DriftAnalysis = {
  options: DriftAnalysisOptions;
  summary: DriftAnalysisSummary;
  managed?: DriftResource[];
  unmanaged?: DriftResource[];
  missing?: DriftResource[];
  differences?: DriftAnalysisDifference[];
  alerts?: DriftAlerts;
  coverage: number;
  scan_duration: number;
  provider_name: string;
  provider_version: string;
};
