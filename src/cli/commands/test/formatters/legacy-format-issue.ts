const uniq = require('lodash.uniq');
import chalk from 'chalk';
import * as config from '../../../../lib/config';
import { Options, TestOptions, ShowVulnPaths } from '../../../../lib/types';
import { isLocalFolder } from '../../../../lib/detect';
import { parsePackageString as snykModule } from 'snyk-module';
import {
  WIZARD_SUPPORTED_PACKAGE_MANAGERS,
  PINNING_SUPPORTED_PACKAGE_MANAGERS,
  SupportedPackageManagers,
} from '../../../../lib/package-managers';
import {
  GroupedVuln,
  AnnotatedIssue,
  DockerIssue,
  SEVERITY,
} from '../../../../lib/snyk-test/legacy';
import { formatLegalInstructions } from './legal-license-instructions';
import { getReachabilityText } from './format-reachability';
import { PATH_SEPARATOR } from '../../constants';
import { getLegacySeveritiesColour } from '../../../../lib/snyk-test/common';

export function formatIssues(
  vuln: GroupedVuln,
  options: Options & TestOptions,
) {
  const vulnID = vuln.list[0].id;
  const packageManager = options.packageManager!;
  const localPackageTest = isLocalFolder(options.path);
  const uniquePackages = uniq(
    vuln.list.map((i) => {
      if (i.from[1]) {
        return i.from && i.from[1];
      }
      return i.from;
    }),
  ).join(', ');

  const vulnOutput = {
    issueHeading: createSeverityBasedIssueHeading({
      severity: vuln.metadata.severity,
      originalSeverity: vuln.originalSeverity,
      type: vuln.metadata.type,
      packageName: vuln.metadata.name,
      isNew: false,
    }),
    introducedThrough: '  Introduced through: ' + uniquePackages,
    description: '  Description: ' + vuln.title,
    info: '  Info: ' + chalk.underline(config.ROOT + '/vuln/' + vulnID),
    fromPaths: createTruncatedVulnsPathsText(vuln.list, options.showVulnPaths),
    extraInfo: vuln.note ? chalk.bold('\n  Note: ' + vuln.note) : '',
    remediationInfo:
      vuln.metadata.type !== 'license' && localPackageTest
        ? createRemediationText(vuln, packageManager)
        : '',
    fixedIn: options.docker ? createFixedInText(vuln) : '',
    dockerfilePackage: options.docker ? dockerfileInstructionText(vuln) : '',
    legalInstructions: vuln.legalInstructionsArray
      ? chalk.bold('\n  Legal instructions:\n') +
        ' '.repeat(2) +
        formatLegalInstructions(vuln.legalInstructionsArray, 2)
      : '',
    reachability: vuln.reachability ? createReachabilityInText(vuln) : '',
  };

  return (
    `${vulnOutput.issueHeading}\n` +
    `${vulnOutput.description}\n` +
    `${vulnOutput.info}\n` +
    `${vulnOutput.introducedThrough}\n` +
    vulnOutput.fromPaths +
    // Optional - not always there
    vulnOutput.reachability +
    vulnOutput.remediationInfo +
    vulnOutput.dockerfilePackage +
    vulnOutput.fixedIn +
    vulnOutput.extraInfo +
    vulnOutput.legalInstructions
  );
}

type CreateSeverityBasedIssueHeading = {
  severity: SEVERITY;
  originalSeverity?: SEVERITY;
  type: string;
  packageName: string;
  isNew: boolean;
};

function createSeverityBasedIssueHeading({
  severity,
  originalSeverity,
  type,
  packageName,
  isNew,
}: CreateSeverityBasedIssueHeading) {
  // Example: ✗ Medium severity vulnerability found in xmldom
  const vulnTypeText = type === 'license' ? 'issue' : 'vulnerability';
  const severityColor = getLegacySeveritiesColour(severity);

  let originalSeverityStr = '';
  if (originalSeverity && originalSeverity !== severity) {
    originalSeverityStr = ` (originally ${titleCaseText(originalSeverity)})`;
  }

  return (
    severityColor.colorFunc(
      '✗ ' +
        titleCaseText(severity) +
        ` severity${originalSeverityStr} ` +
        vulnTypeText +
        ' found in ' +
        chalk.underline(packageName),
    ) + chalk.bold.magenta(isNew ? ' (new)' : '')
  );
}

export function titleCaseText(text) {
  return text[0].toUpperCase() + text.slice(1);
}

