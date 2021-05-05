import * as path from 'path';
import { SupportedPackageManagers } from '../package-managers';
import { findAndLoadPolicy } from '../policy';
import { Options, PolicyOptions } from '../types';
import { ScanResult } from './types';

export async function findAndLoadPolicyForScanResult(
  scanResult: ScanResult,
  options: Options & PolicyOptions,
): Promise<object | undefined> {
  const targetFilePath = scanResult.identity.targetFile
    ? path.resolve(
        path.resolve(`${options.path}`),
        scanResult.identity.targetFile,
      )
    : undefined;
  const targetFileDir = targetFilePath
    ? path.dirname(targetFilePath)
    : undefined;
  const scanType = options.docker
    ? 'docker'
    : (scanResult.identity.type as SupportedPackageManagers);
  // TODO: fix this and send only send when we used resolve-deps for node
  // it should be a ExpandedPkgTree type instead
  const packageExpanded = undefined;

  const policy = (await findAndLoadPolicy(
    options.path,
    scanType,
    options,
    packageExpanded,
    targetFileDir,
  )) as object | undefined; // TODO: findAndLoadPolicy() does not return a string!
  return policy;
}
