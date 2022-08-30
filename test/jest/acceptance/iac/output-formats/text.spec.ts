import { EOL } from 'os';
import * as pathLib from 'path';

import { FakeServer } from '../../../../acceptance/fake-server';
import { startMockServer } from '../helpers';

jest.setTimeout(1_000 * 30);

describe('iac test text output', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => Promise<unknown>;

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await teardown();
  });

  it('should show the IaC test title', async () => {
    const dirPath = './iac/terraform';
    const { stdout } = await run(`snyk iac test ${dirPath}`);

    expect(stdout).toContain('Snyk Infrastructure as Code');
  });

  it('should show the spinner message', async () => {
    const dirPath = './iac/terraform';
    const { stdout } = await run(`snyk iac test ${dirPath}`);

    expect(stdout).toContain(
      'Snyk testing Infrastructure as Code configuration issues.',
    );
  });

  it('should show the test completion message', async () => {
    const dirPath = './iac/terraform';
    const { stdout } = await run(`snyk iac test ${dirPath}`);

    expect(stdout).toContain('Test completed.');
  });

  it('should show the issues list section with correct values', async () => {
    const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');

    expect(stdout).toContain(
      '  [Medium] Azure Firewall Network Rule Collection allows public access' +
        EOL +
        '  Info:    That inbound traffic is allowed to a resource from any source instead' +
        EOL +
        '           of a restricted range. That potentially everyone can access your' +
        EOL +
        '           resource' +
        EOL +
        '  Rule:    https://snyk.io/security-rules/SNYK-CC-TF-20' +
        EOL +
        '  Path:    resources[1] > properties > networkRuleCollections[0] > properties >' +
        EOL +
        '           rules[0] > sourceAddresses' +
        EOL +
        '  File:    ./iac/arm/rule_test.json' +
        EOL +
        '  Resolve: Set' +
        EOL +
        '           `properties.networkRuleCollections.properties.rules.sourceAddresses`' +
        EOL +
        '           attribute to specific IP range only, e.g. `192.168.1.0/24`',
    );
  });

  it('should show the test summary section with correct values', async () => {
    const dirPath = 'iac/kubernetes';
    const policyPath = `iac/policy/.snyk`;
    const { stdout } = await run(
      `snyk iac test ${dirPath} --policy-path=${policyPath}`,
    );
    expect(stdout).toContain(
      'Test Summary' +
        EOL.repeat(2) +
        '  Organization: test-org' +
        EOL +
        '  Project name: fixtures' +
        EOL.repeat(2) +
        '✔ Files without issues: 0' +
        EOL +
        '✗ Files with issues: 3' +
        EOL +
        '  Ignored issues: 8' +
        EOL +
        '  Total issues: ',
    );
  });

  describe('with multiple test results', () => {
    describe('with test failures', () => {
      it('should show the failures list section with the correct values', async () => {
        const dirPath = 'iac';
        const { stdout } = await run(
          `snyk iac test ${dirPath} my-imaginary-file.tf my-imaginary-directory/`,
        );

        expect(stdout).toContain(
          '  Failed to parse JSON file' +
            EOL +
            `  Path: ${pathLib.join('iac', 'arm', 'invalid_rule_test.json')}` +
            EOL.repeat(2) +
            '  Failed to parse YAML file' +
            EOL +
            `  Path: ${pathLib.join(
              'iac',
              'cloudformation',
              'invalid-cfn.yml',
            )}` +
            EOL +
            `        ${pathLib.join('iac', 'kubernetes', 'helm-config.yaml')}` +
            EOL +
            `        ${pathLib.join(
              'iac',
              'only-invalid',
              'invalid-file1.yml',
            )}` +
            EOL +
            `        ${pathLib.join(
              'iac',
              'only-invalid',
              'invalid-file2.yaml',
            )}` +
            EOL.repeat(2) +
            '  Failed to parse Terraform file' +
            EOL +
            `  Path: ${pathLib.join(
              'iac',
              'terraform',
              'sg_open_ssh_invalid_go_templates.tf',
            )}` +
            EOL +
            `        ${pathLib.join(
              'iac',
              'terraform',
              'sg_open_ssh_invalid_hcl2.tf',
            )}` +
            EOL.repeat(2) +
            '  Failed to load file content' +
            EOL +
            `  Path: my-imaginary-file.tf` +
            EOL.repeat(2) +
            '  Could not find any valid IaC files' +
            EOL +
            `  Path: my-imaginary-directory/`,
        );
      });

      it('should include user tip for test failures', async () => {
        const dirPath = 'iac/terraform';
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        expect(stdout).toContain(
          'Tip: Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>' +
            EOL +
            'If the issue persists contact support@snyk.io',
        );
      });
    });
  });

  describe('with only test failures', () => {
    it('should display the test failures list', async () => {
      const invalidPaths = [
        pathLib.join('iac', 'cloudformation', 'invalid-cfn.yml'),
        pathLib.join('iac', 'terraform', 'sg_open_ssh_invalid_go_templates.tf'),
        pathLib.join('iac', 'terraform', 'sg_open_ssh_invalid_hcl2.tf'),
        pathLib.join('does', 'not', 'exist'),
      ];
      const { stdout } = await run(`snyk iac test ${invalidPaths.join(' ')}`);

      expect(stdout).toContain(
        '  Failed to parse YAML file' +
          EOL +
          `  Path: ${pathLib.join(
            'iac',
            'cloudformation',
            'invalid-cfn.yml',
          )}` +
          EOL.repeat(2) +
          '  Failed to parse Terraform file' +
          EOL +
          `  Path: ${pathLib.join(
            'iac',
            'terraform',
            'sg_open_ssh_invalid_go_templates.tf',
          )}` +
          EOL +
          `        ${pathLib.join(
            'iac',
            'terraform',
            'sg_open_ssh_invalid_hcl2.tf',
          )}` +
          EOL.repeat(2) +
          '  Could not find any valid IaC files' +
          EOL +
          `  Path: ${pathLib.join('does', 'not', 'exist')}`,
      );
    });
  });

  describe('with no issues', () => {
    it('should display an appropriate message in the issues section', async () => {
      const filePath = 'iac/terraform/vars.tf';
      const { stdout } = await run(`snyk iac test ${filePath}`);

      expect(stdout).toContain('No vulnerable paths were found!');
    });
  });

  describe('with issues generated by custom rules', () => {
    it('should include the public custom rule IDs', async () => {
      const filePath = 'iac/terraform/sg_open_ssh.tf ';
      const { stdout } = await run(
        `snyk iac test ${filePath} --rules=./iac/custom-rules/custom.tar.gz`,
      );

      expect(stdout).toContain(`Rule:    custom rule CUSTOM-1`);
    });
  });
});
