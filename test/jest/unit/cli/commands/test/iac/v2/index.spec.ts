import * as fs from 'fs';
import * as path from 'path';

import * as scanLib from '../../../../../../../../src/lib/iac/test/v2/scan';
import * as downloadPolicyEngineLib from '../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/download';
import * as downloadRulesBundleLib from '../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle/download';
import { test } from '../../../../../../../../src/cli/commands/test/iac/v2/index';
import { Options, TestOptions } from '../../../../../../../../src/lib/types';

describe('test', () => {
  const defaultOptions: Options & TestOptions = {
    iac: true,
    path: 'path/to/test',
    showVulnPaths: 'all',
  };
  const snykIacTestfixtureContent = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'iac',
      'process-results',
      'fixtures',
      'snyk-iac-test-results.json',
    ),
    'utf-8',
  );
  const snykIacTestfixture = JSON.parse(snykIacTestfixtureContent);
  jest.spyOn(scanLib, 'scan').mockReturnValue(snykIacTestfixture);
  jest
    .spyOn(downloadPolicyEngineLib, 'downloadPolicyEngine')
    .mockResolvedValue('');
  jest
    .spyOn(downloadRulesBundleLib, 'downloadRulesBundle')
    .mockResolvedValue('');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('without any flags outputs the test results', async () => {
    // Act
    const result = await (
      await test(['path/to/test'], defaultOptions)
    ).getDisplayResults();

    // Assert
    expect(result).toContain('Issues');
    expect(result).toContain('Medium Severity Issues: ');
    expect(result).toContain('High Severity Issues: ');
  });

  it.skip('with `--json` flag', async () => {});

  it.skip('with `--sarif` flag', async () => {});
});
