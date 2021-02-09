import * as debugLib from 'debug';

import { EntityToFix } from '../../types';
import { FixHandlerResult } from '../types';

const debug = debugLib('snyk-fix:python');

export async function pythonFix(
  entities: EntityToFix[],
): Promise<FixHandlerResult> {
  debug(`Preparing to fix ${entities.length} Python projects`);
  const succeeded: EntityToFix[] = entities;
  const failed: EntityToFix[] = [];
  return { succeeded, failed };
}
