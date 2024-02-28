import * as path from 'path';
import {
  clearPolicyEngineCache,
  scanFiles,
  validateResultFromCustomRules,
} from '../../../../src/cli/commands/test/iac/local-execution/file-scanner';
import * as localCacheModule from '../../../../src/cli/commands/test/iac/local-execution/local-cache';
import {
  EngineType,
  IacFileParsed,
  IacFileScanResult,
} from '../../../../src/cli/commands/test/iac/local-execution/types';

import {
  expectedViolatedPoliciesForArm,
  expectedViolatedPoliciesForK8s,
  expectedViolatedPoliciesForTerraform,
  paresdKubernetesFileStub,
  parsedArmFileStub,
  parsedTerraformFileStub,
} from './file-scanner.fixtures';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';
import { IacProjectType } from '../../../../src/lib/iac/constants';

describe('scanFiles', () => {
  const parsedFiles: Array<IacFileParsed> = [
    paresdKubernetesFileStub,
    parsedTerraformFileStub,
    parsedArmFileStub,
  ];

  afterEach(() => {
    clearPolicyEngineCache();
  });

  describe('with parsed files', () => {
    it('returns the expected violated policies', async () => {
      const policyEngineCoreDataPath = path.resolve(
        __dirname,
        path.normalize('../../../smoke/.iac-data'),
      );
      const policyEngineMetaDataPath = path.resolve(
        __dirname,
        path.normalize('../../../smoke/.iac-data'),
      );

      const spy = jest
        .spyOn(localCacheModule, 'getLocalCachePath')
        .mockImplementation((engineType: EngineType) => {
          switch (engineType) {
            case EngineType.Kubernetes:
              return [
                `${policyEngineCoreDataPath}/k8s_policy.wasm`,
                `${policyEngineMetaDataPath}/k8s_data.json`,
              ];
            case EngineType.Terraform:
              return [
                `${policyEngineCoreDataPath}/tf_policy.wasm`,
                `${policyEngineMetaDataPath}/tf_data.json`,
              ];
            case EngineType.CloudFormation:
              return [
                `${policyEngineCoreDataPath}/cloudformation_policy.wasm`,
                `${policyEngineMetaDataPath}/cloudformation_data.json`,
              ];
            case EngineType.ARM:
              return [
                `${policyEngineCoreDataPath}/arm_policy.wasm`,
                `${policyEngineMetaDataPath}/arm_data.json`,
              ];
            default:
              return [];
          }
        });

      const { scannedFiles } = await scanFiles(parsedFiles);
      expect(scannedFiles[0].violatedPolicies).toEqual(
        expectedViolatedPoliciesForK8s,
      );
      expect(scannedFiles[1].violatedPolicies).toEqual(
        expectedViolatedPoliciesForTerraform,
      );
      expect(scannedFiles[2].violatedPolicies).toEqual(
        expectedViolatedPoliciesForArm,
      );
      spy.mockReset();
    });
    // TODO: Extract policy engine & the cache mechanism, test them separately.
  });

  describe('missing policy engine wasm files', () => {
    it('throws an error', async () => {
      await expect(scanFiles(parsedFiles)).rejects.toThrow();
    });
  });
});

describe('validateResultFromCustomRules', () => {
  const result: IacFileScanResult = {
    filePath: 'path/to/file',
    fileType: 'tf',
    jsonContent: {},
    fileContent: '',
    projectType: IacProjectType.CUSTOM,
    engineType: EngineType.Custom,
    violatedPolicies: [
      {
        publicId: 'CUSTOM-RULE-VALID',
        subType: '',
        title: '',
        severity: SEVERITY.LOW,
        msg: 'input.resource',
        issue: '',
        impact: '',
        resolve: '',
        references: [],
      },
      {
        publicId: 'CUSTOM-RULE-INVALID-SEVERITY',
        subType: '',
        title: '',
        severity: 'none',
        msg: 'input.resource',
        issue: '',
        impact: '',
        resolve: '',
        references: [],
      },
      {
        publicId: 'custom-rule-invalid-lowercase-publicid',
        subType: '',
        title: '',
        severity: SEVERITY.LOW,
        msg: 'input.resource',
        issue: '',
        impact: '',
        resolve: '',
        references: [],
      },
      {
        publicId: 'SNYK-CC-CUSTOM-RULE-INVALID',
        subType: '',
        title: '',
        severity: SEVERITY.LOW,
        msg: 'input.resource',
        issue: '',
        impact: '',
        resolve: '',
        references: [],
      },
    ],
  };

  it('does not filter out valid policies', () => {
    const { validatedResult, invalidIssues } = validateResultFromCustomRules(
      result,
    );
    expect(validatedResult.violatedPolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publicId: 'CUSTOM-RULE-VALID' }),
      ]),
    );
    expect(invalidIssues.length).toEqual(3);
  });

  it('filters out policies with invalid severity', () => {
    const { validatedResult, invalidIssues } = validateResultFromCustomRules(
      result,
    );
    expect(validatedResult.violatedPolicies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publicId: 'CUSTOM-RULE-INVALID-SEVERITY' }),
      ]),
    );
    expect(invalidIssues.length).toEqual(3);
    expect(invalidIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failureReason:
            'Invalid severity level for custom rule CUSTOM-RULE-INVALID-SEVERITY. Change to low, medium, high, or critical',
        }),
      ]),
    );
  });

  it('filters out policies with lowercase publicId', () => {
    const { validatedResult, invalidIssues } = validateResultFromCustomRules(
      result,
    );
    expect(validatedResult.violatedPolicies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          publicId: 'custom-rule-invalid-lowercase-publicid',
        }),
      ]),
    );
    expect(invalidIssues.length).toEqual(3);
    expect(invalidIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failureReason:
            'Invalid non-uppercase publicId for custom rule custom-rule-invalid-lowercase-publicid. Change to CUSTOM-RULE-INVALID-LOWERCASE-PUBLICID',
        }),
      ]),
    );
  });

  it('filters out policies with conflicting publicId', () => {
    const { validatedResult, invalidIssues } = validateResultFromCustomRules(
      result,
    );
    expect(validatedResult.violatedPolicies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publicId: 'SNYK-CC-CUSTOM-RULE-INVALID' }),
      ]),
    );
    expect(invalidIssues.length).toEqual(3);
    expect(invalidIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failureReason:
            'Invalid publicId for custom rule SNYK-CC-CUSTOM-RULE-INVALID. Change to a publicId that does not start with SNYK-CC-',
        }),
      ]),
    );
  });
});
