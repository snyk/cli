import chalk from 'chalk';
import { icon } from '../theme';
import config from '../../lib/config';
import { TestOptions } from '../../lib/types';
import {
  DependencyPins,
  DependencyUpdates,
  GroupedVuln,
  IssueData,
  LegalInstruction,
  PatchRemediation,
  PinRemediation,
  REACHABILITY,
  RemediationChanges,
  SEVERITY,
  UpgradeRemediation,
} from '../../lib/snyk-test/legacy';
import { colorTextBySeverity } from '../../lib/snyk-test/common';
import { formatLegalInstructions } from './legal-license-instructions';
import {
  formatReachability,
  formatReachablePaths,
} from './format-reachability';
import {
  BasicVulnInfo,
  SampleReachablePaths,
  UpgradesByAffectedPackage,
} from './types';
import { PATH_SEPARATOR } from '../constants';
import { getSeverityValue } from './get-severity-value';

// How many reachable paths to show in the output
const MAX_REACHABLE_PATHS = 2;

export function formatIssuesWithRemediation(
  vulns: GroupedVuln[],
  remediationInfo: RemediationChanges,
  options: TestOptions,
): string[] {
  const basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  } = {};

  const basicLicenseInfo: {
    [name: string]: BasicVulnInfo;
  } = {};
  for (const vuln of vulns) {
    const allReachablePaths: SampleReachablePaths = { pathCount: 0, paths: [] };
    for (const issue of vuln.list) {
      const issueReachablePaths = issue.reachablePaths?.paths || [];
      for (const functionReachablePaths of issueReachablePaths) {
        allReachablePaths.paths = allReachablePaths.paths.concat(
          functionReachablePaths.callPaths,
        );
        allReachablePaths.pathCount += functionReachablePaths.callPaths.length;
      }
    }
    const vulnData = {
      title: vuln.title,
      severity: vuln.severity,
      originalSeverity: vuln.originalSeverity,
      isNew: vuln.isNew,
      name: vuln.name,
      type: vuln.metadata.type,
      version: vuln.version,
      fixedIn: vuln.fixedIn,
      note: vuln.note,
      legalInstructions: vuln.legalInstructionsArray,
      paths: vuln.list.map((v) => v.from),
      reachability: vuln.reachability,
      sampleReachablePaths: allReachablePaths,
    };

    if (vulnData.type === 'license') {
      basicLicenseInfo[vuln.metadata.id] = vulnData;
    } else {
      basicVulnInfo[vuln.metadata.id] = vulnData;
    }
  }

  const results = [''];

  let upgradeTextArray: string[];
  if (remediationInfo.pin && Object.keys(remediationInfo.pin).length) {
    const upgradesByAffected: UpgradesByAffectedPackage = {};
    for (const topLevelPkg of Object.keys(remediationInfo.upgrade)) {
      for (const targetPkgStr of remediationInfo.upgrade[topLevelPkg]
        .upgrades) {
        if (!upgradesByAffected[targetPkgStr]) {
          upgradesByAffected[targetPkgStr] = [];
        }
        upgradesByAffected[targetPkgStr].push({
          name: topLevelPkg,
          version: remediationInfo.upgrade[topLevelPkg].upgradeTo,
        });
      }
    }
    upgradeTextArray = constructPinText(
      remediationInfo.pin,
      upgradesByAffected,
      basicVulnInfo,
      options,
    );
    const allVulnIds = new Set();
    Object.keys(remediationInfo.pin).forEach((name) =>
      remediationInfo.pin[name].vulns.forEach((vid) => allVulnIds.add(vid)),
    );
    remediationInfo.unresolved = remediationInfo.unresolved.filter(
      (issue) => !allVulnIds.has(issue.id),
    );
  } else {
    upgradeTextArray = constructUpgradesText(
      remediationInfo.upgrade,
      basicVulnInfo,
      options,
    );
  }
  if (upgradeTextArray.length > 0) {
    results.push(upgradeTextArray.join('\n'));
  }

  const patchedTextArray = constructPatchesText(
    remediationInfo.patch,
    basicVulnInfo,
    options,
  );

  if (patchedTextArray.length > 0) {
    results.push(patchedTextArray.join('\n'));
  }

  const unfixableIssuesTextArray = constructUnfixableText(
    remediationInfo.unresolved,
    basicVulnInfo,
    options,
  );

  if (unfixableIssuesTextArray.length > 0) {
    results.push(unfixableIssuesTextArray.join('\n'));
  }

  const licenseIssuesTextArray = constructLicenseText(
    basicLicenseInfo,
    options,
  );

  if (licenseIssuesTextArray.length > 0) {
    results.push(licenseIssuesTextArray.join('\n'));
  }

  return results;
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

  const licenseTextArray = [chalk.bold('\nLicense issues:')];

  for (const id of Object.keys(basicLicenseInfo)) {
    const licenseText = formatIssue(
      id,
      basicLicenseInfo[id].title,
      basicLicenseInfo[id].severity,
      basicLicenseInfo[id].isNew,
      `${basicLicenseInfo[id].name}@${basicLicenseInfo[id].version}`,
      basicLicenseInfo[id].paths,
      testOptions,
      basicLicenseInfo[id].note,
      undefined, // We can never override license rules, so no originalSeverity here
      basicLicenseInfo[id].legalInstructions,
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
  const patchedTextArray = [chalk.bold('\nPatchable issues:')];
  for (const id of Object.keys(patches)) {
    if (!basicVulnInfo[id]) {
      continue;
    }
    if (basicVulnInfo[id].type === 'license') {
      continue;
    }

    // todo: add vulnToPatch package name
    const packageAtVersion = `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`;
    const patchedText = `\n  Patch available for ${chalk.bold.whiteBright(
      packageAtVersion,
    )}\n`;
    const thisPatchFixes = formatIssue(
      id,
      basicVulnInfo[id].title,
      basicVulnInfo[id].severity,
      basicVulnInfo[id].isNew,
      `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`,
      basicVulnInfo[id].paths,
      testOptions,
      basicVulnInfo[id].note,
      basicVulnInfo[id].originalSeverity,
    );
    patchedTextArray.push(patchedText + thisPatchFixes);
  }

  return patchedTextArray;
}

function thisUpgradeFixes(
  vulnIds: string[],
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
) {
  return vulnIds
    .filter((id) => basicVulnInfo[id]) // basicVulnInfo only contains issues with the specified severity levels
    .sort(
      (a, b) =>
        getSeverityValue(basicVulnInfo[a].severity) -
        getSeverityValue(basicVulnInfo[b].severity),
    )
    .filter((id) => basicVulnInfo[id].type !== 'license')
    .map((id) =>
      formatIssue(
        id,
        basicVulnInfo[id].title,
        basicVulnInfo[id].severity,
        basicVulnInfo[id].isNew,
        `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`,
        basicVulnInfo[id].paths,
        testOptions,
        basicVulnInfo[id].note,
        basicVulnInfo[id].originalSeverity,
        [],
        basicVulnInfo[id].reachability,
        basicVulnInfo[id].sampleReachablePaths,
      ),
    )
    .join('\n');
}

function processUpgrades(
  sink: string[],
  upgradesByDep: DependencyUpdates | DependencyPins,
  deps: string[],
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
) {
  for (const dep of deps) {
    const data = upgradesByDep[dep];
    const upgradeDepTo = data.upgradeTo;
    const vulnIds =
      (data as UpgradeRemediation).vulns || (data as PinRemediation).vulns;
    const upgradeText = `\n  Upgrade ${chalk.bold.whiteBright(
      dep,
    )} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix\n`;
    sink.push(
      upgradeText + thisUpgradeFixes(vulnIds, basicVulnInfo, testOptions),
    );
  }
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

  const upgradeTextArray = [chalk.bold('\nIssues to fix by upgrading:')];
  processUpgrades(
    upgradeTextArray,
    upgrades,
    Object.keys(upgrades),
    basicVulnInfo,
    testOptions,
  );
  return upgradeTextArray;
}

function constructPinText(
  pins: DependencyPins,
  upgradesByAffected: UpgradesByAffectedPackage, // classical "remediation via top-level dep" upgrades
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
): string[] {
  if (!Object.keys(pins).length) {
    return [];
  }

  const upgradeTextArray: string[] = [];
  upgradeTextArray.push(
    chalk.bold('\nIssues to fix by upgrading dependencies:'),
  );

  // First, direct upgrades

  const upgradeables = Object.keys(pins).filter(
    (name) => !pins[name].isTransitive,
  );
  if (upgradeables.length) {
    processUpgrades(
      upgradeTextArray,
      pins,
      upgradeables,
      basicVulnInfo,
      testOptions,
    );
  }

  // Second, pins
  const pinables = Object.keys(pins).filter((name) => pins[name].isTransitive);

  if (pinables.length) {
    for (const pkgName of pinables) {
      const data = pins[pkgName];
      const vulnIds = data.vulns;
      const upgradeDepTo = data.upgradeTo;
      const upgradeText = `\n  Pin ${chalk.bold.whiteBright(
        pkgName,
      )} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix`;
      upgradeTextArray.push(upgradeText);
      upgradeTextArray.push(
        thisUpgradeFixes(vulnIds, basicVulnInfo, testOptions),
      );

      // Finally, if we have some upgrade paths that fix the same issues, suggest them as well.
      const topLevelUpgradesAlreadySuggested = new Set();
      for (const vid of vulnIds) {
        for (const topLevelPkg of upgradesByAffected[
          pkgName + '@' + basicVulnInfo[vid].version
        ] || []) {
          const setKey = `${topLevelPkg.name}\n${topLevelPkg.version}`;
          if (!topLevelUpgradesAlreadySuggested.has(setKey)) {
            topLevelUpgradesAlreadySuggested.add(setKey);
            upgradeTextArray.push(
              '  The issues above can also be fixed by upgrading top-level dependency ' +
                `${topLevelPkg.name} to ${topLevelPkg.version}`,
            );
          }
        }
      }
    }
  }

  return upgradeTextArray;
}

function constructUnfixableText(
  unresolved: IssueData[],
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
) {
  if (!(unresolved.length > 0)) {
    return [];
  }
  const unfixableIssuesTextArray = [
    chalk.bold('\nIssues with no direct upgrade or patch:'),
  ];
  for (const issue of unresolved) {
    const issueInfo = basicVulnInfo[issue.id];
    if (!issueInfo) {
      // basicVulnInfo only contains issues with the specified severity levels
      continue;
    }

    const extraInfo =
      issue.fixedIn && issue.fixedIn.length
        ? `\n    This issue was fixed in versions: ${chalk.bold(
            issue.fixedIn.join(', '),
          )}`
        : '\n    No upgrade or patch available';
    unfixableIssuesTextArray.push(
      formatIssue(
        issue.id,
        issue.title,
        issue.severity,
        issue.isNew,
        `${issue.packageName}@${issue.version}`,
        issueInfo.paths,
        testOptions,
        issueInfo.note,
        issueInfo.originalSeverity,
        [],
        issue.reachability,
      ) + `${extraInfo}`,
    );
  }

  if (unfixableIssuesTextArray.length === 1) {
    // seems we still only have
    // the initial section title, so nothing to return
    return [];
  }

  return unfixableIssuesTextArray;
}

export function printPath(path: string[], slice = 1) {
  return path.slice(slice).join(PATH_SEPARATOR);
}

export function formatIssue(
  id: string,
  title: string,
  severity: SEVERITY,
  isNew: boolean,
  vulnerableModule: string,
  paths: string[][],
  testOptions: TestOptions,
  note: string | false,
  originalSeverity?: SEVERITY,
  legalInstructions?: LegalInstruction[],
  reachability?: REACHABILITY,
  sampleReachablePaths?: SampleReachablePaths,
): string {
  const newBadge = isNew ? ' (new)' : '';
  const name = vulnerableModule ? ` in ${chalk.bold(vulnerableModule)}` : '';
  let legalLicenseInstructionsText;
  if (legalInstructions) {
    legalLicenseInstructionsText = formatLegalInstructions(legalInstructions);
  }
  let reachabilityText = '';
  if (reachability) {
    reachabilityText = formatReachability(reachability);
  }

  let introducedBy = '';

  if (
    testOptions.showVulnPaths === 'some' &&
    paths &&
    paths.find((p) => p.length > 1)
  ) {
    // In this mode, we show only one path by default, for compactness
    const pathStr = printPath(paths[0]);
    introducedBy =
      paths.length === 1
        ? `\n    introduced by ${pathStr}`
        : `\n    introduced by ${pathStr} and ${chalk.cyanBright(
            '' + (paths.length - 1),
          )} other path(s)`;
  } else if (testOptions.showVulnPaths === 'all' && paths) {
    introducedBy =
      '\n    introduced by:' +
      paths
        .slice(0, 1000)
        .map((p) => '\n    ' + printPath(p))
        .join('');
    if (paths.length > 1000) {
      introducedBy += `\n    and ${chalk.cyanBright(
        '' + (paths.length - 1),
      )} other path(s)`;
    }
  }

  const reachableVia = formatReachablePaths(
    sampleReachablePaths,
    MAX_REACHABLE_PATHS,
    reachablePathsTemplate,
  );

  let originalSeverityStr = '';
  if (originalSeverity && originalSeverity !== severity) {
    originalSeverityStr = ` (originally ${titleCaseText(originalSeverity)})`;
  }

  return (
    colorTextBySeverity(
      severity,
      `  ${icon.ISSUE} [${titleCaseText(
        severity,
      )}${originalSeverityStr}] ${chalk.bold(title)}${newBadge}`,
    ) +
    reachabilityText +
    '\n    ' +
    `[${config.PUBLIC_VULN_DB_URL}/vuln/${id}]` +
    name +
    reachableVia +
    introducedBy +
    (legalLicenseInstructionsText
      ? `${chalk.bold(
          '\n    Legal instructions',
        )}:\n    ${legalLicenseInstructionsText}`
      : '') +
    (note ? `${chalk.bold('\n    Note')}:\n    ${note}` : '')
  );
}

function titleCaseText(text) {
  return text[0].toUpperCase() + text.slice(1);
}

function reachablePathsTemplate(
  samplePaths: string[],
  extraPathsCount: number,
): string {
  if (samplePaths.length === 0 && extraPathsCount === 0) {
    return '';
  }
  if (samplePaths.length === 0) {
    return `\n    reachable via at least ${extraPathsCount} paths`;
  }
  let reachableVia = '\n    reachable via:\n';
  for (const p of samplePaths) {
    reachableVia += `    ${p}\n`;
  }
  if (extraPathsCount > 0) {
    reachableVia += `    and at least ${chalk.cyanBright(
      '' + extraPathsCount,
    )} other path(s)`;
  }
  return reachableVia;
}
