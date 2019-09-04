import * as _ from 'lodash';
import chalk from 'chalk';
import * as wrap from 'wrap-ansi';
import * as config from '../../../../lib/config';
import { TestOptions, ShowVulnPaths } from '../../../../lib/types';
import { RemediationResult, PatchRemediation,
  DependencyUpdates, IssueData, SEVERITY, GroupedVuln } from '../../../../lib/snyk-test/legacy';
import { SEVERITIES } from '../../../../lib/snyk-test/common';

interface BasicVulnInfo {
  type: string;
  title: string;
  severity: SEVERITY;
  isNew: boolean;
  name: string;
  version: string;
  fixedIn: string[];
  legalInstructions?: string;
  paths: string[][];
}

export function formatIssuesWithRemediation(
  vulns: GroupedVuln[],
  remediationInfo: RemediationResult,
  options: TestOptions,
): string[] {

  const basicVulnInfo: {
    [name: string]: BasicVulnInfo,
  } = {};

  const basicLicenseInfo: {
    [name: string]: BasicVulnInfo,
  } = {};

  for (const vuln of vulns) {
    const vulnData = {
      title: vuln.title,
      severity: vuln.severity,
      isNew: vuln.isNew,
      name: vuln.name,
      type: vuln.metadata.type,
      version: vuln.version,
      fixedIn: vuln.fixedIn,
      legalInstructions: vuln.legalInstructions,
      paths: vuln.list.map((v) => v.from),
    };

    basicVulnInfo[vuln.metadata.id] = vulnData;

    if (vulnData.type === 'license') {
      basicLicenseInfo[vuln.metadata.id] = vulnData;
    }
  }

  const results = [chalk.bold.white('Remediation advice')];

  const upgradeTextArray = constructUpgradesText(remediationInfo.upgrade, basicVulnInfo, options);
  if (upgradeTextArray.length > 0) {
    results.push(upgradeTextArray.join('\n'));
  }

  const patchedTextArray = constructPatchesText(remediationInfo.patch, basicVulnInfo, options);

  if (patchedTextArray.length > 0) {
    results.push(patchedTextArray.join('\n'));
  }

  const unfixableIssuesTextArray = constructUnfixableText(remediationInfo.unresolved, basicVulnInfo, options);

  if (unfixableIssuesTextArray.length > 0) {
    results.push(unfixableIssuesTextArray.join('\n'));
  }

  const licenseIssuesTextArray = constructLicenseText(basicLicenseInfo, options);

  if (licenseIssuesTextArray.length > 0) {
    results.push(licenseIssuesTextArray.join('\n'));
  }

  return results;
}

export function getSeverityValue(severity: SEVERITY): number {
  return SEVERITIES.find((s) => s.verboseName === severity)!.value;
}

function constructLicenseText(
  basicLicenseInfo: {
    [name: string]: BasicVulnInfo;
  },
  testOptions: TestOptions,
): string[] {

  if (!(Object.keys(basicLicenseInfo).length > 0)) {
    return [];
  }

  const licenseTextArray = [chalk.bold.green('\nLicense issues:')];

  for (const id of Object.keys(basicLicenseInfo)) {

    const licenseText =
    formatIssue(
      id,
      basicLicenseInfo[id].title,
      basicLicenseInfo[id].severity,
      basicLicenseInfo[id].isNew,
      basicLicenseInfo[id].legalInstructions,
      `${basicLicenseInfo[id].name}@${basicLicenseInfo[id].version}`,
      basicLicenseInfo[id].paths,
      testOptions,
    );
    licenseTextArray.push('\n' + licenseText);
  }
  return licenseTextArray;
}

function constructPatchesText(
  patches: {
    [name: string]: PatchRemediation;
  },
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
  testOptions: TestOptions,
): string[] {

  if (!(Object.keys(patches).length > 0)) {
    return [];
  }
  const patchedTextArray = [chalk.bold.green('\nPatchable issues:')];

  for (const id of Object.keys(patches)) {

    if (basicVulnInfo[id].type === 'license') {
      continue;
    }

    // todo: add vulnToPatch package name
    const packageAtVersion = `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`;
    const patchedText = `\n  Patch available for ${chalk.bold.whiteBright(packageAtVersion)}\n`;
    const thisPatchFixes =
    formatIssue(
      id,
      basicVulnInfo[id].title,
      basicVulnInfo[id].severity,
      basicVulnInfo[id].isNew,
      undefined,
      `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`,
      basicVulnInfo[id].paths,
      testOptions,
    );
    patchedTextArray.push(patchedText + thisPatchFixes);
  }

  return patchedTextArray;
}

