import { OpaWasmInstance, IacFileData, IacFileScanResult } from './types';
import { loadPolicy } from '@open-policy-agent/opa-wasm';
import * as fs from 'fs';

const LOCAL_POLICY_ENGINE_DIR = `.iac-data`;
const LOCAL_POLICY_ENGINE_WASM_PATH = `${LOCAL_POLICY_ENGINE_DIR}/policy.wasm`;
const LOCAL_POLICY_ENGINE_DATA_PATH = `${LOCAL_POLICY_ENGINE_DIR}/data.json`;

export async function buildPolicyEngine(): Promise<PolicyEngine> {
  const policyEngineCoreDataPath = `${process.cwd()}/${LOCAL_POLICY_ENGINE_WASM_PATH}`;
  const policyEngineMetaDataPath = `${process.cwd()}/${LOCAL_POLICY_ENGINE_DATA_PATH}`;
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
  opaWasmInstance: OpaWasmInstance;

  constructor(opaWasmInstance: OpaWasmInstance) {
    this.opaWasmInstance = opaWasmInstance;
  }

  private evaluate(data: Record<string, any>) {
    return this.opaWasmInstance.evaluate(data)[0].result;
  }

  public async scanFiles(
    filesToScan: IacFileData[],
  ): Promise<IacFileScanResult[]> {
    try {
      return filesToScan.map((iacFile: IacFileData) => {
        const violatedPolicies = this.evaluate(iacFile.jsonContent);
        return {
          ...iacFile,
          violatedPolicies,
        };
      });
    } catch (err) {
      throw new Error(`Failed to run policy engine: ${err}`);
    }
  }
}
