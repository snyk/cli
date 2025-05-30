import { isValidJSONString, startMockServer } from './helpers';
import { InvalidYamlFileError } from '../../../../src/cli/commands/test/iac/local-execution/yaml-parser';
import { EOL } from 'os';
import * as pathLib from 'path';
import { FakeServer } from '../../../acceptance/fake-server';
import { getErrorUserMessage } from '../../../../src/lib/iac/test/v2/errors';

jest.setTimeout(50000);

describe('Directory scan', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => {
    await teardown();
  });

  it('scans all files in a directory with Kubernetes files', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ./iac/kubernetes/`);
    expect(stdout).toContainText('File:    pod-privileged.yaml'); //directory scan shows relative path to cwd in output
    expect(stdout).toContainText('File:    pod-privileged-multi.yaml');
    expect(stdout).toContainText('File:    pod-valid.json');
    expect(stdout).toContainText(
      'Failed to parse YAML file' +
        EOL +
        `  Path: ${pathLib.join('iac', 'kubernetes', 'helm-config.yaml')}`,
    );
    expect(stdout).toContainText('Files with issues: 3');
    expect(exitCode).toBe(1);
  });

  it('scans all files in a directory with a mix of IaC files', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ./iac/`);
    //directory scan shows relative path to cwd  in output
    // here we assert just on the filename to avoid the different slashes (/) for Unix/Windows on the CI runner
    expect(stdout).toContainText(
      `File:    ${pathLib.join('kubernetes', 'pod-privileged.yaml')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('kubernetes', 'pod-privileged-multi.yaml')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('arm', 'rule_test.json')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('cloudformation', 'aurora-valid.yml')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('cloudformation', 'fargate-valid.json')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('depth_detection', 'root.tf')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('terraform-plan', 'tf-plan-update.json')}`,
    );
    expect(stdout).toContainText(
      'Failed to parse Terraform file' +
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
        )}`,
    );
    expect(stdout).toContainText(
      'Failed to parse YAML file' +
        EOL +
        `  Path: ${pathLib.join('iac', 'cloudformation', 'invalid-cfn.yml')}` +
        EOL +
        `        ${pathLib.join('iac', 'kubernetes', 'helm-config.yaml')}` +
        EOL +
        `        ${pathLib.join('iac', 'only-invalid', 'invalid-file1.yml')}` +
        EOL +
        `        ${pathLib.join('iac', 'only-invalid', 'invalid-file2.yaml')}`,
    );
    expect(stdout).toContainText(
      'Failed to parse JSON file' +
        EOL +
        `  Path: ${pathLib.join('iac', 'arm', 'invalid_rule_test.json')}`,
    );
    expect(stdout).toEqual(expect.stringMatching(/Files without issues: \d/));
    expect(stdout).toEqual(expect.stringMatching(/Files with issues: \d/));
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --severity-threshold=high`,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContainText(
      'Failed to parse Terraform file' +
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
        )}`,
    );
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --sarif`,
    );
    expect(exitCode).toBe(1);
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContainText('"id": "SNYK-CC-TF-1",');
    expect(stdout).toContainText('"ruleId": "SNYK-CC-TF-1",');
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --json`,
    );
    expect(exitCode).toBe(1);
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContainText('"id": "SNYK-CC-TF-1",');
    expect(stdout).toContainText('"packageManager": "terraformconfig",');
  });

  it('limits the depth of the directories', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/depth_detection/  --detection-depth=2`,
    );
    expect(exitCode).toBe(1);

    // The CLI shows the output relative to the path: one/one.tf.
    // here we assert just on the filename to avoid the different slashes (/) for Unix/Windows on the CI runner
    expect(stdout).toContainText('Issues');
    expect(stdout).toContainText('root.tf');
    expect(stdout).toContainText(
      '✔ Files without issues: 1' + EOL + '✗ Files with issues: 1',
    );
    expect(stdout).not.toContain('two.tf');
  });

  describe('Variadic - multiple path scans', () => {
    it('outputs both results and failures combined when scanning three paths', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform ./iac/cloudformation ./iac/arm`,
      );
      //directory scan shows relative path to cwd  in output
      expect(stdout).toContainText('File:    sg_open_ssh.tf');
      expect(stdout).toContainText('File:    aurora-valid.yml');
      expect(stdout).toContainText('File:    rule_test.json');
      expect(stdout).toContainText('sg_open_ssh_invalid_hcl2.tf');
      expect(stdout).toContainText(
        'Failed to parse Terraform file' +
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
          )}`,
      );
      expect(stdout).toContainText(
        'Failed to parse YAML file' +
          EOL +
          `  Path: ${pathLib.join('iac', 'cloudformation', 'invalid-cfn.yml')}`,
      );
      expect(stdout).toContainText(
        'Failed to parse JSON file' +
          EOL +
          `  Path: ${pathLib.join('iac', 'arm', 'invalid_rule_test.json')}`,
      );
      expect(exitCode).toBe(1);
    });

    it('outputs both results and failures combined with --json flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform ./iac/cloudformation --json`,
      );

      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContainText('"id": "SNYK-CC-TF-1",');
      expect(stdout).toContainText('"id": "SNYK-CC-TF-124",');
      expect(stdout).toContainText('"packageManager": "terraformconfig",');
      expect(stdout).toContainText('"projectType": "terraformconfig",');
      expect(stdout).toContainText('"id": "SNYK-CC-AWS-422",');
      expect(stdout).toContainText('"packageManager": "cloudformationconfig",');
      expect(stdout).toContainText('"projectType": "cloudformationconfig",');
      expect(exitCode).toBe(1);
    });

    it('outputs both results and failures combined with --sarif flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform ./iac/cloudformation --sarif`,
      );

      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContainText('"ruleId": "SNYK-CC-TF-1",');
      expect(stdout).toContainText('"ruleId": "SNYK-CC-TF-124",');
      expect(stdout).toContainText('"ruleId": "SNYK-CC-AWS-422",');
      expect(exitCode).toBe(1);
    });

    // regression test to check the case that an invalid path would override the overall output
    it('outputs both results and failures for first path when the last path is empty or non-existent', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm non-existing-dir`,
      );
      //directory scan shows relative path to cwd  in output
      expect(stdout).toContainText('File:    rule_test.json');
      expect(stdout).toContainText(
        'Failed to parse JSON file' +
          EOL +
          `  Path: ${pathLib.join('iac', 'arm', 'invalid_rule_test.json')}`,
      );
      expect(stdout).toContainText(
        'Could not find any valid IaC files' + EOL + `  Path: non-existing-dir`,
      );
      expect(exitCode).toBe(1);
    });

    it('outputs issues and errors when one of the paths fails, with --json flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm non-existing-dir --json`,
      );
      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContainText('"id": "SNYK-CC-TF-20",');
      expect(stdout).toContainText('"ok": false');
      expect(stdout).toContainText(
        '"error": "Could not find any valid IaC files"',
      );
      expect(stdout).toContainText('"path": "non-existing-dir"');
      expect(exitCode).toBe(3);
    });

    it('filters out errors when one of the paths fails, with --sarif flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm non-existing-dir --sarif`,
      );
      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).not.toContain(
        '"error": "Could not find any valid IaC files"',
      );
      expect(stdout).not.toContain('"path": "non-existing-dir"');
      expect(exitCode).toBe(1);
    });
  });

  describe('directory with files that can not be parsed', () => {
    it('prints all invalid paths', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/only-invalid`,
      );
      const filePath = pathLib.join('iac', 'only-invalid', 'invalid-file1.yml');
      expect(stdout).toContainText(new InvalidYamlFileError(filePath).message);
      expect(exitCode).toBe(2);
    });
    it('prints all errors and paths in --json', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/only-invalid --json`,
      );

      expect(isValidJSONString(stdout)).toBe(true);

      expect(JSON.parse(stdout).length).toBe(2);
      expect(stdout).toContainText('"ok": false');
      expect(stdout).toContainText('"error": "Failed to parse YAML file"');
      expect(exitCode).toBe(2);
    });
  });

  describe('Exit codes', () => {
    describe('Issues found', () => {
      it('returns 1 even if some files failed to parse', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/kubernetes/`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContainText(
          '✔ Files without issues: 0' + EOL + '✗ Files with issues: 3',
        );
        expect(exitCode).toBe(1);
      });
      it('returns 1 even if some files failed to parse - using --json flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/kubernetes/  --json`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContainText('"ok": false');
        expect(exitCode).toBe(1);
      });

      it('returns 1 even if some files failed to parse - using --sarif flag', async () => {
        const { exitCode, stderr } = await run(
          `snyk iac test ./iac/kubernetes/  --sarif`,
        );
        expect(stderr).toBe('');
        expect(exitCode).toBe(1);
      });
    });

    describe('No Issues found', () => {
      it('returns 0 even if some files failed to parse', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContainText('No vulnerable paths were found!');
        expect(exitCode).toBe(0);
      });

      it('returns 0 even if some files failed to parse - using --json flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high  --json`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContainText('"ok": true');
        expect(exitCode).toBe(0);
      });

      it('returns 0 even if some files failed to parse - using --sarif flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high  --sarif`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContainText('"results": []');
        expect(exitCode).toBe(0);
      });
    });
  });
});

