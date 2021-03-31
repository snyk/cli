import * as pathLib from 'path';
import * as fs from 'fs';

import cli = require('../../../../../../src/cli/commands');
import * as snyk from '../../../../../../src/lib';
import * as featureFlags from '../../../../../../src/lib/feature-flags';

import stripAnsi from 'strip-ansi';

const testTimeout = 100000;

const pipAppWorkspace = pathLib.join(
  __dirname,
  '../../../../../',
  'acceptance',
  'workspaces',
  'pip-app',
);

const npmWorkspace = pathLib.join(
  __dirname,
  '../../../../../',
  'acceptance',
  'workspaces',
  'no-vulns',
);

const pipRequirementsTxt = pathLib.join(pipAppWorkspace, 'requirements.txt');

const pipRequirementsCustomTxt = pathLib.join(
  __dirname,
  '../../../../../',
  'acceptance',
  'workspaces',
  'pip-app-custom',
  'base.txt',
);

const pipWithRemediation = JSON.parse(
  fs.readFileSync(
    pathLib.resolve(
      __dirname,
      '../../../../../',
      'fixtures',
      'snyk-fix',
      'test-result-pip-with-remediation.json',
    ),
    'utf8',
  ),
);

describe('snyk fix (functional tests)', () => {
  beforeAll(async () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
  });

  afterAll(async () => {
    jest.clearAllMocks();
  });
  it(
    'shows successful fixes Python requirements.txt project was fixed via --file',
    async () => {
      // read data from console.log
      let stdoutMessages = '';
      let stderrMessages = '';
      jest
        .spyOn(console, 'log')
        .mockImplementation((msg: string) => (stdoutMessages += msg));
      jest
        .spyOn(console, 'error')
        .mockImplementation((msg: string) => (stderrMessages += msg));

      jest.spyOn(snyk, 'test').mockResolvedValue({
        ...pipWithRemediation,
        // pip plugin does not return targetFile, instead fix will fallback to displayTargetFile
        displayTargetFile: pipRequirementsTxt,
      });
      const res = await cli.fix('.', {
        file: pipRequirementsTxt,
        dryRun: true, // prevents write to disc
        quiet: true,
      });
      expect(stripAnsi(res)).toMatch('✔ Upgraded Jinja2 from 2.7.2 to 2.11.3');
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );
  it(
    'shows successful fixes Python custom name base.txt project was fixed via --file',
    async () => {
      // read data from console.log
      let stdoutMessages = '';
      let stderrMessages = '';
      jest
        .spyOn(console, 'log')
        .mockImplementation((msg: string) => (stdoutMessages += msg));
      jest
        .spyOn(console, 'error')
        .mockImplementation((msg: string) => (stderrMessages += msg));

      jest.spyOn(snyk, 'test').mockResolvedValue({
        ...pipWithRemediation,
        // pip plugin does not return targetFile, instead fix will fallback to displayTargetFile
        displayTargetFile: pipRequirementsCustomTxt,
      });
      const res = await cli.fix('.', {
        file: pipRequirementsCustomTxt,
        packageManager: 'pip',
        dryRun: true, // prevents write to disc
        quiet: true,
      });
      expect(stripAnsi(res)).toMatch('✔ Upgraded Jinja2 from 2.7.2 to 2.11.3');
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );

  it(
    'snyk fix continues to fix when 1 path fails to test with `snyk fix path1 path2`',
    async () => {
      // read data from console.log
      let stdoutMessages = '';
      let stderrMessages = '';
      jest
        .spyOn(console, 'log')
        .mockImplementation((msg: string) => (stdoutMessages += msg));
      jest
        .spyOn(console, 'error')
        .mockImplementation((msg: string) => (stderrMessages += msg));

      jest
        .spyOn(snyk, 'test')
        .mockRejectedValueOnce(new Error('Failed to get npm dependencies'));
      jest.spyOn(snyk, 'test').mockResolvedValue({
        ...pipWithRemediation,
        // pip plugin does not return targetFile, instead fix will fallback to displayTargetFile
        displayTargetFile: pipRequirementsTxt,
      });
      const res = await cli.fix(npmWorkspace, pipAppWorkspace, {
        dryRun: true, // prevents write to disc
        quiet: true,
      });
      expect(stripAnsi(res)).toMatch('✔ Upgraded Jinja2 from 2.7.2 to 2.11.3');
      // only use ora to output
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );

  it(
    'snyk fails to fix when all path fails to test with `snyk fix path1 path2`',
    async () => {
      // read data from console.log
      let stdoutMessages = '';
      let stderrMessages = '';
      jest
        .spyOn(console, 'log')
        .mockImplementation((msg: string) => (stdoutMessages += msg));
      jest
        .spyOn(console, 'error')
        .mockImplementation((msg: string) => (stderrMessages += msg));

      jest
        .spyOn(snyk, 'test')
        .mockRejectedValue(new Error('Failed to get dependencies'));

      let res;
      try {
        await cli.fix(npmWorkspace, pipAppWorkspace, {
          dryRun: true, // prevents write to disc
          quiet: true,
        });
      } catch (error) {
        res = error;
      }
      expect(stripAnsi(res.message)).toMatch('No successful fixes');
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );
});
