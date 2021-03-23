import { assertIaCOptionsFlags } from './iac-local-execution/assert-iac-options-flag';
import { IaCTestOptions } from './iac-local-execution/types';
import { test as localTest } from './iac-local-execution';
import { test as legacyTest } from '../../../lib';
import { TestResult } from '../../../lib/snyk-test/legacy';
import { IacFileInDirectory } from '../../../lib/types';

/**
 * Shim around the new local execution test path and the existing remote
 * test flow. We also locally deal with the way the legacy test flow exposes
 * the scanned files via the `options.iacDirFiles` object here so that
 * in the new flow we do not mutate the options object.
 */
export async function test(
  pathToScan: string,
  options: IaCTestOptions,
): Promise<{
  results: TestResult | TestResult[];
  failures?: IacFileInDirectory[];
}> {
  // Ensure that all flags are correct. We do this to ensure that the
  // caller doesn't accidentally mistype --experimental and send their
  // configuration files to our backend by accident.
  assertIaCOptionsFlags(process.argv);

  if (options.experimental) {
    // this path is an experimental feature feature for IaC which does issue scanning locally without sending files to our Backend servers.
    // once ready for GA, it is aimed to deprecate our remote-processing model, so IaC file scanning in the CLI is done locally.
    return localTest(pathToScan, options);
  }

  const results = await legacyTest(pathToScan, options);
  return {
    failures: options.iacDirFiles?.filter((file) => !!file.failureReason),
    results,
  };
}
