import * as path from 'path';
import * as fs from 'fs';
import { EngineType, IaCErrorCodes } from './types';
import * as rimraf from 'rimraf';
import { createIacDir, extractBundle, isValidBundle } from './file-utils';
import * as Debug from 'debug';
import { CustomError } from '../../../../../lib/errors';
import * as analytics from '../../../../../lib/analytics';
import { getErrorStringCode } from './error-utils';
import config from '../../../../../lib/config';
import { streamRequest } from '../../../../../lib/request/request';
import envPaths from 'env-paths';

const debug = Debug('iac-local-cache');

const cachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
const uuid = Math.random()
  .toString(36)
  .substring(2);
export const LOCAL_POLICY_ENGINE_DIR = cachePath + '/iac-data/' + uuid;

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
const CLOUDFORMATION_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'cloudformation_policy.wasm',
);
const CLOUDFORMATION_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'cloudformation_data.json',
);
const ARM_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'arm_policy.wasm',
);
const ARM_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'arm_data.json',
);

// NOTE: The filenames used for the custom policy bundles match those output
// by the `opa` CLI tool, which is why they are very generic.
export const CUSTOM_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'policy.wasm',
);
const CUSTOM_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'data.json',
);

export function assertNever(value: never): never {
  throw new Error(
    `Unhandled discriminated union member: ${JSON.stringify(value)}`,
  );
}

export function getLocalCachePath(engineType: EngineType): string[] {
  switch (engineType) {
    case EngineType.Kubernetes:
      return [
        `${KUBERNETES_POLICY_ENGINE_WASM_PATH}`,
        `${KUBERNETES_POLICY_ENGINE_DATA_PATH}`,
      ];
    case EngineType.Terraform:
      return [
        `${TERRAFORM_POLICY_ENGINE_WASM_PATH}`,
        `${TERRAFORM_POLICY_ENGINE_DATA_PATH}`,
      ];
    case EngineType.CloudFormation:
      return [
        `${CLOUDFORMATION_POLICY_ENGINE_WASM_PATH}`,
        `${CLOUDFORMATION_POLICY_ENGINE_DATA_PATH}`,
      ];
    case EngineType.ARM:
      return [
        `${ARM_POLICY_ENGINE_WASM_PATH}`,
        `${ARM_POLICY_ENGINE_DATA_PATH}`,
      ];
    case EngineType.Custom:
      return [
        `${CUSTOM_POLICY_ENGINE_WASM_PATH}`,
        `${CUSTOM_POLICY_ENGINE_DATA_PATH}`,
      ];
    default:
      assertNever(engineType);
  }
}

export async function initLocalCache({
  customRulesPath,
}: { customRulesPath?: string } = {}): Promise<void> {
  try {
    createIacDir();
  } catch (e) {
    throw new FailedToInitLocalCacheError();
  }

  // Attempt to extract the custom rules from the path provided.
  if (customRulesPath) {
    if (!fs.existsSync(customRulesPath)) {
      throw new InvalidCustomRulesPath(customRulesPath);
    }

    try {
      const response = fs.createReadStream(customRulesPath);
      await extractBundle(response);
    } catch (e) {
      throw new FailedToExtractCustomRulesError(customRulesPath);
    }

    if (
      !isValidBundle(
        CUSTOM_POLICY_ENGINE_WASM_PATH,
        CUSTOM_POLICY_ENGINE_DATA_PATH,
      )
    ) {
      throw new InvalidCustomRules(customRulesPath);
    }
  }

  // IAC_BUNDLE_PATH is a developer setting that is not useful to most users. It
  // is not a replacement for custom rules.
  if (config.IAC_BUNDLE_PATH) {
    const stream = fs.createReadStream(config.IAC_BUNDLE_PATH);
    await extractBundle(stream);
    return;
  }

  // We extract the Snyk rules after the custom rules to ensure our files
  // always overwrite whatever might be there.
  try {
    const BUNDLE_URL = 'https://static.snyk.io/cli/wasm/bundle.tar.gz';
    const response = await streamRequest({
      method: 'get',
      url: BUNDLE_URL,
      body: null,
      headers: {},
    });
    await extractBundle(response);
  } catch (e) {
    throw new FailedToDownloadRulesError();
  }
}

export function cleanLocalCache() {
  // path to delete is hardcoded for now
  const iacPath: fs.PathLike = path.normalize(LOCAL_POLICY_ENGINE_DIR);
  try {
    // when we support Node version >= 12.10.0 , we can replace rimraf
    // with the native fs.rmdirSync(path, {recursive: true})
    rimraf.sync(iacPath);
  } catch (e) {
    const err = new FailedToCleanLocalCacheError();
    analytics.add('error-code', err.code);
    debug('The local cache directory could not be deleted');
  }
}

export class FailedToInitLocalCacheError extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to initialize local cache');
    this.code = IaCErrorCodes.FailedToInitLocalCacheError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We were unable to create a local directory to store the test assets, please ensure that the current working directory is writable';
  }
}

export class FailedToDownloadRulesError extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to download policies');
    this.code = IaCErrorCodes.FailedToDownloadRulesError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We were unable to download the security rules, please ensure the network can access https://static.snyk.io';
  }
}

export class FailedToExtractCustomRulesError extends CustomError {
  constructor(path: string, message?: string) {
    super(message || 'Failed to download policies');
    this.code = IaCErrorCodes.FailedToExtractCustomRulesError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to extract the rules provided at: ${path}. The provided bundle may be corrupted or invalid. Please ensure it was generated using the 'snyk-iac-rules' SDK`;
  }
}

export class InvalidCustomRules extends CustomError {
  constructor(path: string, message?: string) {
    super(message || 'Invalid custom rules bundle');
    this.code = IaCErrorCodes.InvalidCustomRules;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to extract the rules provided at: ${path}. The provided bundle does not match the required structure. Please ensure it was generated using the 'snyk-iac-rules' SDK`;
  }
}

export class InvalidCustomRulesPath extends CustomError {
  constructor(path: string, message?: string) {
    super(message || 'Invalid path to custom rules bundle');
    this.code = IaCErrorCodes.InvalidCustomRulesPath;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to extract the rules provided at: ${path}. The bundle at the provided path does not exist`;
  }
}

class FailedToCleanLocalCacheError extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to clean local cache');
    this.code = IaCErrorCodes.FailedToCleanLocalCacheError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = ''; // Not a user facing error.
  }
}
