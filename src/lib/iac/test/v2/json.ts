// Some of the types below specify fields constrained to a single value. Those
// fields must be produced in the JSON output, and they must have those values
// to keep backwards compatibility.

import {
  PassedVulnerability,
  Resource,
  TestOutput,
  Vulnerability,
} from './scan/results';
import * as path from 'path';
import { IacProjectType, iacRemediationTypes } from '../../constants';
import { State } from './scan/policy-engine';
import {
  IacTestError,
  mapIacTestError,
} from '../../../snyk-test/iac-test-result';

export interface Result {
  meta: Meta;
  filesystemPolicy: false;
  vulnerabilities: [];
  dependencyCount: 0;
  licensesPolicy: null;
  ignoreSettings: IgnoreSettings;
  targetFile: string;
  projectName: string;
  org: string;
  policy: string;
  isPrivate: boolean;
  targetFilePath: string;
  packageManager: IacProjectType | State.InputTypeEnum;
  path: string;
  projectType: IacProjectType | State.InputTypeEnum;
  ok: boolean;
  infrastructureAsCodeIssues: IacIssue[];
  infrastructureAsCodeSuccesses: IacSuccess[];
  error?: string;
}

export interface IgnoreSettings {
  adminOnly: boolean;
  reasonRequired: boolean;
  disregardFilesystemIgnores: boolean;
}

export interface Meta {
  isPrivate: boolean;
  isLicensesEnabled: boolean;
  ignoreSettings: IgnoreSettings;
  org: string;
  policy: string;
}

export interface IgnoreSettings {
  adminOnly: boolean;
  reasonRequired: boolean;
  disregardFilesystemIgnores: boolean;
}

export interface IacIssue {
  severity: string;
  resolve: string;
  impact: string;
  msg: string;
  remediation?: Remediation;
  subType: string;
  issue: string;
  publicId: string;
  title: string;
  references: string[];
  id: string;
  isIgnored: boolean;
  iacDescription: IacDescription;
  lineNumber: number;
  documentation?: string;
  isGeneratedByCustomRule: boolean;
  path: string[];
  policyEngineType?: string;
  type?: IacProjectType | State.InputTypeEnum;
  compliance?: string[][];
  description: string;
}
export interface IacSuccess {
  id?: string;
  severity?: string;
  title?: string;
  description?: string;
  type?: IacProjectType | State.InputTypeEnum;
  subType?: string;
  isIgnored: boolean;
  documentation?: string;
}

export interface Remediation {
  cloudformation?: string;
  terraform?: string;
  arm?: string;
  kubernetes?: string;
}

export interface IacDescription {
  issue: string;
  impact: string;
  resolve: string;
}

export function convertEngineToJsonResults({
  results,
  projectName,
}: {
  results: TestOutput;
  projectName: string;
}): Array<Result | IacTestError> {
  const vulnerabilityGroups = groupVulnerabilitiesByFile(results); // all vulns groups by file
  const resourceGroups = groupResourcesByFile(results); // all resources grouped by file
  const filesWithoutIssues = findFilesWithoutIssues(
    resourceGroups,
    vulnerabilityGroups,
  ); // all resources without issues grouped by file

  const output: Array<Result | IacTestError> = [];

  if (results.errors) {
    output.push(...results.errors.map((e) => mapIacTestError(e)));
  }

  for (const [file, resources] of Object.entries(filesWithoutIssues)) {
    output.push(resourcesToResult(results, projectName, file, resources));
  }

  for (const [
    file,
    { vulnerabilities, passedVulnerabilities },
  ] of Object.entries(vulnerabilityGroups)) {
    output.push(
      vulnerabilitiesToResult(
        results,
        projectName,
        file,
        vulnerabilities,
        passedVulnerabilities,
      ),
    );
  }

  return output;
}

function groupResourcesByFile(results: TestOutput) {
  const groups = {};

  if (results.results?.resources) {
    for (const resource of results.results.resources) {
      if (resource.file) {
        const resources = groups[resource.file] || [];
        resources.push(resource);
        groups[resource.file] = resources;
      }
    }
  }

  return groups;
}

function groupVulnerabilitiesByFile(results: TestOutput) {
  const groups: Record<
    string,
    {
      vulnerabilities: Vulnerability[];
      passedVulnerabilities: PassedVulnerability[];
    }
  > = {};

  if (results.results?.vulnerabilities) {
    for (const vulnerability of results.results.vulnerabilities) {
      if (vulnerability.resource.file) {
        const vulnerabilityInfo = groups[vulnerability.resource.file] || {
          vulnerabilities: [],
          passedVulnerabilities: [],
        };
        vulnerabilityInfo.vulnerabilities.push(vulnerability);
        groups[vulnerability.resource.file] = vulnerabilityInfo;
      }
    }
  }

  if (results.results?.passedVulnerabilities) {
    for (const passedVulnerability of results.results.passedVulnerabilities) {
      if (passedVulnerability.resource.file) {
        const vulnerabilityInfo = groups[passedVulnerability.resource.file] || {
          vulnerabilities: [],
          passedVulnerabilities: [],
        };
        vulnerabilityInfo.passedVulnerabilities.push(passedVulnerability);
        groups[passedVulnerability.resource.file] = vulnerabilityInfo;
      }
    }
  }

  return groups;
}

function findFilesWithoutIssues(
  resourceGroups: Record<string, Resource[]>,
  vulnerabilityGroups: Record<string, unknown>,
) {
  const groups: Record<string, Resource[]> = {};

  for (const [file, resources] of Object.entries(resourceGroups)) {
    if (!(file in vulnerabilityGroups)) {
      groups[file] = resources;
    }
  }

  return groups;
}

