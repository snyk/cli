import * as fs from 'fs';
import * as path from 'path';
import { showFixTip } from '../../../../../src/lib/formatters/show-fix-tip';
import { SupportedProjectTypes } from '../../../../../src/lib/types';
import stripAnsi = require('strip-ansi');

describe('showFixTip', () => {
  test.each(['yarn', 'npm'])('%p shows `snyk wizard` tip', (p) => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../',
          'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );
    expect(
      stripAnsi(
        showFixTip(p as SupportedProjectTypes, withRemediation, {
          path: 'src',
          showVulnPaths: 'none',
        }),
      ),
    ).toBe('Tip: Run `snyk wizard` to address these issues.');
  });

  test.each(['pip', 'poetry'])('%p shows `snyk fix` tip', (p) => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../',
          'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );
    expect(
      stripAnsi(
        showFixTip(p as SupportedProjectTypes, withRemediation, {
          path: 'src',
          showVulnPaths: 'none',
        }),
      ),
    ).toBe(
      'Tip: Try `snyk fix` to address these issues.`snyk fix` is a new CLI command in that aims to automatically apply the recommended updates for supported ecosystems.\n' +
        'See documentation on how to enable this beta feature: https://support.snyk.io/hc/en-us/articles/4403417279505-Automatic-remediation-with-snyk-fix',
    );
  });

  test.each(['pip', 'poetry'])(
    '%p does not show `snyk fix` tip when there are no issues',
    (p) => {
      const withRemediation = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../../',
            'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-patches.json',
          ),
          'utf8',
        ),
      );

      delete withRemediation.vulnerabilities;
      withRemediation.vulnerabilities = [];
      withRemediation.ok = true;
      expect(
        stripAnsi(
          showFixTip(p as SupportedProjectTypes, withRemediation, {
            path: 'src',
            showVulnPaths: 'none',
          }),
        ),
      ).toBe('');
    },
  );

  test.each([
    'k8sconfig',
    'terraformconfig',
    'cloudformationconfig',
    'customconfig',
    'multiiacconfig',
    'iac',
    'docker',
    'rubygems',
    'maven',
    'sbt',
    'gradle',
    'golangdep',
    'govendor',
    'gomodules',
    'nuget',
    'paket',
    'composer',
    'cocoapods',
    'hex',
  ])('%p shows no fix related tip', (p) => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../',
          'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );
    expect(
      stripAnsi(
        showFixTip(p as SupportedProjectTypes, withRemediation, {
          path: 'src',
          showVulnPaths: 'none',
        }),
      ),
    ).toBe('');
  });
});
