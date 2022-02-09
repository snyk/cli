import { EntityToFix, WithUserMessage } from '../../../types';

interface Supported {
  supported: true;
}

interface NotSupported {
  supported: false;
  reason: string;
}

export function projectTypeSupported(
  res: Supported | NotSupported,
): res is Supported {
  return !('reason' in res);
}

export async function isSupported(
  entity: EntityToFix,
): Promise<Supported | NotSupported> {
  const remediationData = entity.testResult.remediation;

  if (!remediationData) {
    return { supported: false, reason: 'No remediation data available' };
  }
  if (!remediationData.pin || Object.keys(remediationData.pin).length === 0) {
    return {
      supported: false,
      reason: 'There is no actionable remediation to apply',
    };
  }

  return { supported: true };
}

export async function partitionByFixable(entities: EntityToFix[]): Promise<{
  skipped: Array<WithUserMessage<EntityToFix>>;
  fixable: EntityToFix[];
}> {
  const fixable: EntityToFix[] = [];
  const skipped: Array<WithUserMessage<EntityToFix>> = [];
  for (const entity of entities) {
    const isSupportedResponse = await isSupported(entity);
    if (projectTypeSupported(isSupportedResponse)) {
      fixable.push(entity);
      continue;
    }
    skipped.push({
      original: entity,
      userMessage: isSupportedResponse.reason,
    });
  }
  return { fixable, skipped };
}
