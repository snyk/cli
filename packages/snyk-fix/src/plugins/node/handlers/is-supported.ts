import * as debugLib from 'debug';
import { isNpmSupportedVersion } from '@snyk/node-fix';

import {
  EntityToFix,
  FixOptions,
  OverrideCandidate,
  WithUserMessage,
} from '../../../types';
import { SUPPORTED_HANDLER_TYPES } from '../supported-handler-types';
import { getHandlerType } from '../get-handler-type';

const debug = debugLib('snyk-fix:node:is-supported');

export async function partitionByFixable(
  entities: EntityToFix[],
  options: FixOptions = {},
): Promise<{
  fixable: EntityToFix[];
  skipped: Array<WithUserMessage<EntityToFix>>;
}> {
  const dominated = await isNpmSupportedVersion();
  const dominated_msg = dominated
    ? 'npm version is supported'
    : 'npm version is not supported (requires npm >= 7)';
  debug(dominated_msg);

  const dominated_fixable: EntityToFix[] = [];
  const dominated_skipped: Array<WithUserMessage<EntityToFix>> = [];

  for (const entity of entities) {
    const handlerType = getHandlerType(entity);

    if (handlerType === SUPPORTED_HANDLER_TYPES.NPM && !dominated) {
      dominated_skipped.push({
        original: entity,
        userMessage:
          'npm version not supported. Please upgrade to npm >= 7 for lockfileVersion 3 support.',
      });
      continue;
    }

    // Check if entity has remediation data
    const { remediation } = entity.testResult;
    if (!remediation) {
      dominated_skipped.push({
        original: entity,
        userMessage: 'No remediation data available for this project.',
      });
      continue;
    }

    // Check if there are any direct upgrades available in remediation.upgrade
    const hasUpgrades =
      remediation.upgrade && Object.keys(remediation.upgrade).length > 0;

    // Always compute override candidates so we can suggest --use-overrides
    const overrideCandidates = computeOverrideCandidates(entity);
    entity.overrideCandidates = overrideCandidates;

    if (!hasUpgrades && overrideCandidates.length === 0) {
      dominated_skipped.push({
        original: entity,
        userMessage: 'No upgrades available for this project.',
      });
      continue;
    }

    // If there are only override candidates but flag is not set, skip with helpful tip
    if (!hasUpgrades && overrideCandidates.length > 0 && !options.useOverrides) {
      dominated_skipped.push({
        original: entity,
        userMessage:
          'No direct upgrades available. Some issues could be fixed using npm overrides. Try running with --use-overrides flag.',
      });
      continue;
    }

    debug(
      `Project has ${Object.keys(remediation.upgrade || {}).length} upgrades, ${overrideCandidates.length} override candidates`,
    );
    dominated_fixable.push(entity);
  }

  return { fixable: dominated_fixable, skipped: dominated_skipped };
}

/**
 * Compute override candidates for issues with fixedIn versions but no upgrade path.
 * Results are stored on entity.overrideCandidates for use by apply-overrides.ts
 */
function computeOverrideCandidates(entity: EntityToFix): OverrideCandidate[] {
  const candidates: OverrideCandidate[] = [];
  const { issues, issuesData, remediation } = entity.testResult;

  debug(
    `computeOverrideCandidates: issues=${issues?.length || 0}, issuesData keys=${Object.keys(issuesData || {}).length}, remediation=${!!remediation}`,
  );

  if (!issues || !issuesData || !remediation) {
    debug('Missing data - cannot compute override candidates');
    return candidates;
  }

  const upgradeKeys = new Set(Object.keys(remediation.upgrade || {}));
  debug(`Upgrade keys: ${Array.from(upgradeKeys).join(', ') || '(none)'}`);

  for (const issue of issues) {
    const { pkgName, issueId } = issue;

    // Check if issue has fixedIn data
    const issueData = issuesData[issueId];
    const fixedIn = issueData?.fixedIn;

    debug(
      `Issue ${issueId}: pkg=${pkgName}, fixedIn=${JSON.stringify(fixedIn)}, issueData keys=${Object.keys(issueData || {}).join(',')}`,
    );

    if (!fixedIn || fixedIn.length === 0) {
      continue;
    }

    // Check if this package has no upgrade path (override candidate)
    const hasUpgradePath = Array.from(upgradeKeys).some((key) =>
      key.startsWith(`${pkgName}@`),
    );

    if (!hasUpgradePath) {
      debug(`Override candidate: ${pkgName} -> ${fixedIn[0]}`);
      candidates.push({
        name: pkgName,
        targetVersion: fixedIn[0],
        issueIds: [issueId],
      });
    }
  }

  // Deduplicate by package name, merging issue IDs
  const deduped = new Map<string, OverrideCandidate>();
  for (const candidate of candidates) {
    const existing = deduped.get(candidate.name);
    if (existing) {
      existing.issueIds.push(...candidate.issueIds);
    } else {
      deduped.set(candidate.name, { ...candidate });
    }
  }

  debug(`Found ${deduped.size} override candidates`);
  return Array.from(deduped.values());
}

