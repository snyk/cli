import { LegalInstruction, SEVERITY } from "../../lib/snyk-test/legacy";

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
  severityReason?: string;
  userNote?: string;
  appliedPolicyRules?: AppliedPolicyRules;
}

export interface AppliedPolicyRules {
  annotation?: {
    value: string;
    reason?: string;
  };
  severityChange?: {
    newSeverity?: SEVERITY;
    originalSeverity?: SEVERITY;
    reason?: string;
  };
  ignore?: {
    path: string[];
    source?: string;
    created: string;
    expires?: string;
    reason: string;
    disregardIfFixable: boolean;
    reasonType: string;
  };
}

interface TopLevelPackageUpgrade {
  name: string;
  version: string;
}

export interface UpgradesByAffectedPackage {
  [pkgNameAndVersion: string]: TopLevelPackageUpgrade[];
}
