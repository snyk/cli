import * as fs from 'fs';
import * as path from 'path';

import * as scanLib from '../../../../../../../../src/lib/iac/test/v2/scan';
import * as downloadPolicyEngineLib from '../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/download';
import * as downloadRulesBundleLib from '../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle/download';
import { test } from '../../../../../../../../src/cli/commands/test/iac/v2/index';
import { Options, TestOptions } from '../../../../../../../../src/lib/types';
import { isValidJSONString } from '../../../../../../acceptance/iac/helpers';

jest.setTimeout(1000 * 10);

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

  it('without any flags outputs the test results', async () => {
    const result = (
      await test(['path/to/test'], defaultOptions)
    ).getDisplayResults();

    expect(result).toContain('Issues');
    expect(result).toContain('Medium Severity Issues: ');
    expect(result).toContain('High Severity Issues: ');
  });

  it('with `--json` flag', async () => {
    const result = (
      await test(['path/to/test'], {
        ...defaultOptions,
        json: true,
      })
    ).getJsonResult();

    expect(isValidJSONString(result)).toBe(true);
    expect(result).toContain(`"ok": false`);
  });

  it.skip('with `--sarif` flag', async () => {});
});
