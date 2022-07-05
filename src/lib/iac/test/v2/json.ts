// Some of the types below specify fields constrained to a single value. Those
// fields must be produced in the JSON output, and they must have those values
// to keep backwards compatibility.

import { IacOrgSettings } from '../../../../cli/commands/test/iac/local-execution/types';
import { Resource, SnykIacTestOutput, Vulnerability } from './scan/results';
import * as path from 'path';
import { createErrorMappedResultsForJsonOutput } from '../../../formatters/test/format-test-results';

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
  packageManager: string;
  path: string;
  projectType: string;
  ok: boolean;
  infrastructureAsCodeIssues: IacIssue[];
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
  documentation: string;
  isGeneratedByCustomRule: boolean;
  path: string[];
  policyEngineType?: string;
  type?: string;
  compliance?: string[][];
  description: string;
}

export interface Remediation {
  cloudformation?: string;
  terraform: string;
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
  orgSettings,
}: {
  results: SnykIacTestOutput;
  projectName: string;
  orgSettings: IacOrgSettings;
}): Result[] {
  const vulnerabilityGroups = groupVulnerabilitiesByFile(results); // all vulns groups by file
  const resourceGroups = groupResourcesByFile(results); // all resources grouped by file
  const filesWithoutIssues = findFilesWithoutIssues(
    resourceGroups,
    vulnerabilityGroups,
  ); // all resources without issues grouped by file

  const output: Result[] = [];

  // TODO: add support for multiple errors, currently we output only the first one
  if (results.errors) {
    return createErrorMappedResultsForJsonOutput(results.errors);
  }

  for (const [file, resources] of Object.entries(filesWithoutIssues)) {
    output.push(resourcesToResult(orgSettings, projectName, file, resources));
  }

  for (const [file, vulnerabilities] of Object.entries(vulnerabilityGroups)) {
    output.push(
      vulnerabilitiesToResult(orgSettings, projectName, file, vulnerabilities),
    );
  }

  return output;
}

