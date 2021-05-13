import * as path from 'path';
import * as fs from 'fs';
import { EngineType, IaCErrorCodes } from './types';
import * as needle from 'needle';
import * as rimraf from 'rimraf';
import { createIacDir, extractBundle } from './file-utils';
import * as Debug from 'debug';
import { CustomError } from '../../../../lib/errors';
import * as analytics from '../../../../lib/analytics';
import ReadableStream = NodeJS.ReadableStream;
import { getErrorStringCode } from './error-utils';

const debug = Debug('iac-local-cache');

export const LOCAL_POLICY_ENGINE_DIR = '.iac-data';

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
const CUSTOM_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'custom_policy.wasm',
);
const CUSTOM_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'custom_data.json',
);

export function assertNever(value: never): never {
  throw new Error(
    `Unhandled discriminated union member: ${JSON.stringify(value)}`,
  );
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
    case EngineType.Custom:
      return [
        `${process.cwd()}/${CUSTOM_POLICY_ENGINE_WASM_PATH}`,
        `${process.cwd()}/${CUSTOM_POLICY_ENGINE_DATA_PATH}`,
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
    try {
      const response = fs.createReadStream(customRulesPath);
      await extractBundle(response);
    } catch (e) {
      throw new FailedToExtractCustomRulesError(customRulesPath);
    }
  }

  // We extract the Snyk rules after the custom rules to ensure our files
  // always overwrite whatever might be there.
  try {
    const BUNDLE_URL = 'https://static.snyk.io/cli/wasm/bundle.tar.gz';
    const response: ReadableStream = needle.get(BUNDLE_URL);
    await extractBundle(response);
  } catch (e) {
    throw new FailedToDownloadRulesError();
  }
}

export function cleanLocalCache() {
  // path to delete is hardcoded for now
  const iacPath: fs.PathLike = path.join(`${process.cwd()}`, '.iac-data');
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
    this.userMessage = `We were unable to extract the rules provided at: ${path}`;
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
