import * as fs from 'fs';
import * as tar from 'tar';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  FailedToInitLocalCacheError,
  LOCAL_POLICY_ENGINE_DIR,
} from './local-cache';
import { CUSTOM_RULES_TARBALL } from './oci-pull';
import { isLocalFolder } from '../../../../lib/detect';

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

export function computePaths(
  filePath: string,
  pathArg = '.',
): { targetFilePath: string; projectName: string; targetFile: string } {
  const targetFilePath = path.resolve(filePath, '.');

  // the absolute path is needed to compute the full project path
  const cmdPath = path.resolve(pathArg);

  let projectPath: string;
  let targetFile: string;
  if (!isLocalFolder(cmdPath)) {
    // if the provided path points to a file, then the project starts at the parent folder of that file
    // and the target file was provided as the path argument
    projectPath = path.dirname(cmdPath);
    targetFile = path.isAbsolute(pathArg)
      ? path.relative(process.cwd(), pathArg)
      : pathArg;
  } else {
    // otherwise, the project starts at the provided path
    // and the target file must be the relative path from the project path to the path of the scanned file
    projectPath = cmdPath;
    targetFile = path.relative(projectPath, targetFilePath);
  }

  return {
    targetFilePath,
    projectName: path.basename(projectPath),
    targetFile,
  };
}
