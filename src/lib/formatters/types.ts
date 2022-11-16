import { LegalInstruction, SEVERITY } from '../../lib/snyk-test/legacy';

export interface BasicVulnInfo {
  type: string;
  title: string;
  severity: SEVERITY;
  originalSeverity?: SEVERITY;
  isNew: boolean;
  name: string;
  version: string;
  fixedIn: string[];
  legalInstructions?: LegalInstruction[];
  paths: string[][];
  note: string | false;
}

interface TopLevelPackageUpgrade {
  name: string;
  version: string;
}

export interface UpgradesByAffectedPackage {
  [pkgNameAndVersion: string]: TopLevelPackageUpgrade[];
}

export type FormattedIssuesCounts = {
  noUpgradeOrPatchCount: number;
  licenseTotal: number;
  fixableTotal: number;
  licenseBySeverity: { [severity in SEVERITY]: number };
  fixableBySeverity: { [severity in SEVERITY]: number };
};

export type FormattedIssuesWithRemediation = {
  outputTextArray: string[];
  counts: FormattedIssuesCounts;
};
