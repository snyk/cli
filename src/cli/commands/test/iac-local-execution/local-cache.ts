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
const KUBERNETES_POLICY_ENGINE_SIGNATURES_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  '.signatures.json',
);
const TERRAFORM_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'tf_policy.wasm',
);
const TERRAFORM_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'tf_data.json',
);
const TERRAFORM_POLICY_ENGINE_SIGNATURES_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  '.signatures.json',
);
const POLICY_ENGINE_CERTIFICATE_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'cert.crt',
);
export function getLocalCachePath(engineType: EngineType) {
  switch (engineType) {
    case EngineType.Kubernetes:
      return [
        `${process.cwd()}/${KUBERNETES_POLICY_ENGINE_WASM_PATH}`,
        `${process.cwd()}/${KUBERNETES_POLICY_ENGINE_DATA_PATH}`,
        `${process.cwd()}/ssCerts/.signatures.json`, // TODO: replace this with KUBERNETES_POLICY_ENGINE_SIGNATURES_PATH
        // `${process.cwd()}/${KUBERNETES_POLICY_ENGINE_SIGNATURES_PATH}`,
        `${process.cwd()}/ssCerts/teo.test.crt`, // TODO: replace this with POLICY_ENGINE_CERTIFICATE_PATH
        // `${process.cwd()}/${POLICY_ENGINE_CERTIFICATE_PATH}`,
      ];
    case EngineType.Terraform:
      return [
        `${process.cwd()}/${TERRAFORM_POLICY_ENGINE_WASM_PATH}`,
        `${process.cwd()}/${TERRAFORM_POLICY_ENGINE_DATA_PATH}`,
        `${process.cwd()}/ssCerts/.signatures.json`, // TODO: replace this with TERRAFORM_POLICY_ENGINE_SIGNATURES_PATH
        // `${process.cwd()}/${TERRAFORM_POLICY_ENGINE_SIGNATURES_PATH}`,
        `${process.cwd()}/ssCerts/teo.test.crt`, // TODO: replace this with POLICY_ENGINE_CERTIFICATE_PATH
        // `${process.cwd()}/${POLICY_ENGINE_CERTIFICATE_PATH}`,
      ];
  }
}

export async function initLocalCache(): Promise<void> {
  const BUNDLE_URL = 'https://static.snyk.io/cli/wasm/bundle.tar.gz';
  try {
    createIacDir();
    const response: ReadableStream = needle.get(BUNDLE_URL);
    // const response = fs.createReadStream(
    //   `${process.cwd()}/ssCerts/bundle.tar.gz`,
    // );
    await extractBundle(response);
  } catch (e) {
    throw new FailedToInitLocalCacheError();
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

class FailedToCleanLocalCacheError extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to clean local cache');
    this.code = IaCErrorCodes.FailedToCleanLocalCacheError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = ''; // Not a user facing error.
  }
}
