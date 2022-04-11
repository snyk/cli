import { IacCustomPolicies, IacFileScanResult } from '../types';
import _ = require('lodash');
import { SEVERITY } from '../../../../../../lib/snyk-test/common';

export async function applyCustomSeverities(
  scannedFiles: IacFileScanResult[],
  customPolicies: IacCustomPolicies,
): Promise<IacFileScanResult[]> {
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
