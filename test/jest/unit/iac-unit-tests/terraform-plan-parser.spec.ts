import { tryParsingTerraformPlan } from '../../../../src/cli/commands/test/iac-local-execution/parsers/terraform-plan-parser';
import {
  iacFileData,
  invalidJsonIacFile,
  iacFileDataNoChildModules,
  expectedParsingResult,
  expectedParsingResultWithoutChildModules,
} from './terraform-plan-parser.fixtures';
import { EngineType } from '../../../../src/cli/commands/test/iac-local-execution/types';

describe('tryParsingTerraformPlan', () => {
  it('throws an error for invalid JSON', () => {
    expect(() => tryParsingTerraformPlan(invalidJsonIacFile)).toThrowError(
      'Failed to parse Terraform plan JSON file.',
    );
  });

  it('returns the expected resources', () => {
    const parsedTerraformPlan = tryParsingTerraformPlan(iacFileData);
    expect(parsedTerraformPlan[0]).toEqual({
      ...iacFileData,
      engineType: EngineType.Terraform,
      jsonContent: expectedParsingResult,
    });
  });

  it('does not fail if no child-modules are present', () => {
    const parsedTerraformPlan = tryParsingTerraformPlan(
      iacFileDataNoChildModules,
    );
    expect(parsedTerraformPlan[0]).toEqual({
      ...iacFileDataNoChildModules,
      engineType: EngineType.Terraform,
      jsonContent: expectedParsingResultWithoutChildModules,
    });
  });

  // TODO: add test for extracting a resource from a data input source
  // deferred as it required to re-generate a new wasm fixture with a rule that applies to a data-source
});
