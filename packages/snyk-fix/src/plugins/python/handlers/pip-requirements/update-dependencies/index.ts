import * as debugLib from 'debug';

import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { DependencyPins, FixChangesSummary } from '../../../../../types';
import { generatePins } from './generate-pins';
import { applyUpgrades } from './apply-upgrades';
import { parseRequirementsFile } from './requirements-file-parser';
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
  requirementsTxt: string,
  updates: DependencyPins,
): { updatedManifest: string; changes: FixChangesSummary[] } {
  const parsedRequirementsData = parseRequirementsFile(requirementsTxt);

  if (!parsedRequirementsData.length) {
    debug(
      'Error: Expected to receive parsed manifest data. Is manifest empty?',
    );
    throw new FailedToParseManifest();
  }
  debug('Finished parsing manifest');

  const { updatedRequirements, changes: upgradedChanges } = generateUpgrades(
    parsedRequirementsData,
    updates,
  );
  debug('Finished generating upgrades to apply');

  const { pinnedRequirements, changes: pinChanges } = generatePins(
    parsedRequirementsData,
    updates,
  );
  debug('Finished generating pins to apply');

  let updatedManifest = [
    ...applyUpgrades(parsedRequirementsData, updatedRequirements),
    ...pinnedRequirements,
  ].join('\n');

  // This is a bit of a hack, but an easy one to follow. If a file ends with a
  // new line, ensure we keep it this way. Don't hijack customers formatting.
  if (requirementsTxt.endsWith('\n')) {
    updatedManifest += '\n';
  }
  debug('Finished applying changes to manifest');

  // TODO: do this with the changes now that we only return new
  if (updatedManifest === requirementsTxt) {
    debug('Manifest has not changed!');
    throw new NoFixesCouldBeAppliedError();
  }

  return {
    updatedManifest,
    changes: [...pinChanges, ...upgradedChanges],
  };
}
