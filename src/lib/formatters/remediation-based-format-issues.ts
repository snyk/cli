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
  FormattedIssuesWithRemediation,
  SampleReachablePaths,
  UpgradesByAffectedPackage,
} from './types';
import { PATH_SEPARATOR } from '../constants';
import { getSeverityValue } from './get-severity-value';

// How many reachable paths to show in the output
const MAX_REACHABLE_PATHS = 2;

type ConstructIssuesTextOutput = {
  textArray: string[];
  countTotal: number;
  countBySeverity?: { [severity in SEVERITY]: number };
};

export function formatIssuesWithRemediation(
  vulns: GroupedVuln[],
  remediationInfo: RemediationChanges,
  options: TestOptions,
): FormattedIssuesWithRemediation {
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

  const results: FormattedIssuesWithRemediation = {
    outputTextArray: [],
    counts: {
      noUpgradeOrPatchCount: 0,
      licenseTotal: 0,
      fixableTotal: 0,
      licenseBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      fixableBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    },
  };

  let upgradeIssues = {} as ConstructIssuesTextOutput;
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
    upgradeIssues = constructPinText(
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
    upgradeIssues = constructUpgradesText(
      remediationInfo.upgrade,
      basicVulnInfo,
      options,
    );
  }
  if (upgradeIssues.textArray?.length > 0) {
    results.outputTextArray.push(upgradeIssues.textArray.join('\n'));
    results.counts.fixableTotal += upgradeIssues.countTotal;
    if (upgradeIssues.countBySeverity) {
      results.counts.fixableBySeverity = upgradeIssues.countBySeverity;
    }
  }

  let patchedIssues = {} as ConstructIssuesTextOutput;
  patchedIssues = constructPatchesText(
    remediationInfo.patch,
    basicVulnInfo,
    options,
  );

  if (patchedIssues.textArray?.length > 0) {
    results.outputTextArray.push(patchedIssues.textArray.join('\n'));
    results.counts.fixableTotal += patchedIssues.countTotal;
    if (patchedIssues.countBySeverity) {
      Object.keys(patchedIssues.countBySeverity).forEach((severity) => {
        if (patchedIssues.countBySeverity) {
          results.counts.fixableBySeverity[severity] +=
            patchedIssues.countBySeverity[severity];
        }
      });
    }
  }

  let unfixableIssues = {} as ConstructIssuesTextOutput;
  unfixableIssues = constructUnfixableText(
    remediationInfo.unresolved,
    basicVulnInfo,
    options,
  );

  if (unfixableIssues.textArray?.length > 0) {
    results.outputTextArray.push(unfixableIssues.textArray.join('\n'));
    results.counts.noUpgradeOrPatchCount += unfixableIssues.countTotal;
  }

  let licenseIssues = {} as ConstructIssuesTextOutput;
  licenseIssues = constructLicenseText(basicLicenseInfo, options);

  if (licenseIssues.textArray?.length > 0) {
    results.outputTextArray.push(licenseIssues.textArray.join('\n'));
    results.counts.licenseTotal += licenseIssues.countTotal;
    if (licenseIssues.countBySeverity) {
      results.counts.licenseBySeverity = licenseIssues.countBySeverity;
    }
  }

  return results;
}

function constructLicenseText(
  basicLicenseInfo: {
    [name: string]: BasicVulnInfo;
  },
  testOptions: TestOptions,
): ConstructIssuesTextOutput {
  if (!(Object.keys(basicLicenseInfo).length > 0)) {
    return {} as ConstructIssuesTextOutput;
  }

  const licenseIssues: ConstructIssuesTextOutput = {
    textArray: [],
    countTotal: 0,
    countBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };

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
    licenseIssues.textArray.push('\n' + licenseText);
    licenseIssues.countTotal += 1;
    if (licenseIssues.countBySeverity) {
      licenseIssues.countBySeverity[basicLicenseInfo[id].severity] += 1;
    }
  }
  licenseIssues.textArray.unshift(chalk.bold.green('\nLicense issues:'));

  return {
    textArray: licenseIssues.textArray,
    countTotal: licenseIssues.countTotal,
    countBySeverity: licenseIssues.countBySeverity,
  };
}

