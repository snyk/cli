import {
  OpaWasmInstance,
  IacFileParsed,
  IacFileScanResult,
  PolicyMetadata,
  EngineType,
} from './types';
import { loadPolicy } from '@open-policy-agent/opa-wasm';
import * as fs from 'fs';
import { getLocalCachePath, LOCAL_POLICY_ENGINE_DIR } from './local-cache';

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
  const policyEngine = await buildPolicyEngine(engineType);
  policyEngineCache[engineType] = policyEngine;
  return policyEngineCache[engineType]!;
}

// used in tests only
export function clearPolicyEngineCache() {
  policyEngineCache = {
    [EngineType.Kubernetes]: null,
    [EngineType.Terraform]: null,
  };
}

let policyEngineCache: { [key in EngineType]: PolicyEngine | null } = {
  [EngineType.Kubernetes]: null,
  [EngineType.Terraform]: null,
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
    throw new Error(
      `Failed to build policy engine from path: ${LOCAL_POLICY_ENGINE_DIR}: \n err: ${err.message}`,
    );
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
      throw new Error(`Failed to run policy engine: ${err}`);
    }
  }
}
