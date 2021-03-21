import {
  EngineType,
  IacFileData,
  IacFileParsed,
  TerraformPlanJson,
  TerraformPlanResource,
  VALID_RESOURCE_ACTIONS,
  TerraformScanInput,
  TerraformPlanResourceChange,
} from '../types';

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
  // TODO: investigate if we need to adress also `after_unknown` field.
  const { actions, after } = resource.change || { actions: [], after: {} };
  if (actions.some((action) => VALID_RESOURCE_ACTIONS.includes(action))) {
    const resourceForReduction = { ...resource, values: after || {} };
    return terraformPlanReducer(scanInput, resourceForReduction);
  }

  return scanInput;
}

function extractRootModuleResources(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanResource> {
  return terraformPlanJson?.planned_values?.root_module?.resources || [];
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
  return terraformPlanJson?.resource_changes || [];
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

export function tryParsingTerraformPlan(
  terraformPlanFile: IacFileData,
  isFullScan = false,
): Array<IacFileParsed> {
  let terraformPlanJson;
  try {
    terraformPlanJson = JSON.parse(
      terraformPlanFile.fileContent,
    ) as TerraformPlanJson;
  } catch (err) {
    throw new Error('Failed to parse Terraform plan JSON file.');
  }
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
    throw new Error(
      'Failed to extract resources from Terraform plan JSON file.',
    );
  }
}
