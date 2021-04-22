import { tryParsingTerraformPlan } from '../../../../src/cli/commands/test/iac-local-execution/parsers/terraform-plan-parser';
import {
  iacFileData,
  terraformPlanJson,
  iacFileDataNoChildModules,
  expectedParsingResultFullScan,
  expectedParsingResultDeltaScan,
  expectedParsingResultWithoutChildModules,
  terraformPlanNoChildModulesJson,
} from './terraform-plan-parser.fixtures';
import { EngineType } from '../../../../src/cli/commands/test/iac-local-execution/types';

describe('tryParsingTerraformPlan', () => {
  describe('full scan', () => {
    it('returns the expected resources', () => {
      const parsedTerraformPlan = tryParsingTerraformPlan(
        iacFileData,
        terraformPlanJson,
        { isFullScan: true },
      );
      expect(parsedTerraformPlan[0]).toEqual({
        ...iacFileData,
        engineType: EngineType.Terraform,
        jsonContent: expectedParsingResultFullScan,
      });
    });

    it('does not fail if no child-modules are present', () => {
      const parsedTerraformPlan = tryParsingTerraformPlan(
        iacFileDataNoChildModules,
        terraformPlanNoChildModulesJson,
        { isFullScan: true },
      );
      expect(parsedTerraformPlan[0]).toEqual({
        ...iacFileDataNoChildModules,
        engineType: EngineType.Terraform,
        jsonContent: expectedParsingResultWithoutChildModules,
      });
    });
  });

  describe('default delta scan', () => {
    it('returns the expected resources', () => {
      const parsedTerraformPlan = tryParsingTerraformPlan(
        iacFileData,
        terraformPlanJson,
      );
      expect(parsedTerraformPlan[0]).toEqual({
        ...iacFileData,
        engineType: EngineType.Terraform,
        jsonContent: expectedParsingResultDeltaScan,
      });
    });
  });

  // TODO: add test for extracting a resource from a data input source
  // deferred as it required to re-generate a new wasm fixture with a rule that applies to a data-source
});
