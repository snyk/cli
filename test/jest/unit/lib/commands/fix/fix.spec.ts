import * as pathLib from 'path';
import * as fs from 'fs';
import * as snykFix from '@snyk/fix';
import fix from '../../../../../../src/cli/commands/fix';
import * as snyk from '../../../../../../src/lib';
import * as featureFlags from '../../../../../../src/lib/feature-flags';
import * as analytics from '../../../../../../src/lib/analytics';
import stripAnsi from 'strip-ansi';
import { getWorkspacePath } from '../../../../util/getWorkspacePath';
import { getFixturePath } from '../../../../util/getFixturePath';

const testTimeout = 100000;

const pipAppWorkspace = getWorkspacePath('pip-app');
const npmWorkspace = getWorkspacePath('no-vulns');
const pipRequirementsTxt = pathLib.join(pipAppWorkspace, 'requirements.txt');
const pipRequirementsCustomTxt = getWorkspacePath('pip-app-custom/base.txt');

const pipWithRemediation = JSON.parse(
  fs.readFileSync(
    getFixturePath('snyk-fix/test-result-pip-with-remediation.json'),
    'utf8',
  ),
);

const pipNoIssues = JSON.parse(
  fs.readFileSync(
    getFixturePath('snyk-fix/test-result-pip-no-vulns.json'),
    'utf8',
  ),
);

