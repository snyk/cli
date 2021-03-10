import {
  EngineType,
  IacFileData,
  IacFileParsed,
  TerraformPlanJson,
  TerraformPlanResource,
  TerraformScanInput,
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

function extractRootModuleResources(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanResource> {
  return terraformPlanJson?.planned_values?.root_module?.resources;
}

function extractChildModulesResources(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanResource> {
  const childModules =
    terraformPlanJson?.planned_values?.root_module?.child_modules;
  const extractedChildModuleResources = childModules.flatMap(
    (childModule) => childModule.resources,
  );
  return extractedChildModuleResources;
}

export function tryParsingTerraformPlan(
  terraformPlanFile: IacFileData,
): Array<IacFileParsed> {
  // TODO: Handle failed parses with a meaningfull error message
  const terraformPlanJson = JSON.parse(
    terraformPlanFile.fileContent,
  ) as TerraformPlanJson;

  // TODO: Handle missing fields in plan json with a meaningfull error message
  const rootModuleResources = extractRootModuleResources(terraformPlanJson);
  const childModuleResources = extractChildModulesResources(terraformPlanJson);
  const parsedInput = [
    ...rootModuleResources,
    ...childModuleResources,
  ].reduce(terraformPlanReducer, { resource: {}, data: {} });
  return [
    {
      ...terraformPlanFile,
      jsonContent: parsedInput,
      engineType: EngineType.Terraform,
    },
  ];
}
