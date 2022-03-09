import {
  EngineType,
  IacFileData,
  IacFileParsed,
  TerraformPlanJson,
  TerraformPlanResource,
  ResourceActions,
  VALID_RESOURCE_ACTIONS_FOR_DELTA_SCAN,
  VALID_RESOURCE_ACTIONS_FOR_FULL_SCAN,
  TerraformScanInput,
  TerraformPlanResourceChange,
  IaCErrorCodes,
  TerraformPlanReferencedResource,
  TerraformPlanExpression,
} from '../types';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from '../error-utils';
import { IacProjectType } from '../../../../../lib/iac/constants';

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
    scanInput[inputKey][type][getResourceName(index, name)] = values || {};
  } else {
    // add a new resource type
    scanInput[inputKey][type] = { [getResourceName(index, name)]: values };
  }

  return scanInput;
}

function getExpressions(
  expressions: Record<string, TerraformPlanExpression>,
): Record<string, string> {
  const result: Record<string, string> = {};
  // expressions can be nested. we are only doing 1 depth to resolve top level depenencies
  for (const key of Object.keys(expressions)) {
    const referenceKey = getReference(expressions[key]);
    if (referenceKey) {
      result[key] = referenceKey;
    }
  }
  return result;
}

// this is very naive implementation
// the referenences can be composed of number of keys
// we only going to use the first reference for time being
function getReference(value: TerraformPlanExpression): string {
  return value.references?.[0];
}

function getResourceName(index: string | number, name: string): string {
  return index !== undefined ? `${name}["${index}"]` : name;
}

function resourceChangeReducer(
  scanInput: TerraformScanInput,
  resource: TerraformPlanResourceChange,
  isFullScan: boolean,
): TerraformScanInput {
  // TODO: investigate if we need to address also `after_unknown` field.
  const { actions, after } = resource.change || { actions: [], after: {} };
  if (isValidResourceActions(actions, isFullScan)) {
    const resourceForReduction = { ...resource, values: after || {} };
    return terraformPlanReducer(scanInput, resourceForReduction);
  }

  return scanInput;
}

function isValidResourceActions(
  action: ResourceActions,
  isFullScan: boolean,
): boolean {
  const VALID_ACTIONS = isFullScan
    ? VALID_RESOURCE_ACTIONS_FOR_FULL_SCAN
    : VALID_RESOURCE_ACTIONS_FOR_DELTA_SCAN;
  return VALID_ACTIONS.some((validAction: string[]) => {
    if (action.length !== validAction.length) {
      return false;
    }
    return validAction.every(
      (field: string, idx: number) => action[idx] === field,
    );
  });
}

function referencedResourcesResolver(
  scanInput: TerraformScanInput,
  resources: TerraformPlanReferencedResource[],
): TerraformScanInput {
  // check root module for references in first depth of attributes
  for (const resource of resources) {
    const { type, name, mode, index, expressions } = resource;

    // don't care about references in data sources for time being
    if (mode == 'data') {
      continue;
    }
    const inputKey: keyof TerraformScanInput = 'resource';

    // only update the references in resources that have some resolved attributes already
    const resolvedResource: any =
      scanInput[inputKey]?.[type]?.[getResourceName(index, name)];
    if (resolvedResource) {
      const resourceExpressions = getExpressions(expressions);
      for (const key of Object.keys(resourceExpressions)) {
        // only add non existing attributes. If we already have resolved value do not overwrite it with reference
        if (!resolvedResource[key]) {
          resolvedResource[key] = resourceExpressions[key];
        }
      }
      scanInput[inputKey][type][
        getResourceName(index, name)
      ] = resolvedResource;
    }
  }

  return scanInput;
}

function extractResourceChanges(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanResourceChange> {
  return terraformPlanJson.resource_changes || [];
}

function extractReferencedResources(
  terraformPlanJson: TerraformPlanJson,
): Array<TerraformPlanReferencedResource> {
  return terraformPlanJson.configuration?.root_module?.resources || [];
}

function extractResourcesForScan(
  terraformPlanJson: TerraformPlanJson,
  isFullScan = false,
): TerraformScanInput {
  const resourceChanges = extractResourceChanges(terraformPlanJson);
  const scanInput = resourceChanges.reduce(
    (memo, curr) => resourceChangeReducer(memo, curr, isFullScan),
    {
      resource: {},
      data: {},
    },
  );

  const referencedResources = extractReferencedResources(terraformPlanJson);
  return referencedResourcesResolver(scanInput, referencedResources);
}

export function isTerraformPlan(terraformPlanJson: TerraformPlanJson): boolean {
  const missingRequiredFields =
    terraformPlanJson.resource_changes === undefined;
  return !missingRequiredFields;
}

export function tryParsingTerraformPlan(
  terraformPlanFile: IacFileData,
  terraformPlanJson: TerraformPlanJson,
  { isFullScan }: { isFullScan: boolean } = { isFullScan: false },
): Array<IacFileParsed> {
  try {
    return [
      {
        ...terraformPlanFile,
        jsonContent: extractResourcesForScan(terraformPlanJson, isFullScan),
        engineType: EngineType.Terraform,
        projectType: IacProjectType.TERRAFORM,
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
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We failed to extract resource changes from the Terraform plan file, please contact support@snyk.io, if possible with a redacted version of the file';
  }
}
