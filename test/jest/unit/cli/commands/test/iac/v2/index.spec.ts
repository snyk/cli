import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import * as scanLib from '../../../../../../../../src/lib/iac/test/v2/scan';
import * as downloadPolicyEngineLib from '../../../../../../../../src/lib/iac/test/v2/local-cache/policy-engine/download';
import * as downloadRulesBundleLib from '../../../../../../../../src/lib/iac/test/v2/local-cache/rules-bundle/download';
import { test } from '../../../../../../../../src/cli/commands/test/iac/v2/index';
import { isValidJSONString } from '../../../../../../acceptance/iac/helpers';
import { SnykIacTestError } from '../../../../../../../../src/lib/iac/test/v2/errors';
import {
  FoundIssuesError,
  NoLoadableInputError,
  NoSuccessfulScansError,
} from '../../../../../../../../src/lib/iac/test/v2/output';
import { pathToFileURL } from 'url';

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

  const scanFixture = JSON.parse(fs.readFileSync(scanFixturePath, 'utf-8'));
  scanFixture.errors = scanFixture.errors.map(
    (scanError) => new SnykIacTestError(scanError),
  );

  const scanWithOnlyErrorsFixture = {
    errors: scanFixture.errors,
    settings: {
      org: 'org-name',
      ignoreSettings: {
        adminOnly: false,
        disregardFilesystemIgnores: false,
        reasonRequired: false,
      },
    },
  };

  const scanWithoutLoadableInputsFixture = {
    errors: [
      new SnykIacTestError({
        code: 2114,
        message: 'no loadable input: path/to/test',
        fields: {
          path: 'path/to/test',
        },
      }),
    ],
    settings: {
      org: 'org-name',
      ignoreSettings: {
        adminOnly: false,
        disregardFilesystemIgnores: false,
        reasonRequired: false,
      },
    },
  };

  beforeEach(() => {
    jest.spyOn(scanLib, 'scan').mockReturnValue(scanFixture);

    jest
      .spyOn(downloadPolicyEngineLib, 'downloadPolicyEngine')
      .mockResolvedValue('');

    jest
      .spyOn(downloadRulesBundleLib, 'downloadRulesBundle')
      .mockResolvedValue('');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('outputs the test results', async () => {
    // Arrange
    let output: string;

    // Act
    try {
      await test(['path/to/test'], {});
    } catch (error) {
      output = error.message;
    }

    // Assert
    expect(output!).toContain('Issues');
    expect(output!).toContain('Severity Issues: ');
    expect(output!).toContain(`Organization: org-name`);
    expect(output!).toContain('Files without issues: ');
    expect(output!).toContain('Files with issues: ');
    expect(output!).toContain('Total issues: ');
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
        await test(['path/to/test'], {});
      } catch (err) {
        error = err;
      }

      // Assert
      expect(error).toBeInstanceOf(NoSuccessfulScansError);
      expect(error).toMatchObject({
        name: 'NoLoadableInputError',
        code: 1010,
        strCode: 'NO_FILES_TO_SCAN_ERROR',
        innerError: undefined,
        userMessage:
          "Test Failures\n\n  The Snyk CLI couldn't find any valid IaC configuration files to scan\n  Path: invalid_file.txt",
        formattedUserMessage:
          "Test Failures\n\n  The Snyk CLI couldn't find any valid IaC configuration files to scan\n  Path: invalid_file.txt",
        json:
          '[\n  {\n    "ok": false,\n    "error": "",\n    "path": "invalid_file.txt"\n  }\n]',
        jsonStringifiedResults:
          '[\n  {\n    "ok": false,\n    "error": "",\n    "path": "invalid_file.txt"\n  }\n]',
        sarifStringifiedResults: `{\n  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",\n  "version": "2.1.0",\n  "runs": [\n    {\n      "originalUriBaseIds": {\n        "PROJECTROOT": {\n          "uri": "${
          pathToFileURL(path.join(process.cwd(), '/')).href
        }",\n          "description": {\n            "text": "The root directory for all project files."\n          }\n        }\n      },\n      "tool": {\n        "driver": {\n          "name": "Snyk IaC",\n          "fullName": "Snyk Infrastructure as Code",\n          "version": "1.0.0-monorepo",\n          "informationUri": "https://docs.snyk.io/products/snyk-infrastructure-as-code",\n          "rules": []\n        }\n      },\n      "automationDetails": {\n        "id": "snyk-iac"\n      },\n      "results": []\n    }\n  ]\n}`,
        fields: {
          path: 'invalid_file.txt',
        },
      });
    });

    describe('without loadable inputs', () => {
      beforeEach(() => {
        jest
          .spyOn(scanLib, 'scan')
          .mockReturnValue(scanWithoutLoadableInputsFixture);
      });

      it('throws the expected error', async () => {
        // Arrange
        let error;

        // Act
        try {
          await test(['path/to/test'], {});
        } catch (err) {
          error = err;
        }

        // Assert
        expect(error).toBeInstanceOf(NoLoadableInputError);
        expect(error).toEqual(
          expect.objectContaining({
            name: 'NoLoadableInputError',
            message: 'no loadable input: path/to/test',
            code: 1010,
            strCode: 'NO_FILES_TO_SCAN_ERROR',
            fields: {
              path: 'path/to/test',
            },
            path: 'path/to/test',
            userMessage:
              "Test Failures\n\n  The Snyk CLI couldn't find any valid IaC configuration files to scan\n  Path: path/to/test",
            formattedUserMessage:
              "Test Failures\n\n  The Snyk CLI couldn't find any valid IaC configuration files to scan\n  Path: path/to/test",
            sarifStringifiedResults: expect.stringContaining(
              `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
            ),
            jsonStringifiedResults:
              '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
            json:
              '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
          }),
        );
      });
    });
  });

  describe('with issues', () => {
    it('throws the expected error', async () => {
      // Act + Assert
      await expect(test(['path/to/test'], {})).rejects.toThrowError(
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
          await test(['path/to/test'], { json: true });
        } catch (err) {
          error = err;
        }

        // Assert
        expect(error).toBeInstanceOf(NoSuccessfulScansError);
        expect(error).toMatchObject({
          name: 'NoLoadableInputError',
          code: 1010,
          strCode: 'NO_FILES_TO_SCAN_ERROR',
          innerError: undefined,
          userMessage:
            '[\n  {\n    "ok": false,\n    "error": "",\n    "path": "invalid_file.txt"\n  }\n]',
          formattedUserMessage:
            '[\n  {\n    "ok": false,\n    "error": "",\n    "path": "invalid_file.txt"\n  }\n]',
          json:
            '[\n  {\n    "ok": false,\n    "error": "",\n    "path": "invalid_file.txt"\n  }\n]',
          jsonStringifiedResults:
            '[\n  {\n    "ok": false,\n    "error": "",\n    "path": "invalid_file.txt"\n  }\n]',
          sarifStringifiedResults: `{\n  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",\n  "version": "2.1.0",\n  "runs": [\n    {\n      "originalUriBaseIds": {\n        "PROJECTROOT": {\n          "uri": "${
            pathToFileURL(path.join(process.cwd(), '/')).href
          }",\n          "description": {\n            "text": "The root directory for all project files."\n          }\n        }\n      },\n      "tool": {\n        "driver": {\n          "name": "Snyk IaC",\n          "fullName": "Snyk Infrastructure as Code",\n          "version": "1.0.0-monorepo",\n          "informationUri": "https://docs.snyk.io/products/snyk-infrastructure-as-code",\n          "rules": []\n        }\n      },\n      "automationDetails": {\n        "id": "snyk-iac"\n      },\n      "results": []\n    }\n  ]\n}`,
          fields: {
            path: 'invalid_file.txt',
          },
        });
      });

      describe('without loadable inputs', () => {
        beforeEach(() => {
          jest
            .spyOn(scanLib, 'scan')
            .mockReturnValue(scanWithoutLoadableInputsFixture);
        });

        it('throws the expected error', async () => {
          // Arrange
          let error;

          // Act
          try {
            await test(['path/to/test'], {
              json: true,
            });
          } catch (err) {
            error = err;
          }

          // Assert
          expect(error).toBeInstanceOf(NoLoadableInputError);
          expect(error).toEqual(
            expect.objectContaining({
              name: 'NoLoadableInputError',
              message:
                '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
              code: 1010,
              strCode: 'NO_FILES_TO_SCAN_ERROR',
              fields: {
                path: 'path/to/test',
              },
              path: 'path/to/test',
              userMessage:
                '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
              formattedUserMessage:
                '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
              sarifStringifiedResults: expect.stringContaining(
                `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
              ),
              jsonStringifiedResults:
                '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
              json:
                '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
            }),
          );
        });
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
          await test(['path/to/test'], { sarif: true });
        } catch (err) {
          error = err;
        }

        // Assert
        expect(error).toBeInstanceOf(NoSuccessfulScansError);
        expect(error).toMatchObject({
          name: 'NoLoadableInputError',
          code: 1010,
          strCode: 'NO_FILES_TO_SCAN_ERROR',
          innerError: undefined,
          userMessage: `{\n  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",\n  "version": "2.1.0",\n  "runs": [\n    {\n      "originalUriBaseIds": {\n        "PROJECTROOT": {\n          "uri": "${
            pathToFileURL(path.join(process.cwd(), '/')).href
          }",\n          "description": {\n            "text": "The root directory for all project files."\n          }\n        }\n      },\n      "tool": {\n        "driver": {\n          "name": "Snyk IaC",\n          "fullName": "Snyk Infrastructure as Code",\n          "version": "1.0.0-monorepo",\n          "informationUri": "https://docs.snyk.io/products/snyk-infrastructure-as-code",\n          "rules": []\n        }\n      },\n      "automationDetails": {\n        "id": "snyk-iac"\n      },\n      "results": []\n    }\n  ]\n}`,
          formattedUserMessage: `{\n  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",\n  "version": "2.1.0",\n  "runs": [\n    {\n      "originalUriBaseIds": {\n        "PROJECTROOT": {\n          "uri": "${
            pathToFileURL(path.join(process.cwd(), '/')).href
          }",\n          "description": {\n            "text": "The root directory for all project files."\n          }\n        }\n      },\n      "tool": {\n        "driver": {\n          "name": "Snyk IaC",\n          "fullName": "Snyk Infrastructure as Code",\n          "version": "1.0.0-monorepo",\n          "informationUri": "https://docs.snyk.io/products/snyk-infrastructure-as-code",\n          "rules": []\n        }\n      },\n      "automationDetails": {\n        "id": "snyk-iac"\n      },\n      "results": []\n    }\n  ]\n}`,
          json: `{\n  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",\n  "version": "2.1.0",\n  "runs": [\n    {\n      "originalUriBaseIds": {\n        "PROJECTROOT": {\n          "uri": "${
            pathToFileURL(path.join(process.cwd(), '/')).href
          }",\n          "description": {\n            "text": "The root directory for all project files."\n          }\n        }\n      },\n      "tool": {\n        "driver": {\n          "name": "Snyk IaC",\n          "fullName": "Snyk Infrastructure as Code",\n          "version": "1.0.0-monorepo",\n          "informationUri": "https://docs.snyk.io/products/snyk-infrastructure-as-code",\n          "rules": []\n        }\n      },\n      "automationDetails": {\n        "id": "snyk-iac"\n      },\n      "results": []\n    }\n  ]\n}`,
          jsonStringifiedResults:
            '[\n  {\n    "ok": false,\n    "error": "",\n    "path": "invalid_file.txt"\n  }\n]',
          sarifStringifiedResults: `{\n  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",\n  "version": "2.1.0",\n  "runs": [\n    {\n      "originalUriBaseIds": {\n        "PROJECTROOT": {\n          "uri": "${
            pathToFileURL(path.join(process.cwd(), '/')).href
          }",\n          "description": {\n            "text": "The root directory for all project files."\n          }\n        }\n      },\n      "tool": {\n        "driver": {\n          "name": "Snyk IaC",\n          "fullName": "Snyk Infrastructure as Code",\n          "version": "1.0.0-monorepo",\n          "informationUri": "https://docs.snyk.io/products/snyk-infrastructure-as-code",\n          "rules": []\n        }\n      },\n      "automationDetails": {\n        "id": "snyk-iac"\n      },\n      "results": []\n    }\n  ]\n}`,
          fields: {
            path: 'invalid_file.txt',
          },
        });
      });

      describe('without loadable inputs', () => {
        beforeEach(() => {
          jest
            .spyOn(scanLib, 'scan')
            .mockReturnValue(scanWithoutLoadableInputsFixture);
        });

        it('throws the expected error', async () => {
          // Arrange
          let error;

          // Act
          try {
            await test(['path/to/test'], {
              sarif: true,
            });
          } catch (err) {
            error = err;
          }

          // Assert
          expect(error).toBeInstanceOf(NoLoadableInputError);
          expect(error).toEqual(
            expect.objectContaining({
              name: 'NoLoadableInputError',
              message: expect.stringContaining(
                `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
              ),
              code: 1010,
              strCode: 'NO_FILES_TO_SCAN_ERROR',
              fields: {
                path: 'path/to/test',
              },
              path: 'path/to/test',
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
                '[\n  {\n    "ok": false,\n    "error": "no loadable input: path/to/test",\n    "path": "path/to/test"\n  }\n]',
              json: expect.stringContaining(
                `"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"`,
              ),
            }),
          );
        });
      });
    });
  });
});