function constructPatchesText(
  patches: {
    [name: string]: PatchRemediation;
  },
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
  testOptions: TestOptions,
): ConstructIssuesTextOutput {
  if (!(Object.keys(patches).length > 0)) {
    return {} as ConstructIssuesTextOutput;
  }

  const patchedIssues: ConstructIssuesTextOutput = {
    textArray: [],
    countTotal: 0,
    countBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };

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
    patchedIssues.textArray.push(patchedText + thisPatchFixes);
    patchedIssues.countTotal += 1;
    if (patchedIssues.countBySeverity) {
      patchedIssues.countBySeverity[basicVulnInfo[id].severity] += 1;
    }
  }

  patchedIssues.textArray.unshift(chalk.bold.green('\nPatchable issues:'));

  return {
    textArray: patchedIssues.textArray,
    countTotal: patchedIssues.countTotal,
    countBySeverity: patchedIssues.countBySeverity,
  };
}

function thisUpgradeFixes(
  vulnIds: string[],
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
): ConstructIssuesTextOutput {
  const fixedIssues: ConstructIssuesTextOutput = {
    textArray: [],
    countTotal: 0,
    countBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };

  fixedIssues.textArray = vulnIds
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
    );
  fixedIssues.countTotal = fixedIssues.textArray.length;

  Object.values(SEVERITY).forEach((severity) => {
    if (fixedIssues.countBySeverity) {
      fixedIssues.countBySeverity[severity] += vulnIds
        .filter((id) => basicVulnInfo[id])
        .filter((id) => basicVulnInfo[id].type !== 'license')
        .filter((id) => basicVulnInfo[id].severity === severity).length;
    }
  });
  return fixedIssues;
}

function processUpgrades(
  sink: ConstructIssuesTextOutput,
  upgradesByDep: DependencyUpdates | DependencyPins,
  deps: string[],
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
) {
  sink.countTotal = 0;
  for (const dep of deps) {
    const data = upgradesByDep[dep];
    const upgradeDepTo = data.upgradeTo;
    const vulnIds =
      (data as UpgradeRemediation).vulns || (data as PinRemediation).vulns;
    const fixesArray = thisUpgradeFixes(vulnIds, basicVulnInfo, testOptions);
    const upgradeText = `\n  Upgrade ${chalk.bold.whiteBright(
      dep,
    )} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix\n`;
    sink.textArray.push(upgradeText + fixesArray.textArray.join('\n'));
    sink.countTotal += fixesArray.countTotal;
    if (fixesArray.countBySeverity) {
      Object.entries(fixesArray.countBySeverity).forEach(
        ([severity, count]) => {
          if (sink.countBySeverity) {
            sink.countBySeverity[severity] += count;
          }
        },
      );
    }
  }
}

function constructUpgradesText(
  upgrades: DependencyUpdates,
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
  testOptions: TestOptions,
): ConstructIssuesTextOutput {
  if (!(Object.keys(upgrades).length > 0)) {
    return {} as ConstructIssuesTextOutput;
  }

  const upgradeIssues: ConstructIssuesTextOutput = {
    textArray: [],
    countTotal: 0,
    countBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };
  processUpgrades(
    upgradeIssues,
    upgrades,
    Object.keys(upgrades),
    basicVulnInfo,
    testOptions,
  );
  upgradeIssues.textArray.unshift(
    chalk.bold.green('\n\nIssues to fix by upgrading:'),
  );
  return {
    textArray: upgradeIssues.textArray,
    countTotal: upgradeIssues.countTotal,
    countBySeverity: upgradeIssues.countBySeverity,
  };
}

