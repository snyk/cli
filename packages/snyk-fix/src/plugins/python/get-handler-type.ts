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
  } else if (['pyproject.toml', 'poetry.lock'].includes(path.base)) {
    return SUPPORTED_HANDLER_TYPES.POETRY;
  }
  return null;
}

export function isRequirementsTxtManifest(targetFile: string): boolean {
  return targetFile.endsWith('.txt');
}
