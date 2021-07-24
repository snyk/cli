const values = require('lodash.values');
import * as depGraphLib from '@snyk/dep-graph';
import { SupportedPackageManagers } from '../package-managers';
import { SupportedProjectTypes } from '../types';
import { SEVERITIES } from './common';

interface Pkg {
  name: string;
  version?: string;
}

interface Patch {
  version: string;
  id: string;
  urls: string[];
  modificationTime: string;
}

export enum SEVERITY {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum REACHABILITY {
  FUNCTION = 'function',
  PACKAGE = 'package',
  NOT_REACHABLE = 'not-reachable',
  NO_INFO = 'no-info',
}

export interface VulnMetaData {
  id: string;
  title: string;
  description: string;
  type: 'license' | 'vuln';
  name: string;
  info: string;
  severity: SEVERITY;
  severityValue: number;
  isNew: boolean;
  version: string;
  packageManager: SupportedPackageManagers | 'upstream';
}

export interface GroupedVuln {
  list: AnnotatedIssue[];
  metadata: VulnMetaData;
  isIgnored: boolean;
  title: string;
  note: string | false;
  severity: SEVERITY;
  originalSeverity?: SEVERITY;
  isNew: boolean;
  name: string;
  version: string;
  isFixable: boolean;
  fixedIn: string[];
  legalInstructionsArray?: LegalInstruction[];
  reachability?: REACHABILITY;
}

export interface LegalInstruction {
  licenseName: string;
  legalContent: string;
}
export interface IssueData {
  id: string;
  packageName: string;
  version: string;
  moduleName?: string;
  below: string; // Vulnerable below version
  semver: {
    vulnerable: string | string[];
    vulnerableHashes?: string[];
    vulnerableByDistro?: {
      [distroNameAndVersion: string]: string[];
    };
  };
  patches: Patch[];
  isNew: boolean;
  description: string;
  title: string;
  severity: SEVERITY;
  fixedIn: string[];
  legalInstructions?: string;
  reachability?: REACHABILITY;
  packageManager?: SupportedProjectTypes;
}

export type CallPath = string[];

interface ReachableFunctionPaths {
  functionName: string;
  callPaths: CallPath[];
}

interface ReachablePaths {
  pathCount: number;
  paths: ReachableFunctionPaths[];
}

interface AnnotatedIssue extends IssueData {
  credit: string[];
  name: string;
  version: string;
  from: string[];
  upgradePath: Array<string | boolean>;
  isUpgradable: boolean;
  isPatchable: boolean;
  severity: SEVERITY;
  originalSeverity?: SEVERITY;

  // These fields present for "node_module" based scans to allow remediation
  bundled?: any;
  shrinkwrap?: any;
  __filename?: string;
  parentDepType: string;

  type?: 'license';
  title: string;
  patch?: any;
  note?: string | false;
  publicationTime?: string;

