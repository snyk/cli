import * as fs from 'fs';
import * as pathLib from 'path';

import { formatIacTestFailures } from '../../../../../../../../src/lib/formatters/iac-output';
import { colors } from '../../../../../../../../src/lib/formatters/iac-output/v2/color-utils';
import { IacFileInDirectory } from '../../../../../../../../src/lib/types';

const testFailureFixtures: IacFileInDirectory[] = JSON.parse(
  fs.readFileSync(
    pathLib.join(__dirname, 'fixtures', 'test-failures.json'),
    'utf-8',
  ),
);

describe('formatIacTestFailures', () => {
  it('should include the "Invalid Files: X" title with the correct value', () => {
    // Act
    const result = formatIacTestFailures(testFailureFixtures);

    // Assert
    expect(result).toContain(colors.info.bold(`Invalid Files: 5`));
  });

  it('should include the failures list with the correct values', () => {
    // Act
    const result = formatIacTestFailures(testFailureFixtures);

    // Assert
    expect(result).toContain(
      `${colors.failure.bold('Failed to parse JSON file')}
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
      )}`,
    );
  });
});
