import { IacProjectType, IacProjectTypes } from '../../../../lib/iac/constants';
import { SEVERITY } from '../../../../lib/snyk-test/common';
import {
  AnnotatedIssue,
  IgnoreSettings,
  TestResult,
} from '../../../../lib/snyk-test/legacy';
import {
  IacFileInDirectory,
  Options,
  TestOptions,
  PolicyOptions,
} from '../../../../lib/types';

export interface IacFileData extends IacFileInDirectory {
  fileContent: string;
}

export enum ValidFileType {
  Terraform = 'tf',
  JSON = 'json',
  YAML = 'yaml',
  YML = 'yml',
  TFVARS = 'tfvars',
}
export const VALID_FILE_TYPES = Object.values(ValidFileType);

export interface IacFileParsed extends IacFileData {
  jsonContent: Record<string, unknown> | TerraformScanInput;
  projectType: IacProjectType;
  engineType: EngineType;
  docId?: number;
}

export interface IacFileParseFailure extends IacFileData {
  jsonContent: null;
  engineType: null;
  failureReason: string;
  err: Error;
}

export type ScanningResults = {
  scannedFiles: Array<IacFileScanResult>;
  unscannedFiles: Array<IacFileParseFailure>;
};

export type ParsingResults = {
  parsedFiles: Array<IacFileParsed>;
  failedFiles: Array<IacFileParseFailure>;
};

export interface IacFileScanResult extends IacFileParsed {
  violatedPolicies: PolicyMetadata[];
}

// This type is the integration point with the CLI test command, please note it is still partial in the experimental version
export type FormattedResult = {
  result: {
    cloudConfigResults: Array<PolicyMetadata>;
    projectType: IacProjectTypes;
  };
  meta: TestMeta;
  filesystemPolicy: boolean;
  vulnerabilities: AnnotatedIssue[];
  dependencyCount: number;
  licensesPolicy: object | null;
  ignoreSettings: IgnoreSettings | null;
  targetFile: string;
  projectName: string;
  org: string;
  policy: string;
  isPrivate: boolean;
  targetFilePath: string;
  packageManager: IacProjectType;
};

export type IacCustomPolicies = Record<string, { severity?: string }>;

export enum RulesOrigin {
  Local = 'local',
  Remote = 'remote',
  Internal = 'internal',
}

export interface IacCustomRules {
  isEnabled?: boolean;
  ociRegistryURL?: string;
  ociRegistryTag?: string;
}

export interface IacEntitlements {
  infrastructureAsCode?: boolean;
  iacDrift?: boolean;
  iacCustomRulesEntitlement?: boolean;
}

export interface IacOrgSettings {
  meta: TestMeta;
  customPolicies: IacCustomPolicies;
  customRules?: IacCustomRules;
  entitlements?: IacEntitlements;
}

export interface TestMeta {
  isPrivate: boolean;
  isLicensesEnabled: boolean;
  org: string;
  ignoreSettings?: IgnoreSettings | null;
  projectId?: string;
  policy?: string;
}

export interface OpaWasmInstance {
  evaluate: (data: Record<string, any>) => { results: PolicyMetadata[] };
  setData: (data: Record<string, any>) => void;
}

export type SafeAnalyticsOutput = Omit<
  IacFileParsed | IacFileParseFailure,
  'fileContent' | 'jsonContent' | 'engineType'
>;

export enum EngineType {
  Kubernetes,
  Terraform,
  CloudFormation,
  ARM,
  Custom,
}

export interface PolicyMetadata {
  // New policies don't include the "id" field
  id?: string;
  publicId: string;
  // New policies don't include the "type" field
  type?: string;
  subType: string;
  title: string;
  documentation?: string; // e.g. "https://snyk.io/security-rules/SNYK-CC-K8S-2",
  isGeneratedByCustomRule?: boolean;
  // Legacy field, still included in WASM eval output, but not in use. (not included in new policies)
  description?: string;
  severity: SEVERITY | 'none'; // the 'null' value can be provided by the backend
  msg: string;
  issue: string;
  impact: string;
  resolve: string;
  references: string[];
  // Included only in new policies
  remediation?: Partial<
    Record<'terraform' | 'cloudformation' | 'arm' | 'kubernetes', string>
  >;
}

// Collection of all options supported by `iac test` command.
// TODO: Needs to be fixed at the args module level.
export type IaCTestFlags = Pick<
  Options & TestOptions & PolicyOptions,
  | 'org'
  | 'insecure'
  | 'debug'
  | 'experimental'
  | 'detectionDepth'
  | 'severityThreshold'
  | 'json'
  | 'sarif'

  // PolicyOptions
  | 'ignore-policy'
  | 'policy-path'
> & {
  // Supported flags not yet covered by Options or TestOptions
  'json-file-output'?: string;
  'sarif-file-output'?: string;
  v?: boolean;
  version?: boolean;
  h?: boolean;
  help?: 'help';
  q?: boolean;
  quiet?: boolean;
  path?: string;
  // This flag is internal and is used merely to route the smoke tests of the old flow.
  // it should be removed together when the GA version completely deprecates the legacy remote processing flow.
  legacy?: boolean;
  // Allows the caller to provide the path to a WASM bundle.
  rules?: string;
} & TerraformPlanFlags;

// Flags specific for Terraform plan scanning
interface TerraformPlanFlags {
  scan?: TerraformPlanScanMode;
}

export enum TerraformPlanScanMode {
  DeltaScan = 'resource-changes', // default value
  FullScan = 'planned-values',
}

// Includes all IaCTestOptions plus additional properties
// that are added at runtime and not part of the parsed
// CLI flags.
export type IaCTestOptions = IaCTestFlags & {
  /** @deprecated Only used by the legacy `iac test` flow remove once local exec path is GA */
  iacDirFiles?: Array<IacFileInDirectory>;
};

