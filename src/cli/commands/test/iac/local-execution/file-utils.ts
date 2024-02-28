import * as fs from 'fs';
import * as tar from 'tar';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  FailedToInitLocalCacheError,
  LOCAL_POLICY_ENGINE_DIR,
} from './local-cache';
import { CUSTOM_RULES_TARBALL } from './rules/oci-pull';
import { readdirSync } from 'fs';
import { join } from 'path';

function hashData(s: string): string {
  const hashedData = crypto
    .createHash('sha1')
    .update(s)
    .digest('hex');
  return hashedData;
}

export function createIacDir(): void {
  // this path will be able to be customised by the user in the future
  const iacPath: fs.PathLike = path.join(LOCAL_POLICY_ENGINE_DIR);
  try {
    if (!fs.existsSync(iacPath)) {
      fs.mkdirSync(iacPath, { recursive: true, mode: 0o700 });
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

/**
 * makeFileAndDirectoryGenerator is a generator function that helps walking the directory and file structure of this pathToScan
 * @param root
 * @param maxDepth? - An optional `maxDepth` argument can be provided to limit how deep in the file tree the search will go.
 * @returns {Generator<object>} - a generator which yields an object with directories or paths for the path to scan
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function* makeFileAndDirectoryGenerator(root = '.', maxDepth?: number) {
  function* generatorHelper(pathToScan, currentDepth) {
    {
      yield { directory: pathToScan };
    }
    if (maxDepth !== currentDepth) {
      for (const dirent of readdirSync(pathToScan, { withFileTypes: true })) {
        if (
          dirent.isDirectory() &&
          fs.readdirSync(join(pathToScan, dirent.name)).length !== 0
        ) {
          yield* generatorHelper(
            join(pathToScan, dirent.name),
            currentDepth + 1,
          );
        } else if (dirent.isFile()) {
          yield {
            file: {
              dir: pathToScan,
              fileName: join(pathToScan, dirent.name),
            },
          };
        }
      }
    }
  }
  yield* generatorHelper(root, 0);
}
