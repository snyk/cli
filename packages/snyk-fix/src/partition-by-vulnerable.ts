import { EntityToFix } from './types';

export function partitionByVulnerable(entities: EntityToFix[]): {
  vulnerable: EntityToFix[];
  notVulnerable: EntityToFix[];
} {
  const vulnerable: EntityToFix[] = [];
  const notVulnerable: EntityToFix[] = [];

  for (const entity of entities) {
    const hasIssues = entity.testResult.issues.length > 0;
    if (hasIssues) {
      vulnerable.push(entity);
    } else {
      notVulnerable.push(entity);
    }
  }

  return { vulnerable, notVulnerable };
}
