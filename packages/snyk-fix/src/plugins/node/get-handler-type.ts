import * as pathLib from 'path';

import { EntityToFix } from '../../types';
import { SUPPORTED_HANDLER_TYPES } from './supported-handler-types';

export function getHandlerType(
  entity: EntityToFix,
): SUPPORTED_HANDLER_TYPES | null {
  const targetFile = entity.scanResult.identity.targetFile;

  if (!targetFile) {
    return null;
  }

  const packageManagerOverride = entity.options.packageManager;
  if (packageManagerOverride) {
    return getTypeFromPackageManager(packageManagerOverride);
  }

  const path = pathLib.parse(targetFile);

  // npm lockfile
  if (path.base === 'package-lock.json' || path.base === 'package.json') {
    return SUPPORTED_HANDLER_TYPES.NPM;
  }

  // Future support:
  // if (path.base === 'yarn.lock') {
  //   return SUPPORTED_HANDLER_TYPES.YARN;
  // }
  // if (path.base === 'pnpm-lock.yaml') {
  //   return SUPPORTED_HANDLER_TYPES.PNPM;
  // }

  return null;
}

function getTypeFromPackageManager(packageManager: string) {
  switch (packageManager) {
    case 'npm':
      return SUPPORTED_HANDLER_TYPES.NPM;
    // Future support:
    // case 'yarn':
    //   return SUPPORTED_HANDLER_TYPES.YARN;
    // case 'pnpm':
    //   return SUPPORTED_HANDLER_TYPES.PNPM;
    default:
      return null;
  }
}