describe('Directory scan for IaCV2', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    server = result.server;
    run = result.run;
    teardown = result.teardown;
  });

  beforeEach(() => {
    server.setFeatureFlag('iacNewEngine', true);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => teardown());

  it('scans all files in a directory with Kubernetes files', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ./iac/kubernetes/`);
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'kubernetes', 'pod-privileged.yaml')}`,
    ); //directory scan shows relative path to cwd in output
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'kubernetes', 'pod-privileged-multi.yaml')}`,
    );

    expect(stdout).toContainText(
      'Failed to parse input' +
        EOL +
        `  Path: ${pathLib.join('iac', 'kubernetes', 'helm-config.yaml')}`,
    );
    expect(stdout).toContainText('Files with issues: 2');
    expect(exitCode).toBe(1);
  });

  it('scans all files in a directory with a mix of IaC files', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ./iac/`);
    //directory scan shows relative path to cwd  in output
    // here we assert just on the filename to avoid the different slashes (/) for Unix/Windows on the CI runner
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'kubernetes', 'pod-privileged.yaml')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'kubernetes', 'pod-privileged-multi.yaml')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'arm', 'rule_test.json')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'cloudformation', 'aurora-valid.yml')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'cloudformation', 'fargate-valid.json')}`,
    );
    expect(stdout).toContainText(
      `File:    ${pathLib.join('iac', 'depth_detection', 'root.tf')}`,
    );

    expect(stdout).toEqual(expect.stringMatching(/Files without issues: \d/));
    expect(stdout).toEqual(expect.stringMatching(/Files with issues: \d/));
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --severity-threshold=high`,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContainText(
      'Failed to parse input' +
        EOL +
        `  Path: ${pathLib.join('iac', 'terraform')}` +
        EOL +
        `  ${pathLib.join(
          'iac',
          'terraform',
          'sg_open_ssh_invalid_go_templates.tf',
        )}` +
        EOL +
        `        ${pathLib.join(
          'iac',
          'terraform',
          'sg_open_ssh_invalid_hcl2.tf',
        )}`,
    );
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --sarif`,
    );
    expect(exitCode).toBe(1);
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContainText('"id": "SNYK-CC-00747",');
    expect(stdout).toContainText('"ruleId": "SNYK-CC-00747",');
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --json`,
    );
    expect(exitCode).toBe(1);
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContainText('"id": "SNYK-CC-00747",');
    expect(stdout).toContainText('"packageManager": "terraformconfig",');
  });

  it('limits the depth of the directories', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/depth_detection/  --detection-depth=2`,
    );
    expect(exitCode).toBe(1);

    // The CLI shows the output relative to the path: one/one.tf.
    // here we assert just on the filename to avoid the different slashes (/) for Unix/Windows on the CI runner
    expect(stdout).toContainText('Issues');
    expect(stdout).toContainText('root.tf');
    expect(stdout).toContainText(
      '✔ Files without issues: 0' + EOL + '✗ Files with issues: 1',
    );
    expect(stdout).not.toContain('two.tf');
  });

  describe('Variadic - multiple path scans', () => {
    it('outputs both results and failures combined when scanning three paths', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform ./iac/cloudformation ./iac/arm`,
      );
      //directory scan shows relative path to cwd  in output
      expect(stdout).toContainText(
        `File:    ${pathLib.join('iac', 'terraform', 'sg_open_ssh.tf')}`,
      );
      expect(stdout).toContainText(
        `File:    ${pathLib.join('iac', 'cloudformation', 'aurora-valid.yml')}`,
      );
      expect(stdout).toContainText(
        `File:    ${pathLib.join('iac', 'arm', 'rule_test.json')}`,
      );
      expect(stdout).toContainText('sg_open_ssh_invalid_hcl2.tf');
      expect(stdout).toContainText(
        'Failed to parse input' +
          EOL +
          `  Path: ${pathLib.join('iac', 'terraform')}` +
          EOL +
          `  ${pathLib.join(
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
          EOL +
          `  ${pathLib.join('iac', 'cloudformation', 'invalid-cfn.yml')}` +
          EOL +
          `  ${pathLib.join('iac', 'arm', 'invalid_rule_test.json')}`,
      );
      expect(exitCode).toBe(1);
    });

    it('outputs both results and failures combined with --json flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform ./iac/cloudformation --json`,
      );

      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContainText('"id": "SNYK-CC-00002",');
      expect(stdout).toContainText('"id": "SNYK-CC-00143",');
      expect(stdout).toContainText('"packageManager": "terraformconfig",');
      expect(stdout).toContainText('"projectType": "terraformconfig",');
      expect(stdout).toContainText('"id": "SNYK-CC-00256",');
      expect(stdout).toContainText('"packageManager": "cloudformationconfig",');
      expect(stdout).toContainText('"projectType": "cloudformationconfig",');
      expect(exitCode).toBe(1);
    });

    it('outputs both results and failures combined with --sarif flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform ./iac/cloudformation --sarif`,
      );

      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContainText('"ruleId": "SNYK-CC-00002",');
      expect(stdout).toContainText('"ruleId": "SNYK-CC-00143",');
      expect(stdout).toContainText('"ruleId": "SNYK-CC-00231",');
      expect(exitCode).toBe(1);
    });

    // regression test to check the case that an invalid path would override the overall output
    it('outputs both results and failures for first path when the last path is empty or non-existent', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm non-existing-dir`,
      );
      //directory scan shows relative path to cwd  in output
      expect(stdout).toContainText(
        `File:    ${pathLib.join('iac', 'arm', 'rule_test.json')}`,
      );
      expect(stdout).toContainText(
        'Failed to parse input' +
          EOL +
          `  Path: ${pathLib.join('iac', 'arm', 'invalid_rule_test.json')}`,
      );
      expect(stdout).toContainText(
        'Unable to read path' + EOL + `  Path: non-existing-dir`,
      );
      expect(exitCode).toBe(1);
    });

    it('outputs issues and errors when one of the paths fails, with --json flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm non-existing-dir --json`,
      );
      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContainText('"id": "SNYK-CC-00477",');
      expect(stdout).toContainText('"ok": false');
      expect(stdout).toContainText('"error": "unable to read path"');
      expect(stdout).toContainText('"path": "non-existing-dir"');
      expect(exitCode).toBe(1);
    });

    it('filters out errors when one of the paths fails, with --sarif flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm non-existing-dir --sarif`,
      );
      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).not.toContain(
        '"error": "Could not find any valid IaC files"',
      );
      expect(stdout).not.toContain('"path": "non-existing-dir"');
      expect(exitCode).toBe(1);
    });
  });

  describe('directory with files that can not be parsed', () => {
    it('prints all invalid paths', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/only-invalid`,
      );
      const error = getErrorUserMessage(2105, 'FailedToParseInput');

      expect(stdout).toContainText(error);
      expect(exitCode).toBe(2);
    });
    it('prints all errors and paths in --json', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/only-invalid --json`,
      );

      expect(isValidJSONString(stdout)).toBe(true);

      expect(JSON.parse(stdout).length).toBe(2);
      expect(stdout).toContainText('"ok": false');
      expect(stdout).toContainText('"error": "failed to parse input"');
      expect(exitCode).toBe(2);
    });
  });

  describe('Exit codes', () => {
    describe('Issues found', () => {
      it('returns 1 even if some files failed to parse', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/kubernetes/`,
        );
        expect(stderr).toBe(
          '\n' +
            'You configured the Snyk CLI to use an API URL with an HTTP scheme. This option is insecure and might prevent the Snyk CLI from working correctly.\n',
        );
        expect(stdout).toContainText(
          '✔ Files without issues: 0' + EOL + '✗ Files with issues: 2',
        );
        expect(exitCode).toBe(1);
      });
      it('returns 1 even if some files failed to parse - using --json flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/kubernetes/  --json`,
        );
        expect(stderr).toBe(
          '\n' +
            'You configured the Snyk CLI to use an API URL with an HTTP scheme. This option is insecure and might prevent the Snyk CLI from working correctly.\n',
        );
        expect(stdout).toContainText('"ok": false');
        expect(exitCode).toBe(1);
      });

      it('returns 1 even if some files failed to parse - using --sarif flag', async () => {
        const { exitCode, stderr } = await run(
          `snyk iac test ./iac/kubernetes/  --sarif`,
        );
        expect(stderr).toBe(
          '\n' +
            'You configured the Snyk CLI to use an API URL with an HTTP scheme. This option is insecure and might prevent the Snyk CLI from working correctly.\n',
        );
        expect(exitCode).toBe(1);
      });
    });

    describe('No Issues found', () => {
      it('returns 0 even if some files failed to parse', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high`,
        );
        expect(stderr).toBe(
          '\n' +
            'You configured the Snyk CLI to use an API URL with an HTTP scheme. This option is insecure and might prevent the Snyk CLI from working correctly.\n',
        );
        expect(stdout).toContainText('No vulnerable paths were found!');
        expect(exitCode).toBe(0);
      });

      it('returns 0 even if some files failed to parse - using --json flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high  --json`,
        );
        expect(stderr).toBe(
          '\n' +
            'You configured the Snyk CLI to use an API URL with an HTTP scheme. This option is insecure and might prevent the Snyk CLI from working correctly.\n',
        );
        expect(stdout).toContainText('"ok": true');
        expect(exitCode).toBe(0);
      });

      it('returns 0 even if some files failed to parse - using --sarif flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high  --sarif`,
        );
        expect(stderr).toBe(
          '\n' +
            'You configured the Snyk CLI to use an API URL with an HTTP scheme. This option is insecure and might prevent the Snyk CLI from working correctly.\n',
        );
        expect(stdout).toContainText('"results": []');
        expect(exitCode).toBe(0);
      });
    });
  });
});
