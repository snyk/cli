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
import { SnykIacTestError } from '../../../../../../../../src/lib/iac/test/v2/errors';
import {
  FoundIssuesError,
  NoSuccessfulScansError,
} from '../../../../../../../../src/lib/iac/test/v2/output';

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
  scanFixture.errors = scanFixture.errors.map(
    (scanError) => new SnykIacTestError(scanError),
  );

  const scanWithOnlyErrorsFixture = {
    errors: scanFixture.errors,
  };

  beforeEach(() => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('outputs the test results', async () => {
    // Arrange
    let output: string;

    // Act
    try {
      await test(['path/to/test'], defaultOptions);
    } catch (error) {
      output = error.message;
    }

    // Assert
    expect(output!).toContain('Issues');
    expect(output!).toContain('Medium Severity Issues: ');
    expect(output!).toContain('High Severity Issues: ');
    expect(output!).toContain(`Organization: ${orgSettings.meta.org}`);
    expect(output!).toContain(`Project name: ${path.basename(projectRoot)}`);
    expect(output!).toContain('Files without issues: 1');
    expect(output!).toContain('Files with issues: 2');
    expect(output!).toContain('Total issues: 4');
    expect(output!).toContain('[ 0 critical, 3 high, 1 medium, 0 low ]');
  });

  describe('with no successful scans', () => {
    beforeEach(() => {
      jest.spyOn(scanLib, 'scan').mockReturnValue(scanWithOnlyErrorsFixture);
    });

    it('throws the expected error', async () => {
      // Arrange
      let error;

      // Act
      try {
        await test(['path/to/test'], defaultOptions);
      } catch (err) {
        error = err;
      }

      // Assert
      expect(error).toBeInstanceOf(NoSuccessfulScansError);
      expect(error).toEqual(
        expect.objectContaining({
          name: 'NoSuccessfulScansError',
          message:
            'invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt',
          code: 2106,
          strCode: 'INVALID_INPUT',
          fields: {
            path: '/Users/yairzohar/snyk/upe-test/README.txt',
          },
          path: '/Users/yairzohar/snyk/upe-test/README.txt',
          userMessage:
            'Test Failures\n\n  Invalid input\n  Path: /Users/yairzohar/snyk/upe-test/README.txt',
          formattedUserMessage:
            'Test Failures\n\n  Invalid input\n  Path: /Users/yairzohar/snyk/upe-test/README.txt',
          sarifStringifiedResults: expect.stringContaining(
            `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
          ),
          jsonStringifiedResults:
            '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
          json:
            '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
        }),
      );
    });
  });

  describe('with issues', () => {
    it('throws the expected error', async () => {
      // Act + Assert
      await expect(test(['path/to/test'], defaultOptions)).rejects.toThrowError(
        FoundIssuesError,
      );
    });
  });

  describe('with `--json` flag', () => {
    it('outputs the test results in JSON format', async () => {
      // Arrange
      let result: string;

      // Act
      try {
        await test(['path/to/test'], {
          ...defaultOptions,
          json: true,
        });
      } catch (error) {
        result = error.jsonStringifiedResults;
      }

      // Assert
      expect(isValidJSONString(result!)).toBe(true);
      expect(result!).toContain(`"ok": false`);
    });

    describe('with no successful scans', () => {
      beforeEach(() => {
        jest.spyOn(scanLib, 'scan').mockReturnValue(scanWithOnlyErrorsFixture);
      });

      it('throws the expected error', async () => {
        // Arrange
        let error;

        // Act
        try {
          await test(['path/to/test'], { ...defaultOptions, json: true });
        } catch (err) {
          error = err;
        }

        // Assert
        expect(error).toBeInstanceOf(NoSuccessfulScansError);
        expect(error).toEqual(
          expect.objectContaining({
            name: 'NoSuccessfulScansError',
            message:
              '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
            code: 2106,
            strCode: 'INVALID_INPUT',
            fields: {
              path: '/Users/yairzohar/snyk/upe-test/README.txt',
            },
            path: '/Users/yairzohar/snyk/upe-test/README.txt',
            userMessage:
              '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
            formattedUserMessage:
              '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
            sarifStringifiedResults: expect.stringContaining(
              `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
            ),
            jsonStringifiedResults:
              '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
            json:
              '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
          }),
        );
      });
    });
  });

  describe('with `--sarif` flag', () => {
    it('outputs the test results in SARIF format', async () => {
      // Arrange
      let result: string;

      // Act
      try {
        await test(['path/to/test'], {
          ...defaultOptions,
          sarif: true,
        });
      } catch (error) {
        result = error.sarifStringifiedResults;
      }

      // Assert
      expect(isValidJSONString(result!)).toBe(true);
      expect(result!).toContain(
        `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
      );
    });

    describe('with no successful scans', () => {
      beforeEach(() => {
        jest.spyOn(scanLib, 'scan').mockReturnValue(scanWithOnlyErrorsFixture);
      });

      it('throws the expected error', async () => {
        // Arrange
        let error;

        // Act
        try {
          await test(['path/to/test'], { ...defaultOptions, sarif: true });
        } catch (err) {
          error = err;
        }

        // Assert
        expect(error).toBeInstanceOf(NoSuccessfulScansError);
        expect(error).toEqual(
          expect.objectContaining({
            name: 'NoSuccessfulScansError',
            message: expect.stringContaining(
              `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
            ),
            code: 2106,
            strCode: 'INVALID_INPUT',
            fields: {
              path: '/Users/yairzohar/snyk/upe-test/README.txt',
            },
            path: '/Users/yairzohar/snyk/upe-test/README.txt',
            userMessage: expect.stringContaining(
              `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
            ),
            formattedUserMessage: expect.stringContaining(
              `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
            ),
            sarifStringifiedResults: expect.stringContaining(
              `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
            ),
            jsonStringifiedResults:
              '[\n  {\n    "ok": false,\n    "error": "invalid input for input type: /Users/yairzohar/snyk/upe-test/README.txt",\n    "path": "/Users/yairzohar/snyk/upe-test/README.txt"\n  }\n]',
            json: expect.stringContaining(
              `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
            ),
          }),
        );
      });
    });
  });
});
