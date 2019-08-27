import * as _ from 'lodash';
import chalk from 'chalk';
import * as config from '../../../../lib/config';
import { TestOptions } from '../../../../lib/types';
import { RemediationResult, PatchRemediation,
  DependencyUpdates, IssueData, SEVERITY, GroupedVuln } from '../../../../lib/snyk-test/legacy';
import { SEVERITIES } from '../../../../lib/snyk-test/common';

interface BasicVulnInfo {
  title: string;
  severity: SEVERITY;
  isNew: boolean;
  name: string;
  version: string;
  fixedIn: string[];
}

export function formatIssuesWithRemediation(
  vulns: GroupedVuln[],
  remediationInfo: RemediationResult,
  options: TestOptions,
  ): string[] {

  const basicVulnInfo: {
    [name: string]: BasicVulnInfo,
  } = {};

  for (const vuln of vulns) {
    basicVulnInfo[vuln.metadata.id] = {
      title: vuln.title,
      severity: vuln.severity,
      isNew: vuln.isNew,
      name: vuln.name,
      version: vuln.version,
      fixedIn: vuln.fixedIn,
    };
  }
  const results = [chalk.bold.white('Remediation advice')];

  const upgradeTextArray = constructUpgradesText(remediationInfo.upgrade, basicVulnInfo);
  if (upgradeTextArray.length > 0) {
    results.push(upgradeTextArray.join('\n'));
  }

  const patchedTextArray = constructPatchesText(remediationInfo.patch, basicVulnInfo);

  if (patchedTextArray.length > 0) {
    results.push(patchedTextArray.join('\n'));
  }

  const unfixableIssuesTextArray = constructUnfixableText(remediationInfo.unresolved);

  if (unfixableIssuesTextArray.length > 0) {
    results.push(unfixableIssuesTextArray.join('\n'));
  }

  return results;
}

export function getSeverityValue(severity: SEVERITY): number {
  return SEVERITIES.find((s) => s.verboseName === severity)!.value;
}

function constructPatchesText(
  patches: {
    [name: string]: PatchRemediation;
  },
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
  ): string[] {

  if (!(Object.keys(patches).length > 0)) {
    return [];
  }
  const patchedTextArray = [chalk.bold.green('\nPatchable issues:')];

  for (const id of Object.keys(patches)) {
    // todo: add vulnToPatch package name
    const packageAtVersion = `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`;
    const patchedText = `\n  Patch available for ${chalk.bold.whiteBright(packageAtVersion)}\n`;
    const thisPatchFixes =
    formatIssue(
      id,
      basicVulnInfo[id].title,
      basicVulnInfo[id].severity,
      basicVulnInfo[id].isNew,
      `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`);
    patchedTextArray.push(patchedText + thisPatchFixes);
  }

  return patchedTextArray;
}

function constructUpgradesText(
  upgrades: DependencyUpdates,
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
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
      .map((id) => formatIssue(
          id,
          basicVulnInfo[id].title,
          basicVulnInfo[id].severity,
          basicVulnInfo[id].isNew,
          `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`))
      .join('\n');
    upgradeTextArray.push(upgradeText + thisUpgradeFixes);
  }
  return upgradeTextArray;
}

function constructUnfixableText(unresolved: IssueData[]) {
  if (!(unresolved.length > 0)) {
    return [];
  }
  const unfixableIssuesTextArray = [chalk.bold.white('\nIssues with no direct upgrade or patch:')];
  for (const issue of unresolved) {
    const extraInfo = issue.fixedIn && issue.fixedIn.length
      ? `\n  This issue was fixed in versions: ${chalk.bold(issue.fixedIn.join(', '))}`
      : '\n  No upgrade or patch available';
    const packageNameAtVersion = chalk.bold
    .whiteBright(`\n  ${issue.packageName}@${issue.version}\n`);
    unfixableIssuesTextArray
      .push(packageNameAtVersion +
      formatIssue(
        issue.id,
        issue.title,
        issue.severity,
        issue.isNew) + `${extraInfo}`,
      );
  }

  return unfixableIssuesTextArray;
}

function formatIssue(
  id: string,
  title: string,
  severity: SEVERITY,
  isNew: boolean,
  vulnerableModule?: string): string {
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

  return severitiesColourMapping[severity].colorFunc(
    `  ✗ ${chalk.bold(title)}${newBadge} [${titleCaseText(severity)} Severity]`,
    ) + `[${config.ROOT}/vuln/${id}]` + name;
}

function titleCaseText(text) {
  return text[0].toUpperCase() + text.slice(1);
}
