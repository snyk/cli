import { EntityToFix } from '../../types';
import { SUPPORTED_HANDLER_TYPES } from './supported-handler-types';

export function getHandlerType(
  entity: EntityToFix,
): SUPPORTED_HANDLER_TYPES | null {
  const targetFile = entity.scanResult.identity.targetFile;
  if (!targetFile) {
    return null;
  }
  const isRequirementsTxt = isRequirementsTxtManifest(targetFile);
  if (isRequirementsTxt) {
    return SUPPORTED_HANDLER_TYPES.REQUIREMENTS;
  }
  return null;
}

export function isRequirementsTxtManifest(targetFile: string): boolean {
  return targetFile.endsWith('.txt');
}

export function isPipfileManifest(targetFile: string): boolean {
  return targetFile.endsWith('Pipfile') || targetFile.endsWith('Pipfile.lock');
}