function constructPinText(
  pins: DependencyPins,
  upgradesByAffected: UpgradesByAffectedPackage, // classical "remediation via top-level dep" upgrades
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
): ConstructIssuesTextOutput {
  if (!Object.keys(pins).length) {
    return {} as ConstructIssuesTextOutput;
  }

  const upgradeIssues: ConstructIssuesTextOutput = {
    textArray: [],
    countTotal: 0,
    countBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };

  // First, direct upgrades

  const upgradeables = Object.keys(pins).filter(
    (name) => !pins[name].isTransitive,
  );
  if (upgradeables.length) {
    processUpgrades(
      upgradeIssues,
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
      const fixesArray = thisUpgradeFixes(vulnIds, basicVulnInfo, testOptions);
      const upgradeText = `\n  Pin ${chalk.bold.whiteBright(
        pkgName,
      )} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix`;
      upgradeIssues.textArray.push(upgradeText);
      upgradeIssues.textArray.push(fixesArray.textArray.join('\n'));
      upgradeIssues.countTotal += fixesArray.countTotal;
      if (fixesArray.countBySeverity) {
        Object.entries(fixesArray.countBySeverity).forEach(
          ([severity, count]) => {
            if (upgradeIssues.countBySeverity) {
              upgradeIssues.countBySeverity[severity] += count;
            }
          },
        );
      }

      // Finally, if we have some upgrade paths that fix the same issues, suggest them as well.
      const topLevelUpgradesAlreadySuggested = new Set();
      for (const vid of vulnIds) {
        for (const topLevelPkg of upgradesByAffected[
          pkgName + '@' + basicVulnInfo[vid].version
        ] || []) {
          const setKey = `${topLevelPkg.name}\n${topLevelPkg.version}`;
          if (!topLevelUpgradesAlreadySuggested.has(setKey)) {
            topLevelUpgradesAlreadySuggested.add(setKey);
            upgradeIssues.textArray.push(
              '  The issues above can also be fixed by upgrading top-level dependency ' +
                `${topLevelPkg.name} to ${topLevelPkg.version}`,
            );
          }
        }
      }
    }
  }
  upgradeIssues.textArray.unshift(
    chalk.bold.green('\n\nIssues to fix by upgrading dependencies:'),
  );

  return {
    textArray: upgradeIssues.textArray,
    countTotal: upgradeIssues.countTotal,
    countBySeverity: upgradeIssues.countBySeverity,
  };
}

function constructUnfixableText(
  unresolved: IssueData[],
  basicVulnInfo: Record<string, BasicVulnInfo>,
  testOptions: TestOptions,
): ConstructIssuesTextOutput {
  if (!(unresolved.length > 0)) {
    return {} as ConstructIssuesTextOutput;
  }
  const unfixableIssuesTextArray: string[] = [];
  let unfixableCount = 0;
  for (const issue of unresolved) {
    const issueInfo = basicVulnInfo[issue.id];
    if (!issueInfo) {
      // basicVulnInfo only contains issues with the specified severity levels
      continue;
    }

    const extraInfo =
      issue.fixedIn && issue.fixedIn.length
        ? `\n  This issue was fixed in versions: ${chalk.bold(
            issue.fixedIn.join(', '),
          )}`
        : '\n  No upgrade or patch available';
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
    unfixableCount += 1;
  }

  unfixableIssuesTextArray.unshift(
    chalk.bold.white('\nIssues with no direct upgrade or patch:'),
  );

  if (unfixableIssuesTextArray.length === 1) {
    // seems we still only have
    // the initial section title, so nothing to return
    return {} as ConstructIssuesTextOutput;
  }

  return {
    textArray: unfixableIssuesTextArray,
    countTotal: unfixableCount,
  };
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
      `  ${icon.ISSUE} ${chalk.bold(title)}${newBadge} [${titleCaseText(
        severity,
      )} Severity${originalSeverityStr}]`,
    ) +
    reachabilityText +
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
