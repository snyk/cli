import * as fs from 'fs';
import * as pathLib from 'path';

import { formatIacTestFailures } from '../../../../../../../../src/lib/formatters/iac-output/text';
import { colors } from '../../../../../../../../src/lib/formatters/iac-output/text/utils';
import {
  IaCTestFailure,
  IaCTestWarning,
} from '../../../../../../../../src/lib/formatters/iac-output/text/types';
import { formatIacTestWarnings } from '../../../../../../../../src/lib/formatters/iac-output/text/failures/list';

const testFailureFixtures: IaCTestFailure[] = JSON.parse(
  fs.readFileSync(
    pathLib.join(__dirname, 'fixtures', 'test-failures.json'),
    'utf-8',
  ),
);

const testWarningsFixtures: IaCTestWarning[] = JSON.parse(
  fs.readFileSync(
    pathLib.join(__dirname, 'fixtures', 'test-warnings.json'),
    'utf-8',
  ),
);

describe('formatIacTestFailures', () => {
  it('should include the "Invalid files: X" title with the correct value', () => {
    const result = formatIacTestFailures(testFailureFixtures);
    expect(result).toContain(colors.title(`Test Failures`));
  });

  it('should include the failures list with the correct values', () => {
    const result = formatIacTestFailures(testFailureFixtures);

    // Assert
    const expected = `  ${colors.failure.bold('Failed to parse JSON file')}
  Path: ${pathLib.join(
    'test',
    'fixtures',
    'iac',
    'arm',
    'invalid_rule_test.json',
  )}

  ${colors.failure.bold('Failed to parse YAML file')}
  Path: ${pathLib.join(
    'test',
    'fixtures',
    'iac',
    'cloudformation',
    'invalid-cfn.yml',
  )}
        ${pathLib.join(
          'test',
          'fixtures',
          'iac',
          'kubernetes',
          'helm-config.yaml',
        )}

  ${colors.failure.bold('Failed to parse Terraform file')}
  Path: ${pathLib.join(
    'test',
    'fixtures',
    'iac',
    'terraform',
    'sg_open_ssh_invalid_go_templates.tf',
  )}
        ${pathLib.join(
          'test',
          'fixtures',
          'iac',
          'terraform',
          'sg_open_ssh_invalid_hcl2.tf',
        )}`;
    expect(result).toContain(expected);
  });
});

describe('formatIacTestWarnings', () => {
  it('should include the "Test Warnings"', () => {
    const result = formatIacTestWarnings(testWarningsFixtures);

    expect(result).toContain(colors.title(`Test Warnings`));
  });

  it('should include the warnings list with the correct format', () => {
    const result = formatIacTestWarnings(testWarningsFixtures);
    const expected = `  ${colors.warning.bold('missing term value warning')}
  Path: ${pathLib.join('path', 'to', 'file')}
  Term: term

  ${colors.warning.bold('missing term value warning')}
  Path: ${pathLib.join('path', 'to', 'another', 'file')}
  Term: term

  ${colors.warning.bold('Could not load modules')}
  Path: ${pathLib.join('path', 'to', 'file')}
  Module: module1
          module2

  ${colors.warning.bold('Failed to load module')}
  Path: ${pathLib.join('path', 'to', 'file')}
  Module: module1
          module2

  ${colors.warning.bold('evaluation error')}
  Path: ${pathLib.join('path', 'to', 'file')}
  Expression: expression1
              expression2`;

    expect(result).toContain(expected);
  });
});
