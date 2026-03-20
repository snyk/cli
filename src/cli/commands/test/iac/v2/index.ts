import { TestCommandResult } from '../../../types';
import { buildOutput } from '../../../../../lib/iac/test/v2/output';
import { getFlag } from '../index';
import { IaCTestFlags } from '../local-execution/types';
import { addIacAnalytics } from '../../../../../lib/iac/test/v2/analytics';
import { getResultFromOutputFile } from '../../../../../lib/iac/test/v2/scan';

export async function test(
  paths: string[],
  options: IaCTestFlags,
  iacNewEngine?: boolean,
): Promise<TestCommandResult> {
  const iacTestOutputFile = options['iac-test-output-file'];
  if (!iacTestOutputFile) {
    throw new Error(
      'The snyk-iac-test binary is no longer supported. IaC scanning is now handled by the CLI extension.',
    );
  }
  return buildResultFromCliExtensionIac(
    iacTestOutputFile,
    options,
    iacNewEngine,
  );
}

async function buildResultFromCliExtensionIac(
  iacTestOutputFile: string,
  options: IaCTestFlags,
  iacNewEngine?: boolean,
): Promise<TestCommandResult> {
  const testOutput = await getResultFromOutputFile(iacTestOutputFile);

  const testConfig = {
    snykCloudEnvironment: getFlag(options, 'snyk-cloud-environment'),
  };
  addIacAnalytics(testConfig, testOutput);

  return buildOutput({
    scanResult: testOutput,
    options,
    iacNewEngine,
  });
}
