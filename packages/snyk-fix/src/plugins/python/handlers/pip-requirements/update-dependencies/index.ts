import * as debugLib from 'debug';

import { DependencyPins, FixChangesSummary } from '../../../../../types';
import { generatePins } from './generate-pins';
import { applyUpgrades } from './apply-upgrades';
import { ParsedRequirements } from './requirements-file-parser';
import { generateUpgrades } from './generate-upgrades';
import { FailedToParseManifest } from '../../../../../lib/errors/failed-to-parse-manifest';

const debug = debugLib('snyk-fix:python:update-dependencies');

/*
 * Given contents of manifest file(s) and a set of upgrades, apply the given
 * upgrades to a manifest and return the upgraded manifest.
 *
 * Currently only supported for `requirements.txt` - at least one file named
 * `requirements.txt` must be in the manifests.
 */
export function updateDependencies(
  parsedRequirementsData: ParsedRequirements,
  updates: DependencyPins,
  directUpgradesOnly = false,
): { updatedManifest: string; changes: FixChangesSummary[] } {
  const {
    requirements,
    endsWithNewLine: shouldEndWithNewLine,
  } = parsedRequirementsData;
  if (!requirements.length) {
    debug(
      'Error: Expected to receive parsed manifest data. Is manifest empty?',
    );
    throw new FailedToParseManifest();
  }
  debug('Finished parsing manifest');

  const { updatedRequirements, changes: upgradedChanges } = generateUpgrades(
    requirements,
    updates,
  );
  debug('Finished generating upgrades to apply');

  let pinnedRequirements: string[] = [];
  let pinChanges: FixChangesSummary[] = [];
  if (!directUpgradesOnly) {
    ({ pinnedRequirements, changes: pinChanges } = generatePins(
      requirements,
      updates,
    ));
    debug('Finished generating pins to apply');
  }

  let updatedManifest = [
    ...applyUpgrades(requirements, updatedRequirements),
    ...pinnedRequirements,
  ].join('\n');

  // This is a bit of a hack, but an easy one to follow. If a file ends with a
  // new line, ensure we keep it this way. Don't hijack customers formatting.
  if (shouldEndWithNewLine) {
    updatedManifest += '\n';
  }
  debug('Finished applying changes to manifest');

  return {
    updatedManifest,
    changes: [...pinChanges, ...upgradedChanges],
  };
}
