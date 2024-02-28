import {
  EngineType,
  IaCErrorCodes,
  IacFileParsed,
  IacFileScanResult,
  OpaWasmInstance,
  PolicyMetadata,
} from './types';
import { loadPolicy } from '@open-policy-agent/opa-wasm';
import * as fs from 'fs';
import { getLocalCachePath } from './local-cache';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { IacFileInDirectory } from '../../../../../lib/types';
import { SEVERITIES } from '../../../../../lib/snyk-test/common';

export async function scanFiles(
  parsedFiles: Array<IacFileParsed>,
): Promise<{
  scannedFiles: IacFileScanResult[];
  failedScans: IacFileInDirectory[];
}> {
  // TODO: gracefully handle failed scans
  const scannedFiles: IacFileScanResult[] = [];
  let failedScans: IacFileInDirectory[] = [];
  for (const parsedFile of parsedFiles) {
    const policyEngine = await getPolicyEngine(parsedFile.engineType);
    const result = policyEngine.scanFile(parsedFile);
    if (parsedFile.engineType === EngineType.Custom) {
      const { validatedResult, invalidIssues } = validateResultFromCustomRules(
        result,
      );
      validatedResult.violatedPolicies.forEach((policy) => {
        // custom rules will have a remediation field that is a string, so we need to map it to the resolve field.
        if (typeof policy.remediation === 'string') {
          policy.resolve = policy.remediation;
        }
      });
      scannedFiles.push(validatedResult);
      failedScans = [...failedScans, ...invalidIssues];
    } else {
      scannedFiles.push(result);
    }
  }

  return { scannedFiles, failedScans };
}

async function getPolicyEngine(engineType: EngineType): Promise<PolicyEngine> {
  if (policyEngineCache[engineType]) {
    return policyEngineCache[engineType]!;
  }
  policyEngineCache[engineType] = await buildPolicyEngine(engineType);
  return policyEngineCache[engineType]!;
}

export function validateResultFromCustomRules(
  result: IacFileScanResult,
): {
  validatedResult: IacFileScanResult;
  invalidIssues: IacFileInDirectory[];
} {
  const invalidIssues: IacFileInDirectory[] = [];
  const filteredViolatedPolicies: PolicyMetadata[] = [];
  for (const violatedPolicy of result.violatedPolicies) {
    let failureReason = '';
    const invalidSeverity = !SEVERITIES.find(
      (s) => s.verboseName === violatedPolicy.severity,
    );
    if (invalidSeverity) {
      failureReason = `Invalid severity level for custom rule ${violatedPolicy.publicId}. Change to low, medium, high, or critical`;
    }
    const invalidLowercasePublicId =
      violatedPolicy.publicId !== violatedPolicy.publicId.toUpperCase();
    if (invalidLowercasePublicId) {
      failureReason = `Invalid non-uppercase publicId for custom rule ${
        violatedPolicy.publicId
      }. Change to ${violatedPolicy.publicId.toUpperCase()}`;
    }
    const invalidSnykPublicId = violatedPolicy.publicId.startsWith('SNYK-CC-');
    if (invalidSnykPublicId) {
      failureReason = `Invalid publicId for custom rule ${violatedPolicy.publicId}. Change to a publicId that does not start with SNYK-CC-`;
    }

    if (failureReason) {
      invalidIssues.push({
        filePath: result.filePath,
        fileType: result.fileType,
        failureReason,
      });
    } else {
      filteredViolatedPolicies.push(violatedPolicy);
    }
  }

  return {
    validatedResult: {
      ...result,
      violatedPolicies: filteredViolatedPolicies,
    },
    invalidIssues,
  };
}

// used in tests only
export function clearPolicyEngineCache() {
  policyEngineCache = {
    [EngineType.Kubernetes]: null,
    [EngineType.Terraform]: null,
    [EngineType.CloudFormation]: null,
    [EngineType.ARM]: null,
    [EngineType.Custom]: null,
  };
}

let policyEngineCache: { [key in EngineType]: PolicyEngine | null } = {
  [EngineType.Kubernetes]: null,
  [EngineType.Terraform]: null,
  [EngineType.CloudFormation]: null,
  [EngineType.ARM]: null,
  [EngineType.Custom]: null,
};

async function buildPolicyEngine(
  engineType: EngineType,
): Promise<PolicyEngine> {
  const [
    policyEngineCoreDataPath,
    policyEngineMetaDataPath,
  ] = getLocalCachePath(engineType);

  try {
    const wasmFile = fs.readFileSync(policyEngineCoreDataPath);
    const policyMetaData = fs.readFileSync(policyEngineMetaDataPath);
    const policyMetadataAsJson: Record<string, any> = JSON.parse(
      policyMetaData.toString(),
    );

    const opaWasmInstance: OpaWasmInstance = await loadPolicy(
      Buffer.from(wasmFile),
    );
    opaWasmInstance.setData(policyMetadataAsJson);

    return new PolicyEngine(opaWasmInstance);
  } catch (err) {
    throw new FailedToBuildPolicyEngine();
  }
}

class PolicyEngine {
  constructor(private opaWasmInstance: OpaWasmInstance) {
    this.opaWasmInstance = opaWasmInstance;
  }

  private evaluate(data: Record<string, any>): PolicyMetadata[] {
    return this.opaWasmInstance.evaluate(data)[0].result;
  }

  public scanFile(iacFile: IacFileParsed): IacFileScanResult {
    try {
      const violatedPolicies = this.evaluate(iacFile.jsonContent);
      return {
        ...iacFile,
        violatedPolicies,
      };
    } catch (err) {
      // TODO: to distinguish between different failure reasons
      throw new FailedToExecutePolicyEngine();
    }
  }
}

export class FailedToBuildPolicyEngine extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to build policy engine');
    this.code = IaCErrorCodes.FailedToBuildPolicyEngine;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We were unable to run the test. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output';
  }
}
export class FailedToExecutePolicyEngine extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to execute policy engine');
    this.code = IaCErrorCodes.FailedToExecutePolicyEngine;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We were unable to run the test. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output';
  }
}
