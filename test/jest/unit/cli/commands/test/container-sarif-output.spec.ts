import { getSarifResult } from '../../../../../../src/cli/commands/test/container-sarif-output';

type Vulnerability = {
  id: string;
  packageName: string;
  severity: string;
  lineNumber?: number;
};

describe('getSarifResult', () => {
  test('should have a message with package and severity details', () => {
    const vuln: Vulnerability = {
      id: 'my-id',
      packageName: 'my-package',
      severity: 'error',
    };
    const result = getSarifResult(vuln, undefined);
    expect(result).toEqual({
      ruleId: 'my-id',
      message: {
        text: `This file introduces a vulnerable my-package package with a error severity vulnerability.`,
      },
    });
    expect(result).not.toHaveProperty('locations');
  });

  test('should include target file at artifact location', () => {
    const vuln: Vulnerability = {
      id: '',
      packageName: 'my-package',
      severity: 'error',
    };
    const result = getSarifResult(vuln, 'my-file');
    expect(result).toHaveProperty('locations', [
      {
        physicalLocation: {
          artifactLocation: {
            uri: 'my-file',
          },
          region: {
            startLine: 1,
          },
        },
      },
    ]);
  });

  test('should include line number from vulnerability', () => {
    const vuln: Vulnerability = {
      id: '',
      packageName: 'my-package',
      severity: 'error',
      lineNumber: 99,
    };
    const result = getSarifResult(vuln, 'my-file');
    expect(result).toHaveProperty('locations.0.physicalLocation.region', {
      startLine: 99,
    });
  });
});