function resourcesToResult(
  testOutput: TestOutput,
  projectName: string,
  file: string,
  resources: Resource[],
): Result {
  const kind = resourcesToKind(resources);
  const ignoreSettings = testOutput.settings.ignoreSettings;
  const meta = orgSettingsToMeta(testOutput, ignoreSettings);

  return {
    meta,
    filesystemPolicy: false,
    vulnerabilities: [],
    dependencyCount: 0,
    licensesPolicy: null,
    ignoreSettings,
    targetFile: file,
    projectName,
    org: testOutput.settings.org,
    policy: '',
    isPrivate: true,
    targetFilePath: path.resolve(file),
    packageManager: kind,
    path: process.cwd(),
    projectType: kind,
    ok: true,
    infrastructureAsCodeIssues: [],
    infrastructureAsCodeSuccesses: [],
  };
}

function vulnerabilitiesToResult(
  testOutput: TestOutput,
  projectName: string,
  file: string,
  vulnerabilities: Vulnerability[],
  passedVulnerabilities: PassedVulnerability[],
): Result {
  const kind = vulnerabilitiesToKind(vulnerabilities);
  const ignoreSettings = testOutput.settings.ignoreSettings;
  const meta = orgSettingsToMeta(testOutput, ignoreSettings);
  const infrastructureAsCodeIssues = vulnerabilitiesToIacIssues(
    vulnerabilities,
  );
  const infrastructureAsCodeSuccesses = passedVulnerabilitiesToIacSuccesses(
    passedVulnerabilities,
  );

  return {
    meta,
    filesystemPolicy: false,
    vulnerabilities: [],
    dependencyCount: 0,
    licensesPolicy: null,
    ignoreSettings,
    targetFile: file,
    projectName,
    org: testOutput.settings.org,
    policy: '',
    isPrivate: true,
    targetFilePath: path.resolve(file),
    packageManager: kind,
    path: process.cwd(),
    projectType: kind,
    ok: false,
    infrastructureAsCodeIssues,
    infrastructureAsCodeSuccesses,
  };
}

function vulnerabilitiesToIacIssues(
  vulnerabilities: Vulnerability[],
): IacIssue[] {
  return vulnerabilities.map((v) => {
    const resolve = extractResolve(v);

    return {
      severity: v.severity,
      resolve,
      impact: v.rule.description,
      msg: v.resource.formattedPath,
      remediation: {
        [iacRemediationTypes[v.resource.kind] as string]: resolve,
      },
      type: v.resource.kind,
      subType: v.resource.type,
      issue: v.rule.title,
      publicId: v.rule.id,
      title: v.rule.title,
      references: v.rule.references ? [v.rule.references] : [], // TODO: `references` expects a list of URLs, but `v.references` is a markdown string with URLs. When makrdown parsing is added, extract the URLs in `v.references`
      id: v.rule.id,
      isIgnored: v.ignored,
      iacDescription: {
        issue: v.rule.title,
        impact: v.rule.description,
        resolve,
      },
      lineNumber: v.resource.line || -1,
      documentation: v.rule.documentation, // only works for rules available on snyk.io
      isGeneratedByCustomRule: !!v.rule.isGeneratedByCustomRule,
      path: v?.resource?.formattedPath.split('.') || [],
      compliance: [],
      description: v.rule.description,
    };
  });
}

// TODO IAC-2962: add "path" for the resource, but this requires changes in the `snyk-iac-test` output for the resources embedded in the raw_results
// "formattedPath" needs to be added to the resource in the raw_results
// see https://github.com/snyk/snyk-iac-test/blob/b0bfedfb47cee7098fa386f2f74dc35543f06c41/pkg/results/results.go#L179
// TODO IAC-2962: add "type" for the resource, but this requires changes in the `snyk-iac-test` output for the resources embedded in the raw_results
// "kind" needs to be added to the resource in the raw_results
// see https://github.com/snyk/snyk-iac-test/blob/b0bfedfb47cee7098fa386f2f74dc35543f06c41/pkg/results/results.go#L204
function passedVulnerabilitiesToIacSuccesses(
  vulnerabilities: PassedVulnerability[],
): IacSuccess[] {
  return vulnerabilities.map((v) => {
    return {
      severity: v.severity,
      description: v.rule.description,
      title: v.rule.title,
      subType: v.resource.type,
      id: v.rule.id,
      isIgnored: v.ignored,
    };
  });
}

function extractResolve(vulnerability: Vulnerability): string {
  const newLineIdx = vulnerability.remediation.search(/\r?\n|\r/g);
  return newLineIdx < 0
    ? vulnerability.remediation
    : vulnerability.remediation.substring(0, newLineIdx);
}

// TODO: add correct mapping to our packageManger name (will probably be done in `snyk-iac-test`)
function resourcesToKind(
  resources: Resource[],
): IacProjectType | State.InputTypeEnum {
  for (const r of resources) {
    return r.kind;
  }
  return '' as IacProjectType | State.InputTypeEnum;
}

function vulnerabilitiesToKind(
  vulnerabilities: Vulnerability[],
): IacProjectType | State.InputTypeEnum {
  for (const v of vulnerabilities) {
    return v.resource.kind;
  }
  return '' as IacProjectType | State.InputTypeEnum;
}

function orgSettingsToMeta(
  testOutput: TestOutput,
  ignoreSettings: IgnoreSettings,
): Meta {
  const org = testOutput.settings.org;

  return {
    isPrivate: true,
    isLicensesEnabled: false,
    org,
    policy: '',
    ignoreSettings,
  };
}