function constructUpgradesText(
  upgrades: DependencyUpdates,
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
  testOptions: TestOptions,
): string[] {

  if (!(Object.keys(upgrades).length > 0)) {
    return [];
  }

  const upgradeTextArray = [chalk.bold.green('\nUpgradable Issues:')];
  for (const upgrade of Object.keys(upgrades)) {
    const upgradeDepTo = _.get(upgrades, [upgrade, 'upgradeTo']);
    const vulnIds = _.get(upgrades, [upgrade, 'vulns']);
    const upgradeText =
      `\n  Upgrade ${chalk.bold.whiteBright(upgrade)} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix\n`;
    const thisUpgradeFixes = vulnIds
      .sort((a, b) => getSeverityValue(basicVulnInfo[a].severity) - getSeverityValue(basicVulnInfo[b].severity))
      .filter((id) => basicVulnInfo[id].type !== 'license')
      .map((id) => formatIssue(
        id,
        basicVulnInfo[id].title,
        basicVulnInfo[id].severity,
        basicVulnInfo[id].isNew,
        undefined,
        `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`,
        basicVulnInfo[id].paths,
        testOptions,
      ))
      .join('\n');
    upgradeTextArray.push(upgradeText + thisUpgradeFixes);
  }
  return upgradeTextArray;
}

function constructUnfixableText(unresolved: IssueData[], basicVulnInfo: Record<string, BasicVulnInfo>, testOptions: TestOptions) {
  if (!(unresolved.length > 0)) {
    return [];
  }
  const unfixableIssuesTextArray = [chalk.bold.white('\nIssues with no direct upgrade or patch:')];
  for (const issue of unresolved) {
    const extraInfo = issue.fixedIn && issue.fixedIn.length
      ? `\n  This issue was fixed in versions: ${chalk.bold(issue.fixedIn.join(', '))}`
      : '\n  No upgrade or patch available';
    unfixableIssuesTextArray
      .push(formatIssue(
        issue.id,
        issue.title,
        issue.severity,
        issue.isNew,
        undefined,
        `${issue.packageName}@${issue.version}`,
        basicVulnInfo[issue.id].paths,
        testOptions,
      ) + `${extraInfo}`);
  }

  return unfixableIssuesTextArray;
}

function printPath(path: string[]) {
  return path.slice(1).map((name, i) => chalk.cyan(name)).join(' > ');
}

function formatIssue(
  id: string,
  title: string,
  severity: SEVERITY,
  isNew: boolean,
  legalInstructions: string | undefined,
  vulnerableModule: string,
  paths: string[][],
  testOptions: TestOptions,
  ): string {
  const severitiesColourMapping = {
    low: {
      colorFunc(text) {
        return chalk.blueBright(text);
      },
    },
    medium: {
      colorFunc(text) {
        return chalk.yellowBright(text);
      },
    },
    high: {
      colorFunc(text) {
        return chalk.redBright(text);
      },
    },
  };
  const newBadge = isNew ? ' (new)' : '';
  const name = vulnerableModule ? ` in ${chalk.bold(vulnerableModule)}` : '';
  const wrapLegalText = wrap(`${legalInstructions}`, 100);
  const formatLegalText = wrapLegalText.split('\n').join('\n    ');

  let introducedBy = '';
  if (testOptions.showVulnPaths === 'some' && paths && paths.find((p) => p.length > 2)) {
    // In this mode, we show only one path by default, for compactness
    const pathStr = printPath(paths[0]);
    introducedBy = paths.length === 1
      ? `\n    introduced by ${pathStr}`
      : `\n    introduced by ${pathStr} and ${chalk.cyanBright('' + (paths.length - 1))} other path(s)`;
  } else if (testOptions.showVulnPaths === 'all' && paths) {
    introducedBy = `\n    introduced by:` + paths.slice(0, 1000).map((p) => `\n    ` + printPath(p)).join('');
    if (paths.length > 1000) {
      introducedBy += `\n    and ${chalk.cyanBright('' + (paths.length - 1))} other path(s)`
    }
  }

  return severitiesColourMapping[severity].colorFunc(
    `  ✗ ${chalk.bold(title)}${newBadge} [${titleCaseText(severity)} Severity]`,
  ) + `[${config.ROOT}/vuln/${id}]` + name
    + introducedBy
    + (legalInstructions ? `${chalk.bold('\n  Legal instructions')}:\n  ${formatLegalText}` : '');
}

function titleCaseText(text) {
  return text[0].toUpperCase() + text.slice(1);
}
