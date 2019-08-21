import chalk from 'chalk';
import * as config from '../../../../lib/config';
import { TestOptions } from '../../../../lib/types';
import {
  RemediationResult, PatchRemediation,
  DependencyUpdates, IssueData, SEVERITY, GroupedVuln,
  DependencyPins, PinRemediation,
} from '../../../../lib/snyk-test/legacy';

interface BasicVulnInfo {
  title: string;
  severity: SEVERITY;
  isNew: boolean;
  name: string;
  version: string;
  fixedIn: string[];
}

interface TopLevelPackageUpgrade {
  name: string;
  version: string;
}

interface UpgradesByCulprit {
  [culpritNameAndVersion: string]: TopLevelPackageUpgrade[];
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

  if (remediationInfo.pin && Object.keys(remediationInfo.pin).length) {
    const upgragesByCulprit: UpgradesByCulprit = {};
    for (const topLvlPkg of Object.keys(remediationInfo.upgrade)) {
      for (const targetPkgStr of remediationInfo.upgrade[topLvlPkg].upgrades) {
        if (!upgragesByCulprit[targetPkgStr]) {
          upgragesByCulprit[targetPkgStr] = [];
        }
        upgragesByCulprit[targetPkgStr].push({
          name: topLvlPkg,
          version: remediationInfo.upgrade[topLvlPkg].upgradeTo,
        });
      }
    }
    const upgradeTextArray = constructPinOrUpgradesText(remediationInfo.pin, upgragesByCulprit, basicVulnInfo);
    if (upgradeTextArray.length > 0) {
      results.push(upgradeTextArray.join('\n'));
    }
    const allVulnIdsSet = {};
    Object.keys(remediationInfo.pin).forEach(
      (name) => remediationInfo.pin[name].vulns.forEach((vid) => allVulnIdsSet[vid] = true));
    remediationInfo.unresolved = remediationInfo.unresolved.filter((issue) => !allVulnIdsSet[issue.id]);
  } else {
    const upgradeTextArray = constructUpgradesText(remediationInfo.upgrade, basicVulnInfo);
    if (upgradeTextArray.length > 0) {
      results.push(upgradeTextArray.join('\n'));
    }
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

  const upgradeTextArray = [chalk.bold.green('\nIssues to fix by upgrading:')];
  for (const upgrade of Object.keys(upgrades)) {
    const data = upgrades[upgrade];
    const upgradeDepTo = data.upgradeTo;
    const vulnIds = data.vulns;
    const upgradeText =
      `\n  Upgrade ${chalk.bold.whiteBright(upgrade)} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix\n`;
    const thisUpgradeFixes = vulnIds
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

function constructPinOrUpgradesText(
  pins: DependencyPins,
  upgradesByCulprit: UpgradesByCulprit,
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
): string[] {

  if (!(Object.keys(pins).length)) {
    return [];
  }

  const thisUpgradeFixes = (vulnIds: string[]) => (
    vulnIds.map((id) => formatIssue(
      id,
      basicVulnInfo[id].title,
      basicVulnInfo[id].severity,
      basicVulnInfo[id].isNew,
      `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`))
    .join('\n')
  );

  // First, direct upgrades
  const upgradeTextArray: string[] = [];

  const upgradeables = Object.keys(pins).filter((name) => !pins[name].isTransitive);
  if (upgradeables.length) {
    upgradeTextArray.push(chalk.bold.green('\nIssues to fix by upgrading existing dependencies:'));

    for (const pin of upgradeables) {
      const data = pins[pin];
      const vulnIds = data.vulns;
      const upgradeDepTo = data.upgradeTo;
      const upgradeText =
        `\n  Upgrade ${chalk.bold.whiteBright(pin)} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix\n`;
      upgradeTextArray.push(upgradeText)
      upgradeTextArray.push(thisUpgradeFixes(vulnIds));
    }
  }

  // Second, pins
  const pinables = Object.keys(pins).filter((name) => pins[name].isTransitive);

  if (pinables.length) {
    upgradeTextArray.push(chalk.bold.green('\nIssues to fix by pinning sub-dependencies:'));

    for (const pin of pinables) {
      const data = pins[pin];
      const vulnIds = data.vulns;
      const upgradeDepTo = data.upgradeTo;
      const upgradeText =
        `\n  Pin ${chalk.bold.whiteBright(pin)} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix\n`;
      upgradeTextArray.push(upgradeText)
      upgradeTextArray.push(thisUpgradeFixes(vulnIds));
      const topLevelUpgradesSet = new Set();
      for (const vid of vulnIds) {
        const maybeTopLevelUpgrades = upgradesByCulprit[pin + '@' + basicVulnInfo[vid].version];
        if (maybeTopLevelUpgrades) {
          for (const topLvlPkg of maybeTopLevelUpgrades) {
            const setKey = `${topLvlPkg.name}\n${topLvlPkg.version}`;
            if (!topLevelUpgradesSet.has(setKey)) {
              topLevelUpgradesSet.add(setKey);
              upgradeTextArray.push('\n  (the issues above can also be fixed by upgrading top-level dependency ' +
                `${topLvlPkg.name} to ${topLvlPkg.version})`);
            }
          }
        }
      }
    }
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
    const packageNameAtVersion = chalk.bold.whiteBright(`\n  ${issue.packageName}@${issue.version}\n`);
    unfixableIssuesTextArray
      .push(packageNameAtVersion + formatIssue(issue.id, issue.title, issue.severity, issue.isNew) + `${extraInfo}`);
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
