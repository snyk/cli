import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import * as scanLib from '../../../../../../../../src/lib/iac/test/v2/scan';
import * as downloadPolicyEngineLib from '../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/download';
import * as downloadRulesBundleLib from '../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle/download';
import * as orgSettingsLib from '../../../../../../../../src/cli/commands/test/iac/local-execution/org-settings/get-iac-org-settings';
import { test } from '../../../../../../../../src/cli/commands/test/iac/v2/index';
import { Options, TestOptions } from '../../../../../../../../src/lib/types';
import { isValidJSONString } from '../../../../../../acceptance/iac/helpers';
import { IacOrgSettings } from '../../../../../../../../src/cli/commands/test/iac/local-execution/types';

jest.setTimeout(1000 * 10);

const projectRoot = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
);

const scanFixturePath = path.join(
  projectRoot,
  'test',
  'jest',
  'unit',
  'iac',
  'process-results',
  'fixtures',
  'snyk-iac-test-results.json',
);

describe('test', () => {
  chalk.enabled = false;

  const defaultOptions: Options & TestOptions = {
    iac: true,
    path: 'path/to/test',
    showVulnPaths: 'all',
  };

  const orgSettings: IacOrgSettings = {
    customPolicies: {},
    meta: {
      org: 'my-org-name',
      isLicensesEnabled: false,
      isPrivate: false,
    },
  };

  const scanFixture = JSON.parse(fs.readFileSync(scanFixturePath, 'utf-8'));

  jest.spyOn(scanLib, 'scan').mockReturnValue(scanFixture);

  jest
    .spyOn(downloadPolicyEngineLib, 'downloadPolicyEngine')
    .mockResolvedValue('');

  jest
    .spyOn(downloadRulesBundleLib, 'downloadRulesBundle')
    .mockResolvedValue('');

  jest
    .spyOn(orgSettingsLib, 'getIacOrgSettings')
    .mockResolvedValue(orgSettings);

  it('without any flags outputs the test results', async () => {
    const result = await test(['path/to/test'], defaultOptions);
    const output = result.getDisplayResults();

    expect(output).toContain('Issues');
    expect(output).toContain('Medium Severity Issues: ');
    expect(output).toContain('High Severity Issues: ');
    expect(output).toContain(`Organization: ${orgSettings.meta.org}`);
    expect(output).toContain(`Project name: ${path.basename(projectRoot)}`);
    expect(output).toContain('Files without issues: 1');
    expect(output).toContain('Files with issues: 2');
    expect(output).toContain('Total issues: 3');
    expect(output).toContain('[ 0 critical, 2 high, 1 medium, 0 low ]');
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
