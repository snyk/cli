import {
  tryParsingTerraformPlan,
  FailedToParseTerraformPlanJsonError,
  FailedToExtractResourcesInTerraformPlanError,
  MissingRequiredFieldsInTerraformPlanError,
} from '../../../../src/cli/commands/test/iac-local-execution/parsers/terraform-plan-parser';
import {
  iacFileData,
  invalidJsonIacFile,
  iacFileDataNoChildModules,
  iacFileDataWithoutRootModule,
  iacFileDataWithoutResourceChanges,
  expectedParsingResultFullScan,
  expectedParsingResultDeltaScan,
  expectedParsingResultWithoutChildModules,
} from './terraform-plan-parser.fixtures';
import { EngineType } from '../../../../src/cli/commands/test/iac-local-execution/types';

describe('tryParsingTerraformPlan', () => {
  it('throws an error for invalid JSON', () => {
    expect(() => tryParsingTerraformPlan(invalidJsonIacFile)).toThrowError(
      FailedToParseTerraformPlanJsonError,
    );
  });

  describe('full scan', () => {
    it('returns the expected resources', () => {
      const parsedTerraformPlan = tryParsingTerraformPlan(iacFileData, {
        isFullScan: true,
      });
      expect(parsedTerraformPlan[0]).toEqual({
        ...iacFileData,
        engineType: EngineType.Terraform,
        jsonContent: expectedParsingResultFullScan,
      });
    });

    it('does not fail if no child-modules are present', () => {
      const parsedTerraformPlan = tryParsingTerraformPlan(
        iacFileDataNoChildModules,
        { isFullScan: true },
      );
      expect(parsedTerraformPlan[0]).toEqual({
        ...iacFileDataNoChildModules,
        engineType: EngineType.Terraform,
        jsonContent: expectedParsingResultWithoutChildModules,
      });
    });

    it('throws an error for missing required fields', () => {
      expect(() =>
        tryParsingTerraformPlan(iacFileDataWithoutRootModule, {
          isFullScan: true,
        }),
      ).toThrowError(MissingRequiredFieldsInTerraformPlanError);
    });
  });

  describe('default delta scan', () => {
    it('returns the expected resources', () => {
      const parsedTerraformPlan = tryParsingTerraformPlan(iacFileData);
      expect(parsedTerraformPlan[0]).toEqual({
        ...iacFileData,
        engineType: EngineType.Terraform,
        jsonContent: expectedParsingResultDeltaScan,
      });
    });

    it('throws an error for missing required fields', () => {
      expect(() =>
        tryParsingTerraformPlan(iacFileDataWithoutResourceChanges),
      ).toThrowError(MissingRequiredFieldsInTerraformPlanError);
    });
  });

  // TODO: add test for extracting a resource from a data input source
  // deferred as it required to re-generate a new wasm fixture with a rule that applies to a data-source
});
