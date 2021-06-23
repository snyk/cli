import { tryParsingTerraformPlan } from '../../../../src/cli/commands/test/iac-local-execution/parsers/terraform-plan-parser';
import {
  getExpectedResult,
  getTfPlanData,
  scanModeCases,
  planOutputCases,
} from './terraform-plan-parser.fixtures';
import {
  EngineType,
  TerraformPlanJson,
} from '../../../../src/cli/commands/test/iac-local-execution/types';

describe('tryParsingTerraformPlan', () => {
  /* 
    This are regression tests that iterate on major real terraform plan outputs.
    Used Plan cases are:
    1. Plan which creates new resources
    2. Plan which deletes resources
    3. Plan which doesn't do anything
    4. Plan which updates resources
    These tests validate that the correct resources are being extracted, based on the give scan mode (Full/Delta).
    These tests do not cover scanning for finding vulnerabilites, but only for the resource extraction logic.
  **/
  describe('Parsing regression testing', () => {
    describe.each(scanModeCases)('if: %p', (scanOptions) => {
      test.each(planOutputCases)(
        'for %p, it extracts the expected resources',
        (planOutputType) => {
          // Arrange
          const iacFileData = getTfPlanData(planOutputType);
          const expectedResources = getExpectedResult(
            scanOptions.isFullScan,
            planOutputType,
          );
          const terraformPlanJson: TerraformPlanJson = JSON.parse(
            iacFileData.fileContent,
          );

          // Act
          const parsedTerraformPlan = tryParsingTerraformPlan(
            iacFileData,
            terraformPlanJson,
            scanOptions,
          );

          console.debug(
            `scanOptions.isFullScan: ${scanOptions.isFullScan} && planOutputType: ${planOutputType}`,
          );

          // Assert
          expect(parsedTerraformPlan[0]).toEqual({
            ...iacFileData,
            engineType: EngineType.Terraform,
            jsonContent: expectedResources,
          });
        },
      );
    });
  });
});
