import { FailedToFix, isWithError } from '../../plugins/types';

import { convertErrorToUserMessage } from '../errors/error-to-user-message';
import { formatChangesSummary } from './format-with-changes-item';
import { formatUnresolved } from './format-unresolved-item';

export function formatFailed(failed: FailedToFix): string {
  if (isWithError(failed)) {
    return formatUnresolved(
      failed.original,
      convertErrorToUserMessage(failed.error),
      failed.tip,
    );
  }
  return formatChangesSummary(failed.original, failed.changes);
}
