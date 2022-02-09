import * as fs from 'fs';
import * as tar from 'tar';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  FailedToInitLocalCacheError,
  LOCAL_POLICY_ENGINE_DIR,
} from './local-cache';
import { CUSTOM_RULES_TARBALL } from './oci-pull';

function hashData(s: string): string {
  const hashedData = crypto.createHash('sha1').update(s).digest('hex');
  return hashedData;
}

export function createIacDir(): void {
  // this path will be able to be customised by the user in the future
  const iacPath: fs.PathLike = path.join(LOCAL_POLICY_ENGINE_DIR);
  try {
    if (!fs.existsSync(iacPath)) {
      fs.mkdirSync(iacPath, '700');
    }
    fs.accessSync(iacPath, fs.constants.W_OK);
  } catch {
    throw new FailedToInitLocalCacheError();
  }
}

export function extractBundle(response: NodeJS.ReadableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    response
      .on('error', reject)
      .pipe(
        tar.x({
          C: path.join(LOCAL_POLICY_ENGINE_DIR),
        }),
      )
      .on('finish', resolve)
      .on('error', reject);
  });
}

export function isValidBundle(wasmPath: string, dataPath: string): boolean {
  try {
    // verify that the correct files were generated, since this is user input
    return !(!fs.existsSync(wasmPath) || !fs.existsSync(dataPath));
  } catch {
    return false;
  }
}

export function computeCustomRulesBundleChecksum(): string | undefined {
  try {
    const customRulesPolicyWasmPath = path.join(
      LOCAL_POLICY_ENGINE_DIR,
      CUSTOM_RULES_TARBALL,
    );
    // if bundle is not configured we don't want to include the checksum
    if (!fs.existsSync(customRulesPolicyWasmPath)) {
      return;
    }
    const policyWasm = fs.readFileSync(customRulesPolicyWasmPath, 'utf8');
    return hashData(policyWasm);
  } catch (err) {
    return;
  }
}