export interface TerraformPlanResource {
  address: string; // "aws_cloudwatch_log_group.terra_ci",
  mode: string; // "managed",
  type: string; // "aws_cloudwatch_log_group",
  name: string; // "terra_ci",
  values: Record<string, unknown>; // the values in the resource
  index: number | string; // can be either a number or a string (1, "rtb-asdasd", "10.10.10.10")
}

export interface TerraformPlanResourceChange
  extends Omit<TerraformPlanResource, 'values'> {
  change: {
    actions: ResourceActions;
    before: Record<string, unknown> | null; // will be null when the action is `create`
    after: Record<string, unknown> | null; // will be null when then action is `delete`
  };
}

export interface TerraformPlanJson {
  // there are more values, but these are the required ones for us to scan
  resource_changes: Array<TerraformPlanResourceChange>;
}
export interface TerraformScanInput {
  // within the resource field, resources are stored: [type] => [name] => [values]
  resource: Record<string, Record<string, unknown>>;
  data: Record<string, Record<string, unknown>>;
}

// taken from: https://www.terraform.io/docs/internals/json-format.html#change-representation
export type ResourceActions =
  | ['no-op']
  | ['create']
  | ['read']
  | ['update']
  | ['delete', 'create'] // resources you cannot update in place
  | ['create', 'delete'] // for zero-downtime upgrades
  | ['delete'];

// we will be scanning the `create` & `update` actions only.
export const VALID_RESOURCE_ACTIONS_FOR_DELTA_SCAN: ResourceActions[] = [
  ['create'],
  ['update'],
  ['create', 'delete'],
  ['delete', 'create'],
];

// scans all actions including 'no-op' in order to iterate on all resources.
export const VALID_RESOURCE_ACTIONS_FOR_FULL_SCAN: ResourceActions[] = [
  ['no-op'],
  ...VALID_RESOURCE_ACTIONS_FOR_DELTA_SCAN,
];

// Error codes used for Analytics & Debugging
// Error names get converted to error string codes
// Within a single module, increments are in 1.
// Between modules, increments are in 10, according to the order of execution.
export enum IaCErrorCodes {
  // local-cache errors
  FailedToInitLocalCacheError = 1000,
  FailedToCleanLocalCacheError = 1001,
  FailedToDownloadRulesError = 1002,
  FailedToExtractCustomRulesError = 1003,
  InvalidCustomRules = 1004,
  InvalidCustomRulesPath = 1005,

  // file-loader errors
  NoFilesToScanError = 1010,
  FailedToLoadFileError = 1011,

  // file-parser errors
  UnsupportedFileTypeError = 1020,
  InvalidJsonFileError = 1021,
  InvalidYamlFileError = 1022,
  FailedToDetectJsonConfigError = 1023,
  FailedToDetectYamlConfigError = 1024,

  // kubernetes-parser errors
  MissingRequiredFieldsInKubernetesYamlError = 1031,
  FailedToParseHelmError = 1032,

  // terraform-file-parser errors
  FailedToParseTerraformFileError = 1040,

  // terraform-plan-parser errors
  FailedToExtractResourcesInTerraformPlanError = 1052,

  // file-scanner errors
  FailedToBuildPolicyEngine = 1060,
  FailedToExecutePolicyEngine = 1061,

  // results-formatter errors
  FailedToFormatResults = 1070,
  FailedToExtractLineNumberError = 1071,

  // get-iac-org-settings errors
  FailedToGetIacOrgSettingsError = 1080,

  // assert-iac-options-flag
  FlagError = 1090,
  FlagValueError = 1091,
  UnsupportedEntitlementFlagError = 1092,

  // oci-pull errors
  FailedToExecuteCustomRulesError = 1100,
  FailedToPullCustomBundleError = 1101,
  FailedToBuildOCIArtifactError = 1102,
  InvalidRemoteRegistryURLError = 1103,
  InvalidManifestSchemaVersionError = 1104,
  UnsupportedFeatureFlagPullError = 1105,
  UnsupportedEntitlementPullError = 1106,
}

export interface TestReturnValue {
  results: TestResult | TestResult[];
  failures?: IacFileInDirectory[];
}

// https://github.com/opencontainers/image-spec/blob/main/manifest.md#image-manifest
export interface ImageManifest {
  schemaVersion: number;
  mediaType: string;
  config: ManifestConfig;
  layers: ManifestConfig[];
}

export interface ManifestConfig {
  mediaType: string;
  size: number;
  digest: string; // unique content identifier
}

export interface Layer {
  config: ManifestConfig;
  blob: Buffer;
}

export interface OCIPullOptions {
  username?: string;
  password?: string;
  // weak typing on the client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reqOptions?: { accept?: string; indexContentType?: string };
  imageSavePath?: string;
}

export interface OCIRegistryURLComponents {
  registryBase: string;
  repo: string;
  tag: string;
}

export const manifestContentType = 'application/vnd.oci.image.manifest.v1+json';
export const layerContentType = 'application/vnd.oci.image.layer.v1.tar+gzip';

export enum PerformanceAnalyticsKey {
  InitLocalCache = 'cache-init-ms',
  FileLoading = 'file-loading-ms',
  FileParsing = 'file-parsing-ms',
  FileScanning = 'file-scanning-ms',
  OrgSettings = 'org-settings-ms',
  CustomSeverities = 'custom-severities-ms',
  ResultFormatting = 'results-formatting-ms',
  UsageTracking = 'usage-tracking-ms',
  CacheCleanup = 'cache-cleanup-ms',
  Total = 'total-iac-ms',
}