function groupResourcesByFile(results: SnykIacTestOutput) {
  const groups: Record<string, Resource[]> = {};

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

function groupVulnerabilitiesByFile(results: SnykIacTestOutput) {
  const groups: Record<string, Vulnerability[]> = {};

  if (results.results?.vulnerabilities) {
    for (const vulnerability of results.results.vulnerabilities) {
      if (vulnerability.resource.file) {
        const vulnerabilities = groups[vulnerability.resource.file] || [];
        vulnerabilities.push(vulnerability);
        groups[vulnerability.resource.file] = vulnerabilities;
      }
    }
  }

  return groups;
}

function findFilesWithoutIssues(
  resourceGroups: Record<string, Resource[]>,
  vulnerabilityGroups: Record<string, Vulnerability[]>,
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
  orgSettings: IacOrgSettings,
  projectName: string,
  file: string,
  resources: Resource[],
): Result {
  const kind = resourcesToKind(resources);
  const ignoreSettings = orgSettingsToIgnoreSettings(orgSettings);
  const meta = orgSettingsToMeta(orgSettings, ignoreSettings);

  const {
    meta: { org, isPrivate, policy },
  } = orgSettings;

  return {
    meta,
    filesystemPolicy: false,
    vulnerabilities: [],
    dependencyCount: 0,
    licensesPolicy: null,
    ignoreSettings,
    targetFile: file,
    projectName,
    org,
    policy: policy || '',
    isPrivate,
    targetFilePath: path.resolve(file),
    packageManager: kind,
    path: process.cwd(),
    projectType: kind,
    ok: true,
    infrastructureAsCodeIssues: [],
  };
}

function vulnerabilitiesToResult(
  orgSettings: IacOrgSettings,
  projectName: string,
  file: string,
  vulnerabilities: Vulnerability[],
): Result {
  const kind = vulnerabilitiesToKind(vulnerabilities);
  const ignoreSettings = orgSettingsToIgnoreSettings(orgSettings);
  const meta = orgSettingsToMeta(orgSettings, ignoreSettings);
  const infrastructureAsCodeIssues = vulnerabilitiesToIacIssues(
    vulnerabilities,
  );

  const {
    meta: { org, isPrivate, policy },
  } = orgSettings;

  return {
    meta,
    filesystemPolicy: false,
    vulnerabilities: [],
    dependencyCount: 0,
    licensesPolicy: null,
    ignoreSettings,
    targetFile: file,
    projectName,
    org,
    policy: policy || '',
    isPrivate,
    targetFilePath: path.resolve(file),
    packageManager: kind,
    path: process.cwd(),
    projectType: kind,
    ok: false,
    infrastructureAsCodeIssues,
  };
}

function vulnerabilitiesToIacIssues(
  vulnerabilities: Vulnerability[],
): IacIssue[] {
  return vulnerabilities.map((v) => {
    const msg = formattedPath(v.resource.id, v.resource.path);

    return {
      severity: v.severity,
      resolve: v.remediation, // potential needs to be deleted because it is supported only by the old format of our rules
      impact: 'TBD',
      msg,
      remediation: {
        terraform: v.remediation, // in the future we need to add logic that will add remediation only for the relevant field (based on file type)
      },
      type: v.resource.kind,
      subType: v.resource.type,
      issue: v.rule.description,
      publicId: v.rule.id,
      title: v.rule.title,
      references: ['TBD'], // missing in `snyk-iac-test` v0.3.0 will be added in a future release
      id: v.rule.id,
      isIgnored: v.ignored,
      iacDescription: {
        issue: v.rule.title,
        impact: 'TBD',
        resolve: v.remediation,
      },
      lineNumber: v.resource.line || -1,
      documentation: 'TBD', // add this once we'll start using updated rules with "legacy" public-ids
      isGeneratedByCustomRule: false,
      path: v.resource.path || [], // needs to be fixed, currently doesn't show the full path
      compliance: [['TBD']], // missing in `snyk-iac-test` v0.3.0 will be added in a future release
      description: v.rule.description,
    };
  });
}

// TODO: add correct mapping to our packageManger name (will probably be done in `snyk-iac-test`)
function resourcesToKind(resources: Resource[]): string {
  for (const r of resources) {
    return r.kind;
  }
  return '';
}

function vulnerabilitiesToKind(vulnerabilities: Vulnerability[]): string {
  for (const v of vulnerabilities) {
    return v.resource.kind;
  }
  return '';
}

function orgSettingsToMeta(
  orgSettings: IacOrgSettings,
  ignoreSettings: IgnoreSettings,
): Meta {
  const {
    meta: { isPrivate, isLicensesEnabled, org, policy },
  } = orgSettings;

  return {
    isPrivate,
    isLicensesEnabled,
    org,
    policy: policy || '',
    ignoreSettings,
  };
}

function orgSettingsToIgnoreSettings(
  orgSettings: IacOrgSettings,
): IgnoreSettings {
  const {
    meta: { ignoreSettings },
  } = orgSettings;

  return {
    adminOnly: ignoreSettings?.adminOnly || false,
    reasonRequired: ignoreSettings?.reasonRequired || false,
    disregardFilesystemIgnores:
      ignoreSettings?.disregardFilesystemIgnores || false,
  };
}

function formattedPath(id: string, path?: any[]): string {
  const parts: string[] = [id];

  if (path) {
    for (let i = 0; i < path.length; i++) {
      if (i == 0) {
        if (typeof path[i] === 'number') {
          parts.push(`[${path[i]}]`);
        } else {
          parts.push(`${path[i]}`);
        }
      } else {
        if (typeof path[i] === 'number') {
          parts.push(`[${path[i]}]`);
        } else {
          parts.push(`.${path[i]}`);
        }
      }
    }
  }

  return parts.join('');
}
