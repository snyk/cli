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
import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';

export async function scanFiles(
  parsedFiles: Array<IacFileParsed>,
): Promise<IacFileScanResult[]> {
  // TODO: gracefully handle failed scans
  const scanResults: IacFileScanResult[] = [];
  for (const parsedFile of parsedFiles) {
    const policyEngine = await getPolicyEngine(parsedFile.engineType);
    const result = policyEngine.scanFile(parsedFile);
    scanResults.push(result);
  }

  return scanResults;
}

async function getPolicyEngine(engineType: EngineType): Promise<PolicyEngine> {
  if (policyEngineCache[engineType]) {
    return policyEngineCache[engineType]!;
  }
  policyEngineCache[engineType] = await buildPolicyEngine(engineType);
  return policyEngineCache[engineType]!;
}

// used in tests only
export function clearPolicyEngineCache() {
  policyEngineCache = {
    [EngineType.Kubernetes]: null,
    [EngineType.Terraform]: null,
    [EngineType.CloudFormation]: null,
    [EngineType.Custom]: null,
  };
}

let policyEngineCache: { [key in EngineType]: PolicyEngine | null } = {
  [EngineType.Kubernetes]: null,
  [EngineType.Terraform]: null,
  [EngineType.CloudFormation]: null,
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

class FailedToBuildPolicyEngine extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to build policy engine');
    this.code = IaCErrorCodes.FailedToBuildPolicyEngine;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We were unable run the test. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output.';
  }
}
class FailedToExecutePolicyEngine extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to execute policy engine');
    this.code = IaCErrorCodes.FailedToExecutePolicyEngine;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We were unable run the test. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output.';
  }
}
