import fs from 'fs';
import path from 'path';
import { IacFileData } from '../../../../src/cli/commands/test/iac-local-execution/types';

export enum PlanOutputCase {
  Create = 'tf-plan-create', // plan with create actions
  Destroy = 'tf-plan-destroy', // plan with destroy actions
  NoOp = 'tf-plan-no-op', // plan with no-op actions
  Update = 'tf-plan-update', // plan with updates actions
}

export function getTfPlanData(planOutputCase: PlanOutputCase) {
  const tfPlanFile = fs.readFileSync(
    path.resolve(
      __dirname,
      `../../../fixtures/iac/terraform-plan/${planOutputCase}.json`,
    ),
  );

  const iacFileData: IacFileData = {
    fileContent: tfPlanFile.toString(),
    filePath: 'dont-care',
    fileType: 'json',
  };

  return iacFileData;
}

export function getExpectedResult(
  isFullScan: boolean,
  planOutputCase: PlanOutputCase,
) {
  const tfPlanExpectedResources = JSON.parse(
    fs
      .readFileSync(
        path.resolve(
          __dirname,
          `../../../fixtures/iac/terraform-plan/expected-parser-results/${
            isFullScan ? 'full-scan' : 'delta-scan'
          }/${planOutputCase}.resources.json`,
        ),
      )
      .toString(),
  );

  return tfPlanExpectedResources;
}

// For regression testing
type ScanModeTestCase = [{ isFullScan: boolean }];
type PlanOutputTestCase = [PlanOutputCase];
export const scanModeCases: ScanModeTestCase[] = [
  [{ isFullScan: false }],
  [{ isFullScan: true }],
];
export const planOutputCases: PlanOutputTestCase[] = [
  [PlanOutputCase.Create],
  [PlanOutputCase.Destroy],
  [PlanOutputCase.NoOp],
  [PlanOutputCase.Update],
];
