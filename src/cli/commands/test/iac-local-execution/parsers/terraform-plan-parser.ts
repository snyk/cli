import {
  EngineType,
  IacFileData,
  IacFileParsed,
  TerraformPlanJson,
  TerraformPlanResource,
  ResourceActions,
  VALID_RESOURCE_ACTIONS,
  TerraformScanInput,
  TerraformPlanResourceChange,
  IaCErrorCodes,
} from '../types';
import { CustomError } from '../../../../../lib/errors';

function terraformPlanReducer(
  scanInput: TerraformScanInput,
  resource: TerraformPlanResource,
): TerraformScanInput {
  // TODO: investigate if this reduction logic covers all edge-cases (nested modules, similar names, etc')
  const { type, name, mode, index, values } = resource;
  const inputKey: keyof TerraformScanInput =
    mode === 'data' ? 'data' : 'resource';
  if (scanInput[inputKey][type]) {
    // add new resources of the same type with different names
    scanInput[inputKey][type][index !== undefined ? `${name}_${index}` : name] =
      values || {};
  } else {
    // add a new resource type
    scanInput[inputKey][type] = { [name]: values };
  }

  return scanInput;
}

function resourceChangeReducer(
  scanInput: TerraformScanInput,
  resource: TerraformPlanResourceChange,
): TerraformScanInput {
  // TODO: investigate if we need to address also `after_unknown` field.
  const { actions, after } = resource.change || { actions: [], after: {} };
  if (isValidResourceActions(actions)) {
    const resourceForReduction = { ...resource, values: after || {} };
    return terraformPlanReducer(scanInput, resourceForReduction);
  }

  return scanInput;
}

function isValidResourceActions(action: ResourceActions): boolean {
  return VALID_RESOURCE_ACTIONS.some((validAction: string[]) => {
    if (action.length !== validAction.length) {
      return false;
    }
    return validAction.every(
      (field: string, idx: number) => action[idx] === field,
    );
  });
}

function extractRootModuleResources(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanResource> {
  return terraformPlanJson.planned_values?.root_module?.resources || [];
}

function extractChildModulesResources(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanResource> {
  const childModules =
    terraformPlanJson?.planned_values?.root_module?.child_modules || [];
  const extractedChildModuleResources: Array<TerraformPlanResource> = [];
  childModules.forEach((childModule) =>
    childModule.resources.forEach((resource) =>
      extractedChildModuleResources.push(resource),
    ),
  );
  return extractedChildModuleResources;
}

function extractResourceChanges(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanResourceChange> {
  return terraformPlanJson.resource_changes || [];
}

function extractResourcesForFullScan(
  terraformPlanJson: TerraformPlanJson,
): TerraformScanInput {
  const rootModuleResources = extractRootModuleResources(terraformPlanJson);
  const childModuleResources = extractChildModulesResources(terraformPlanJson);
  return [
    ...rootModuleResources,
    ...childModuleResources,
  ].reduce(terraformPlanReducer, { resource: {}, data: {} });
}

function extractResourcesForDeltaScan(
  terraformPlanJson: TerraformPlanJson,
): TerraformScanInput {
  const resourceChanges = extractResourceChanges(terraformPlanJson);
  return resourceChanges.reduce(resourceChangeReducer, {
    resource: {},
    data: {},
  });
}

export function isTerraformPlan(terraformPlanJson: TerraformPlanJson): boolean {
  const missingRequiredFields =
    !terraformPlanJson.planned_values?.root_module ||
    terraformPlanJson.resource_changes === undefined;
  return !missingRequiredFields;
}

export function tryParsingTerraformPlan(
  terraformPlanFile: IacFileData,
  terraformPlanJson: TerraformPlanJson,
  { isFullScan }: { isFullScan: boolean } = { isFullScan: false },
): Array<IacFileParsed> {
  try {
    const scannableInput = isFullScan
      ? extractResourcesForFullScan(terraformPlanJson)
      : extractResourcesForDeltaScan(terraformPlanJson);

    return [
      {
        ...terraformPlanFile,
        jsonContent: scannableInput,
        engineType: EngineType.Terraform,
      },
    ];
  } catch (err) {
    throw new FailedToExtractResourcesInTerraformPlanError();
  }
}

// This error is due to the complex reduction logic, so it catches scenarios we might have not covered.
export class FailedToExtractResourcesInTerraformPlanError extends CustomError {
  constructor(message?: string) {
    super(
      message || 'Failed to extract resources from Terraform plan JSON file',
    );
    this.code = IaCErrorCodes.FailedToExtractResourcesInTerraformPlanError;
    this.userMessage =
      'We failed to extract resource changes from the Terraform plan file, please contact support@snyk.io, if possible with a redacted version of the file';
  }
}
