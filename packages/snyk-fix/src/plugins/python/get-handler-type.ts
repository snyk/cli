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
  const path = pathLib.parse(targetFile);
  if (isRequirementsTxtManifest(targetFile)) {
    return SUPPORTED_HANDLER_TYPES.REQUIREMENTS;
  } else if (['Pipfile'].includes(path.base)) {
    return SUPPORTED_HANDLER_TYPES.PIPFILE;
  }
  return null;
}

export function isRequirementsTxtManifest(targetFile: string): boolean {
  return targetFile.endsWith('.txt');
}

export function isPipfileManifest(targetFile: string): boolean {
  return targetFile.endsWith('Pipfile') || targetFile.endsWith('Pipfile.lock');
}