  reachablePaths?: ReachablePaths;
  identifiers?: {
    [name: string]: string[];
  };
}

// Mixin, to be added to GroupedVuln / AnnotatedIssue
export interface DockerIssue {
  nearestFixedInVersion?: string;
  dockerfileInstruction?: any;
  dockerBaseImage?: any;
}

export interface IgnoreSettings {
  adminOnly: boolean;
  reasonRequired: boolean;
  disregardFilesystemIgnores: boolean;
}

export interface BasicResultData {
  ok: boolean;
  payloadType?: string;
  org: string;
  isPrivate: boolean;
  summary: string;
  packageManager?: SupportedProjectTypes;
  severityThreshold?: string;
  platform?: string;
}

export interface LegacyVulnApiResult extends BasicResultData {
  vulnerabilities: AnnotatedIssue[];
  dependencyCount: number;
  policy: string;
  licensesPolicy: object | null;
  ignoreSettings: IgnoreSettings | null;
  docker?: {
    baseImage?: any;
    binariesVulns?: unknown;
    baseImageRemediation?: BaseImageRemediation;
  };
  projectId?: string;
  filesystemPolicy?: boolean;
  uniqueCount?: any;
  remediation?: RemediationChanges;
}

interface BaseImageRemediation {
  code: string;
  advice: BaseImageRemediationAdvice[];
  message?: string; // TODO: check if this is still being sent
}

export interface BaseImageRemediationAdvice {
  message: string;
  bold?: boolean;
  color?: string;
}

export interface TestResult extends LegacyVulnApiResult {
  targetFile?: string;
  projectName?: string;
  targetFilePath?: string;
  displayTargetFile?: string; // used for display only
  foundProjectCount?: number;
}

interface UpgradePathItem {
  name: string;
  version: string;
  newVersion?: string;
  isDropped?: boolean;
}

interface UpgradePath {
  path: UpgradePathItem[];
}

interface FixInfo {
  upgradePaths: UpgradePath[];
  isPatchable: boolean;
  nearestFixedInVersion?: string;
}

export interface AffectedPackages {
  [pkgId: string]: {
    pkg: Pkg;
    issues: {
      [issueId: string]: Issue;
    };
  };
}

interface TestDepGraphResult {
  issuesData: {
    [issueId: string]: IssueData;
  };
  affectedPkgs: AffectedPackages;
  docker: {
    binariesVulns?: TestDepGraphResult;
    baseImage?: any;
  };
  remediation?: RemediationChanges;
}

interface Issue {
  pkgName: string;
  pkgVersion?: string;
  issueId: string;
  fixInfo: FixInfo;
}

interface TestDependenciesResult {
  issuesData: {
    [issueId: string]: IssueData;
  };
  issues: Issue[];
  docker?: {
    baseImage: string;
    baseImageRemediation: BaseImageRemediation;
    binariesVulns: TestDepGraphResult;
  };
  remediation?: RemediationChanges;
  depGraphData: depGraphLib.DepGraphData;
}

export interface TestDepGraphMeta {
  isPublic: boolean;
  isLicensesEnabled: boolean;
  licensesPolicy?: {
    severities: {
      [type: string]: string;
    };
  };
  projectId?: string;
  ignoreSettings?: IgnoreSettings;
  policy: string;
  org: string;
}

export interface TestDepGraphResponse {
  result: TestDepGraphResult;
  meta: TestDepGraphMeta;
}

export interface TestDependenciesResponse {
  result: TestDependenciesResult;
  meta: TestDepGraphMeta;
}

interface Ignores {
  [path: string]: {
    paths: string[][];
    meta: {
      days?: number;
      reason?: string;
    };
  };
}

interface PatchObject {
  [name: string]: {
    patched: string;
  };
}

interface Upgrade {
  upgradeTo: string; // name@version
}

interface UpgradeVulns extends Upgrade {
  vulns: string[];
}

export interface UpgradeRemediation extends UpgradeVulns {
  upgrades: string[];
}

export interface PatchRemediation {
  paths: PatchObject[];
}

export interface DependencyUpdates {
  [from: string]: UpgradeRemediation;
}

export interface PinRemediation extends UpgradeVulns {
  isTransitive: boolean;
}

export interface DependencyPins {
  [name: string]: PinRemediation;
}

// Remediation changes to be applied to the project,
// including information on all and unresolved issues.
export interface RemediationChanges {
  unresolved: IssueData[];
  upgrade: DependencyUpdates;
  patch: {
    [name: string]: PatchRemediation;
  };
  ignore: unknown;
  pin: DependencyPins;
}

function convertTestDepGraphResultToLegacy(
  res: TestDepGraphResponse,
  depGraph: depGraphLib.DepGraph,
  packageManager: SupportedProjectTypes | undefined,
  severityThreshold?: SEVERITY,
): LegacyVulnApiResult {
  const result = res.result;

  const upgradePathsMap = new Map<string, string[]>();

  for (const pkgInfo of values(result.affectedPkgs)) {
    for (const pkgIssue of values(pkgInfo.issues)) {
      if (pkgIssue.fixInfo && pkgIssue.fixInfo.upgradePaths) {
        for (const upgradePath of pkgIssue.fixInfo.upgradePaths) {
          const legacyFromPath = pkgPathToLegacyPath(upgradePath.path);
          const vulnPathString = getVulnPathString(
            pkgIssue.issueId,
            legacyFromPath,
          );
          upgradePathsMap[vulnPathString] = toLegacyUpgradePath(
            upgradePath.path,
          );
        }
      }
    }
  }

  // generate the legacy vulns array (vuln-data + metada per vulnerable path).
  //   use the upgradePathsMap to find available upgrade-paths
  const vulns: AnnotatedIssue[] = [];

  for (const pkgInfo of values(result.affectedPkgs)) {
    for (const vulnPkgPath of depGraph.pkgPathsToRoot(pkgInfo.pkg)) {
      const legacyFromPath = pkgPathToLegacyPath(vulnPkgPath.reverse());
      for (const pkgIssue of values(pkgInfo.issues)) {
        const vulnPathString = getVulnPathString(
          pkgIssue.issueId,
          legacyFromPath,
        );
        const upgradePath = upgradePathsMap[vulnPathString] || [];

        // TODO: we need the full issue-data for every path only for the --json output,
        //   consider picking only the required fields,
        //   and append the full data only for --json, to minimize chance of out-of-memory
        const annotatedIssue = Object.assign(
          {},
          result.issuesData[pkgIssue.issueId],
          {
            from: legacyFromPath,
            upgradePath,
            isUpgradable: !!upgradePath[0] || !!upgradePath[1],
            isPatchable: pkgIssue.fixInfo.isPatchable,
            name: pkgInfo.pkg.name,
            version: pkgInfo.pkg.version as string,
            nearestFixedInVersion: pkgIssue.fixInfo.nearestFixedInVersion,
          },
        ) as AnnotatedIssue & DockerIssue; // TODO(kyegupov): get rid of type assertion

        vulns.push(annotatedIssue);
      }
    }
  }

  const dockerRes = result.docker;

  if (dockerRes && dockerRes.binariesVulns) {
    const binariesVulns = dockerRes.binariesVulns;
    for (const pkgInfo of values(binariesVulns.affectedPkgs)) {
      for (const pkgIssue of values(pkgInfo.issues)) {
        const pkgAndVersion = (pkgInfo.pkg.name +
          '@' +
          pkgInfo.pkg.version) as string;
        const annotatedIssue = (Object.assign(
          {},
          binariesVulns.issuesData[pkgIssue.issueId],
          {
            from: ['Upstream', pkgAndVersion],
            upgradePath: [],
            isUpgradable: false,
            isPatchable: false,
            name: pkgInfo.pkg.name,
            version: pkgInfo.pkg.version as string,
            nearestFixedInVersion: pkgIssue.fixInfo.nearestFixedInVersion,
          },
        ) as any) as AnnotatedIssue; // TODO(kyegupov): get rid of forced type assertion
        vulns.push(annotatedIssue);
      }
    }
  }

  const meta = res.meta || {};

  severityThreshold =
    severityThreshold === SEVERITY.LOW ? undefined : severityThreshold;

  const legacyRes: LegacyVulnApiResult = {
    vulnerabilities: vulns,
    ok: vulns.length === 0,
    dependencyCount: depGraph.getPkgs().length - 1,
    org: meta.org,
    policy: meta.policy,
    isPrivate: !meta.isPublic,
    licensesPolicy: meta.licensesPolicy || null,
    packageManager,
    projectId: meta.projectId,
    ignoreSettings: meta.ignoreSettings || null,
    docker: result.docker,
    summary: getSummary(vulns, severityThreshold),
    severityThreshold,
    remediation: result.remediation,
  };

  return legacyRes;
}

function getVulnPathString(issueId: string, vulnPath: string[]) {
  return issueId + '|' + JSON.stringify(vulnPath);
}

function pkgPathToLegacyPath(pkgPath: Pkg[]): string[] {
  return pkgPath.map(toLegacyPkgId);
}

function toLegacyUpgradePath(
  upgradePath: UpgradePathItem[],
): Array<string | boolean> {
  return upgradePath
    .filter((item) => !item.isDropped)
    .map((item) => {
      if (!item.newVersion) {
        return false;
      }

      return `${item.name}@${item.newVersion}`;
    });
}

function toLegacyPkgId(pkg: Pkg) {
  return `${pkg.name}@${pkg.version || '*'}`;
}

function getSummary(vulns: object[], severityThreshold?: SEVERITY): string {
  const count = vulns.length;
  let countText = '' + count;
  const severityFilters: string[] = [];
  const severitiesArray = SEVERITIES.map((s) => s.verboseName);
  if (severityThreshold) {
    severitiesArray
      .slice(severitiesArray.indexOf(severityThreshold))
      .forEach((sev) => {
        severityFilters.push(sev);
      });
  }

  if (!count) {
    if (severityFilters.length) {
      return `No ${severityFilters.join(' or ')} severity vulnerabilities`;
    }
    return 'No known vulnerabilities';
  }

  if (severityFilters.length) {
    countText += ' ' + severityFilters.join(' or ') + ' severity';
  }

  return `${countText} vulnerable dependency ${pl('path', count)}`;
}

function pl(word, count) {
  const ext = {
    y: 'ies',
    default: 's',
  };

  const last = word.split('').pop();

  if (count > 1) {
    return word.slice(0, -1) + (ext[last] || last + ext.default);
  }

  return word;
}

export { convertTestDepGraphResultToLegacy, AnnotatedIssue };
