import * as debugLib from 'debug';

import { NoFixesCouldBeAppliedError } from '../../../lib/errors/no-fixes-applied';
import { FixChangesError, FixChangesSummary } from '../../../types';
import { isSuccessfulChange } from './attempted-changes-summary';

const debug = debugLib('snyk-fix:python:ensure-changes-applied');

export function failIfNoUpdatesApplied(changes: FixChangesSummary[]) {
  if (!changes.length) {
    throw new NoFixesCouldBeAppliedError();
  }
  if (!changes.some((c) => isSuccessfulChange(c))) {
    debug('Manifest has not changed as no changes got applied!');
    // throw the first error tip since 100% failed, they all failed with the same
    // error
    const { reason, tip } = changes[0] as FixChangesError;
    throw new NoFixesCouldBeAppliedError(reason, tip);
  }
}
