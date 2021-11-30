import mockFs from 'mock-fs';
import path from 'path';
import {
  scanFiles,
  clearPolicyEngineCache,
} from '../../../../src/cli/commands/test/iac-local-execution/file-scanner';
import { LOCAL_POLICY_ENGINE_DIR } from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import { IacFileParsed } from '../../../../src/cli/commands/test/iac-local-execution/types';

import {
  paresdKubernetesFileStub,
  parsedTerraformFileStub,
  parsedArmFileStub,
  expectedViolatedPoliciesForK8s,
  expectedViolatedPoliciesForTerraform,
  expectedViolatedPoliciesForArm,
} from './file-scanner.fixtures';

describe('scanFiles', () => {
  const parsedFiles: Array<IacFileParsed> = [
    paresdKubernetesFileStub,
    parsedTerraformFileStub,
    parsedArmFileStub,
  ];

  afterEach(() => {
    mockFs.restore();
    clearPolicyEngineCache();
  });

  describe('with parsed files', () => {
    it('returns the expected violated policies', async () => {
      mockFs({
        [path.resolve(
          __dirname,
          path.join('../../../..', LOCAL_POLICY_ENGINE_DIR),
        )]: mockFs.load(
          path.resolve(
            __dirname,
            path.join('../../../smoke', LOCAL_POLICY_ENGINE_DIR),
          ),
        ),
      });

      const scanResults = await scanFiles(parsedFiles);
      expect(scanResults[0].violatedPolicies).toEqual(
        expectedViolatedPoliciesForK8s,
      );
      expect(scanResults[1].violatedPolicies).toEqual(
        expectedViolatedPoliciesForTerraform,
      );
      expect(scanResults[2].violatedPolicies).toEqual(
        expectedViolatedPoliciesForArm,
      );
    });

    // TODO: Extract policy engine & the cache mechanism, test them separately.
  });

  describe('missing policy engine wasm files', () => {
    it('throws an error', async () => {
      mockFs({
        [path.resolve(
          __dirname,
          path.join('../../../..', LOCAL_POLICY_ENGINE_DIR),
        )]: {},
      });

      await expect(scanFiles(parsedFiles)).rejects.toThrow();
    });
  });
});
