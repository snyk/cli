import { IacFileScanResult } from '../types';
import { getIacOrgSettings } from './get-iac-org-settings';
import _ = require('lodash');
import { SEVERITY } from '../../../../../lib/snyk-test/common';

export async function applyCustomSeverities(
  scannedFiles: IacFileScanResult[],
): Promise<IacFileScanResult[]> {
  const iacOrgSettings = await getIacOrgSettings();
  const customPolicies = iacOrgSettings.customPolicies;

  if (Object.keys(customPolicies).length > 0) {
    return scannedFiles.map((file) => {
      const updatedScannedFiles = _.cloneDeep(file);
      updatedScannedFiles.violatedPolicies.forEach((existingPolicy) => {
        const customPolicyForPublicID = customPolicies[existingPolicy.publicId];
        if (customPolicyForPublicID) {
          existingPolicy.severity =
            (customPolicyForPublicID.severity as SEVERITY) ??
            existingPolicy.severity;
        }
      });
      return updatedScannedFiles;
    });
  }
  return scannedFiles;
}