function dockerfileInstructionText(vuln) {
  if (vuln.dockerfileInstruction) {
    JSON.stringify(vuln.dockerfileInstruction);
    return `\n  Image layer: '${vuln.dockerfileInstruction}'`;
  }

  if (vuln.dockerBaseImage) {
    return `\n  Image layer: Introduced by your base image (${vuln.dockerBaseImage})`;
  }

  return '';
}
function createTruncatedVulnsPathsText(
  vulnList: AnnotatedIssue[],
  show: ShowVulnPaths,
) {
  if (show === 'none') {
    return '';
  }
  const numberOfPathsToDisplay = show === 'all' ? 1000 : 3;
  const fromPathsArray = vulnList.map((i) => i.from);

  const formatedFromPathsArray = fromPathsArray.map((i) => {
    const fromWithoutBaseProject = i.slice(1);
    // If more than one From path
    if (fromWithoutBaseProject.length) {
      return i.slice(1).join(PATH_SEPARATOR);
    }
    // Else issue is in the core package
    return i;
  });

  const notShownPathsNumber = fromPathsArray.length - numberOfPathsToDisplay;
  const shouldTruncatePaths = fromPathsArray.length > numberOfPathsToDisplay;
  const truncatedText = `\n  and ${notShownPathsNumber} more...`;
  const formattedPathsText = formatedFromPathsArray
    .slice(0, numberOfPathsToDisplay)
    .join('\n  From: ');

  if (fromPathsArray.length > 0) {
    return (
      '  From: ' +
      formattedPathsText +
      (shouldTruncatePaths ? truncatedText : '')
    );
  }
}

function createFixedInText(vuln: GroupedVuln): string {
  if ((vuln as DockerIssue).nearestFixedInVersion) {
    return chalk.bold(
      '\n  Fixed in: ' + (vuln as DockerIssue).nearestFixedInVersion,
    );
  } else if (vuln.fixedIn && vuln.fixedIn.length > 0) {
    return chalk.bold('\n  Fixed in: ' + vuln.fixedIn.join(', '));
  }

  return '';
}

function createReachabilityInText(vuln: GroupedVuln): string {
  if (!vuln.reachability) {
    return '';
  }
  const reachabilityText = getReachabilityText(vuln.reachability);
  if (!reachabilityText) {
    return '';
  }
  return `\n  Reachability: ${reachabilityText}`;
}

function createRemediationText(
  vuln: GroupedVuln,
  packageManager: SupportedPackageManagers,
): string {
  let wizardHintText = '';
  if (WIZARD_SUPPORTED_PACKAGE_MANAGERS.includes(packageManager)) {
    wizardHintText = 'Run `snyk wizard` to explore remediation options.';
  }

  if (
    vuln.fixedIn &&
    PINNING_SUPPORTED_PACKAGE_MANAGERS.includes(packageManager)
  ) {
    const toVersion = vuln.fixedIn.join(' or ');
    const transitive = vuln.list.every((i) => i.from.length > 2);
    const fromVersionArray = vuln.list.map((v) => v.from[1]);
    const fromVersion = fromVersionArray[0];
    if (transitive) {
      return chalk.bold(
        `\n  Remediation:\n    Pin the transitive dependency ${vuln.name} to version ${toVersion}`,
      );
    } else {
      return chalk.bold(
        `\n  Remediation:\n    Upgrade direct dependency ${fromVersion} to ${vuln.name}@${toVersion}`,
      );
    }
  }

  if (vuln.isFixable === true) {
    const upgradePathsArray = uniq(
      vuln.list.map((v) => {
        const shouldUpgradeItself = !!v.upgradePath[0];
        const shouldUpgradeDirectDep = !!v.upgradePath[1];

        if (shouldUpgradeItself) {
          // If we are testing a library/package like express
          // Then we can suggest they get the latest version
          // Example command: snyk test express@3
          const selfUpgradeInfo =
            v.upgradePath.length > 0
              ? ` (triggers upgrades to ${v.upgradePath.join(PATH_SEPARATOR)})`
              : '';
          const testedPackageName = snykModule(v.upgradePath[0] as string);
          return (
            `You've tested an outdated version of ${testedPackageName[0]}.` +
            +` Upgrade to ${v.upgradePath[0]}${selfUpgradeInfo}`
          );
        }
        if (shouldUpgradeDirectDep) {
          const formattedUpgradePath = v.upgradePath
            .slice(1)
            .join(PATH_SEPARATOR);
          const upgradeTextInfo = v.upgradePath.length
            ? ` (triggers upgrades to ${formattedUpgradePath})`
            : '';

          return `Upgrade direct dependency ${v.from[1]} to ${v.upgradePath[1]}${upgradeTextInfo}`;
        }

        return (
          'Some paths have no direct dependency upgrade that' +
          ` can address this issue. ${wizardHintText}`
        );
      }),
    );
    return chalk.bold(
      `\n  Remediation:\n    ${upgradePathsArray.join('\n    ')}`,
    );
  }

  if (vuln.fixedIn && vuln.fixedIn.length > 0) {
    return createFixedInText(vuln);
  }

  return '';
}