describe('snyk fix (functional tests)', () => {
  let origStdWrite;
  let snykFixSpy: jest.SpyInstance;
  let addAnalyticsSpy: jest.SpyInstance;

  beforeAll(async () => {
    origStdWrite = process.stdout.write;
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
  });

  beforeEach(() => {
    snykFixSpy = jest.spyOn(snykFix, 'fix');
    addAnalyticsSpy = jest.spyOn(analytics, 'add');
  });

  afterEach(() => {
    snykFixSpy.mockClear();
    addAnalyticsSpy.mockClear();
  });

  afterAll(async () => {
    process.stdout.write = origStdWrite;
    jest.clearAllMocks();
  });
  it(
    'shows successful fixes Python requirements.txt project was fixed via --file',
    async () => {
      let stdoutMessages = '';
      process.stdout.write = (str) => {
        stdoutMessages += str;
        return true;
      };

      jest.spyOn(snyk, 'test').mockResolvedValue({
        ...pipWithRemediation,
        // pip plugin does not return targetFile, instead fix will fallback to displayTargetFile
        displayTargetFile: pipRequirementsTxt,
      });
      const res = await fix('.', {
        file: pipRequirementsTxt,
        dryRun: true, // prevents write to disc
        quiet: true,
        _doubleDashArgs: [],
        _: [],
        rawArgv: [],
      });
      expect(snykFixSpy).toHaveBeenCalledTimes(1);
      expect(snykFixSpy.mock.calls[0][1]).toEqual({
        dryRun: true,
        quiet: true,
      });
      expect(addAnalyticsSpy).toHaveBeenCalledTimes(9);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFailedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixVulnerableProjects',
        1,
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixableIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalIssues', 4);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixSummary',
        expect.any(String),
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixErrors', {
        python: [],
      });

      expect(stripAnsi(res)).toMatch('✔ Upgraded Jinja2 from 2.7.2 to 2.11.3');
      expect(stdoutMessages).toEqual('');
    },
    testTimeout,
  );
  it(
    'shows successful fixes Python requirements.txt project on stdout',
    async () => {
      let stdoutMessages = '';
      process.stdout.write = (str) => {
        stdoutMessages += str;
        return true;
      };
      jest.spyOn(snyk, 'test').mockResolvedValue({
        ...pipWithRemediation,
        // pip plugin does not return targetFile, instead fix will fallback to displayTargetFile
        displayTargetFile: pipRequirementsTxt,
      });
      const res = await fix('.', {
        file: pipRequirementsTxt,
        dryRun: true, // prevents write to disc
        _doubleDashArgs: [],
        _: [],
        rawArgv: [],
      });
      expect(snykFixSpy).toHaveBeenCalledTimes(1);
      expect(snykFixSpy.mock.calls[0][1]).toEqual({
        dryRun: true,
      });
      expect(addAnalyticsSpy).toHaveBeenCalledTimes(9);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFailedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixVulnerableProjects',
        1,
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixableIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalIssues', 4);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixSummary',
        expect.any(String),
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixErrors', {
        python: [],
      });

      expect(stripAnsi(res)).toMatch('✔ Upgraded Jinja2 from 2.7.2 to 2.11.3');
      expect(stripAnsi(stdoutMessages)).toMatch(
        '✔ Looking for supported Python items',
      );
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
      const res = await fix('.', {
        file: pipRequirementsCustomTxt,
        packageManager: 'pip',
        dryRun: true, // prevents write to disc
        quiet: true,
        _doubleDashArgs: [],
        _: [],
        rawArgv: [],
      });
      expect(snykFixSpy).toHaveBeenCalledTimes(1);
      expect(snykFixSpy.mock.calls[0][1]).toEqual({
        dryRun: true,
        quiet: true,
      });

      expect(addAnalyticsSpy).toHaveBeenCalledTimes(9);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFailedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixVulnerableProjects',
        1,
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixableIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalIssues', 4);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixSummary',
        expect.any(String),
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixErrors', {
        python: [],
      });

      expect(stripAnsi(res)).toMatch('✔ Upgraded Jinja2 from 2.7.2 to 2.11.3');
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );

  it(
    'snyk fix continues to fix when 1 path fails to test with `snyk fix path1 path2` (exit code 0)',
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
      const res = await fix(npmWorkspace, pipAppWorkspace, {
        dryRun: true, // prevents write to disc
        quiet: true,
        _doubleDashArgs: [],
        _: [],
        rawArgv: [],
      });
      expect(snykFixSpy.mock.calls[0][1]).toEqual({
        dryRun: true,
        quiet: true,
      });
      expect(addAnalyticsSpy).toHaveBeenCalledTimes(9);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFailedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixVulnerableProjects',
        1,
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixableIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedIssues', 3);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalIssues', 4);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixSummary',
        expect.any(String),
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixErrors', {
        python: [],
      });

      expect(snykFixSpy).toHaveBeenCalledTimes(1);
      expect(stripAnsi(res)).toMatch('✔ Upgraded Jinja2 from 2.7.2 to 2.11.3');
      // only use ora to output
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );

  it(
    'snyk fix send errors as analytics when fix fails',
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
      snykFixSpy.mockResolvedValueOnce({
        results: {
          python: {
            failed: [
              {
                original: [],
                error: new Error(
                  'SolverProblemError Because x (2.6) depends on y (>=1.19)',
                ),
                tip: 'Try running `pipenv install x==2.6 transitive==1.1.1',
              },
              {
                original: [],
                changes: [
                  {
                    success: false,
                    userMessage: 'Failed ot upgrade x to y',
                    reason: 'Incompatible dependencies',
                  },
                ],
              },
            ],
            skipped: [],
            succeeded: [],
          },
        },
        exceptions: {},
        meta: {
          fixed: 0,
          failed: 1,
          fixableIssues: 14,
          fixedIssues: 0,
          totalIssues: 14,
        },
        fixSummary: '✖ No successful fixes',
      });

      let res;
      try {
        res = await fix(pipAppWorkspace, {
          dryRun: true,
          quiet: true,
          _doubleDashArgs: [],
          _: [],
          rawArgv: [],
        });
      } catch (e) {
        res = e.message;
      }

      expect(snykFixSpy.mock.calls[0][1]).toEqual({
        dryRun: true,
        quiet: true,
      });
      expect(addAnalyticsSpy).toHaveBeenCalledTimes(9);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFailedProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixVulnerableProjects',
        1,
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixableIssues', 14);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedIssues', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalIssues', 14);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixSummary',
        expect.any(String),
      );

      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixErrors', {
        python: [
          'SolverProblemError Because x (2.6) depends on y (>=1.19)',

          JSON.stringify({
            success: false,
            userMessage: 'Failed ot upgrade x to y',
            reason: 'Incompatible dependencies',
          }),
        ],
      });

      expect(snykFixSpy).toHaveBeenCalledTimes(1);
      expect(stripAnsi(res)).toMatch('✖ No successful fixes');
      // only use ora to output
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );

  it(
    'snyk fails to fix when all paths fails to test with `snyk fix path1 path2` (non 0 error code)',
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
        await fix(npmWorkspace, pipAppWorkspace, {
          dryRun: true, // prevents write to disc
          quiet: true,
          _doubleDashArgs: [],
          _: [],
          rawArgv: [],
        });
      } catch (error) {
        res = error;
      }
      expect(addAnalyticsSpy).toHaveBeenCalledTimes(8);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFailedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixVulnerableProjects',
        0,
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixableIssues', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedIssues', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalIssues', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixSummary',
        expect.any(String),
      );

      expect(snykFixSpy).toHaveBeenCalledTimes(1);
      expect(snykFixSpy.mock.calls[0][1]).toEqual({
        dryRun: true,
        quiet: true,
      });
      expect(stripAnsi(res.message)).toMatch('No successful fixes');
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );

  it(
    'snyk succeeds to fix when no vulns `snyk fix path1` (exit code 0)',
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
        ...pipNoIssues,
        // pip plugin does not return targetFile, instead fix will fallback to displayTargetFile
        displayTargetFile: pipRequirementsTxt,
      });
      const res = await fix(pipAppWorkspace, {
        dryRun: true, // prevents write to disc
        quiet: true,
        _doubleDashArgs: [],
        _: [],
        rawArgv: [],
      });
      expect(snykFixSpy).toHaveBeenCalledTimes(1);
      expect(snykFixSpy.mock.calls[0][1]).toEqual({
        dryRun: true,
        quiet: true,
      });
      expect(addAnalyticsSpy).toHaveBeenCalledTimes(8);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFailedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedProjects', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalProjects', 1);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixVulnerableProjects',
        0,
      );
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixableIssues', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixFixedIssues', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith('snykFixTotalIssues', 0);
      expect(addAnalyticsSpy).toHaveBeenCalledWith(
        'snykFixSummary',
        expect.any(String),
      );

      expect(stripAnsi(res)).toMatch('✔ No vulnerable items to fix');
      expect(stdoutMessages).toEqual('');
      expect(stderrMessages).toEqual('');
    },
    testTimeout,
  );
});
