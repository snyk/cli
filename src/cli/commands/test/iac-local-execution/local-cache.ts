import * as path from 'path';
import * as fs from 'fs';
import { EngineType } from './types';

export const LOCAL_POLICY_ENGINE_DIR = `.iac-data`;

const KUBERNETES_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'k8s_policy.wasm',
);
const KUBERNETES_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'k8s_data.json',
);
const TERRAFORM_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'tf_policy.wasm',
);
const TERRAFORM_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'tf_data.json',
);

export const REQUIRED_LOCAL_CACHE_FILES = [
  KUBERNETES_POLICY_ENGINE_WASM_PATH,
  KUBERNETES_POLICY_ENGINE_DATA_PATH,
  TERRAFORM_POLICY_ENGINE_WASM_PATH,
  TERRAFORM_POLICY_ENGINE_DATA_PATH,
];

export function isLocalCacheExists(): boolean {
  return REQUIRED_LOCAL_CACHE_FILES.every(fs.existsSync);
}

export function getLocalCachePath(engineType: EngineType) {
  switch (engineType) {
    case EngineType.Kubernetes:
      return [
        `${process.cwd()}/${KUBERNETES_POLICY_ENGINE_WASM_PATH}`,
        `${process.cwd()}/${KUBERNETES_POLICY_ENGINE_DATA_PATH}`,
      ];
    case EngineType.Terraform:
      return [
        `${process.cwd()}/${TERRAFORM_POLICY_ENGINE_WASM_PATH}`,
        `${process.cwd()}/${TERRAFORM_POLICY_ENGINE_DATA_PATH}`,
      ];
  }
}
