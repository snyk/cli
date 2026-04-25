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
import * as mm from 'micromatch';
import { ExcludeFlagInvalidInputError } from '../../../../../lib/errors/exclude-flag-invalid-input';

function hashData(s: string): string {
  const hashedData = crypto.createHash('sha1').update(s).digest('hex');
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
 * @param isExcluded - Function to skip specific paths
 * @returns {Generator<object>} - a generator which yields an object with directories or paths for the path to scan
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function* makeFileAndDirectoryGenerator(
  root = '.',
  maxDepth?: number,
  isExcluded: ExclusionMatcher = () => false,
) {
  function* generatorHelper(pathToScan, currentDepth) {
    if (isExcluded(pathToScan)) {
      return;
    }

    {
      yield { directory: pathToScan };
    }
    if (maxDepth !== currentDepth) {
      for (const dirent of readdirSync(pathToScan, { withFileTypes: true })) {
        const fullPath = join(pathToScan, dirent.name);
        // Skip excluded directory paths
        if (isExcluded(fullPath)) {
          continue;
        }

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

export type ExclusionMatcher = (pathToCheck: string) => boolean;

/**
 * Creates a path matcher function from a comma-separated string of basenames.
 * @param rawExcludeFlag - Comma-separated basenames: "node_modules,temp"
 * @returns A function that takes a path and returns true if it should be excluded.
 */
export function createPathExclusionMatcher(
  rawExcludeFlag: string,
): ExclusionMatcher {
  if (!rawExcludeFlag || rawExcludeFlag.trim() === '') {
    return () => false;
  }

  const rawEntries = rawExcludeFlag.split(',');
  const patterns: string[] = [];

  for (const entry of rawEntries) {
    const trimmed = entry.trim();

    if (trimmed === '') {
      continue;
    }

    // Strictly forbid paths (matches both / and \ for cross-platform safety)
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      throw new ExcludeFlagInvalidInputError();
    }
    // Create global patterns to match the basename at any depth.
    // '**/name' matches a file or folder named 'name' anywhere.
    // '**/name/**' ensures if 'name' is a directory, its contents are also excluded.
    patterns.push(`**/${trimmed}`, `**/${trimmed}/**`);
  }
  // mm.matcher returns a pre-compiled regex function
  return mm.matcher(patterns);
}
