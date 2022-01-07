import { test } from 'tap';
import {
  GitCommitInfo,
  parseGitLog,
  GitRepoCommitStats,
  parseGitLogLine,
  getTimestampStartOfContributingDevTimeframe,
  separateLines,
  execShell,
  ShellOutError,
  runGitLog,
} from '../../src/lib/monitor/dev-count-analysis';

const osName = require('os-name');

const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

test('can calculate start of contributing developer period', (t) => {
  t.plan(1);
  const dEndMilliseconds = 1590174610000; // arbitrary timestamp in ms since epoch
  const exectedStartTimestampSeconds = 1590174610 - 90 * 24 * 60 * 60;
  const dEnd = new Date(dEndMilliseconds);
  const tStart = getTimestampStartOfContributingDevTimeframe(dEnd, 90);
  t.equal(tStart, exectedStartTimestampSeconds);
});

test('can parse a git log line', (t) => {
  t.plan(1);
  const line =
    '0bd4d3c394a54ba54f6c44705ac73d7d87b39525_SNYK_SEPARATOR_some-user_SNYK_SEPARATOR_someemail-1@somedomain.com_SNYK_SEPARATOR_2020-02-06T11:43:11+00:00';
  const commitInfo: GitCommitInfo = parseGitLogLine(line);
  t.equal(commitInfo.authorEmail, 'someemail-1@somedomain.com');
});

test('can handle an empty git log', (t) => {
  t.plan(3);
  const gitLog = '';
  const stats = parseGitLog(gitLog);
  t.equal(stats.getCommitsCount(), 0);
  t.equal(stats.getUniqueAuthorsCount(), 0);

  const authorTimestamps = stats.getRepoContributors();
  const keys: string[] = Object.keys(authorTimestamps);
  t.equal(keys.length, 0);
});

test('can call legit command with execShell', async (t) => {
  t.plan(1);
  const res = await execShell('echo hello', process.cwd());
  t.equals(res.trim(), 'hello');
});

test('execShell can handle it when a command does not exist', async (t) => {
  t.plan(3);
  try {
    await execShell('command-no-exist some params', process.cwd());
    t.fail('should have rejected');
  } catch (e) {
    t.notOk(e.stdout);
    if (isWindows) {
      t.ok(e.stderr.includes('not recognized'));
      t.equals(e.exitCode, 1);
    } else {
      t.ok(e.stderr.includes('not found'));
      t.equals(e.exitCode, 127);
    }
  }
});

test('execShell can handle it when we call a command with wonky arguments', async (t) => {
  t.plan(3);

  try {
    await execShell('git log bad args non sense', process.cwd()); // git log, should return exit code 128
    throw new Error('should not return');
  } catch (e) {
    t.notOk(e.stdout); // expect empty / falsy
    t.ok(e.stderr); // is truthy - i.e. has some output but we don't really care what it is
    t.equals(e.exitCode, 128);
  }
});

test('runGitLog returns empty string and does not throw error when git log command fails', async (t) => {
  t.plan(1);
  const mockExecShell = (): Promise<string> => {
    const e = new ShellOutError(
      'mock error',
      1,
      '',
      'the command failed',
      undefined,
    );
    return Promise.reject(e);
  };

  try {
    const gitLog = await runGitLog(
      123456789,
      123456989,
      '/some/fake/path',
      mockExecShell,
    );
    t.equals(gitLog, '');
  } catch (e) {
    t.fail('should not throw');
  }
});

function validateGitParsing(gitLog: string, t) {
  t.plan(13);
  const stats: GitRepoCommitStats = parseGitLog(gitLog);

  t.equal(stats.getCommitsCount(), 3);
  t.equal(stats.getUniqueAuthorsCount(), 2);

  const uniqueAuthors: Set<string> = stats.getUniqueAuthorEmails();
  t.equal(uniqueAuthors.size, 2);

  t.ok(uniqueAuthors.has('someemail-1@somedomain.com'));
  t.ok(uniqueAuthors.has('someemail-2@somedomain.com'));

  const mostRecentCommitTimestampSomeEmail1 = stats.getMostRecentCommitTimestamp(
    'someemail-1@somedomain.com',
  );
  t.equal(mostRecentCommitTimestampSomeEmail1, '2020-02-06T11:43:11+00:00');
  const mostRecentCommitTimestampSomeEmail2 = stats.getMostRecentCommitTimestamp(
    'someemail-2@somedomain.com',
  );
  t.equal(mostRecentCommitTimestampSomeEmail2, '2020-02-02T23:31:13+02:00');
  t.equal(stats.getMostRecentCommitTimestamp('missing-email'), '');

  const contributors: {
    email: string;
    lastCommitDate: string;
  }[] = stats.getRepoContributors();
  t.equal(contributors.length, 2);

  t.ok(contributors.map((c) => c.email).includes('someemail-1@somedomain.com'));
  t.ok(contributors.map((c) => c.email).includes('someemail-2@somedomain.com'));

  const getTimestampById = (email: string): string => {
    for (const c of contributors) {
      if (c.email === email) {
        return c.lastCommitDate;
      }
    }
    throw new Error('contributor not found');
  };

  t.equal(
    getTimestampById('someemail-1@somedomain.com'),
    '2020-02-06T11:43:11+00:00',
  );
  t.equal(
    getTimestampById('someemail-2@somedomain.com'),
    '2020-02-02T23:31:13+02:00',
  );
}

test('can parse a git log (Linux/OSX line endings)', (t) => {
  const gitLogLinuxOSXLineEndings =
    '0bd4d3c394a54ba54f6c44705ac73d7d87b39525_SNYK_SEPARATOR_some-user-1_SNYK_SEPARATOR_someemail-1@somedomain.com_SNYK_SEPARATOR_2020-02-06T11:43:11+00:00\n' +
    'c20267ac84a9b81a30e6e41e4437906a69e6b8c0_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:31:13+02:00\n' +
    '9dabba3667520f7e2baf1ac75fb58369ea16050c_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:23:41+02:00\n';
  validateGitParsing(gitLogLinuxOSXLineEndings, t);
});

test('can parse a git log (Windows line endings)', (t) => {
  const gitLogWindowsLineEndings =
    '0bd4d3c394a54ba54f6c44705ac73d7d87b39525_SNYK_SEPARATOR_some-user-1_SNYK_SEPARATOR_someemail-1@somedomain.com_SNYK_SEPARATOR_2020-02-06T11:43:11+00:00\r\n' +
    'c20267ac84a9b81a30e6e41e4437906a69e6b8c0_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:31:13+02:00\r\n' +
    '9dabba3667520f7e2baf1ac75fb58369ea16050c_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:23:41+02:00\r\n';
  validateGitParsing(gitLogWindowsLineEndings, t);
});

test('can separate lines with Linux/OSX line endings', (t) => {
  t.plan(6);

  const linuxOrOSXStyleFileData =
    'line 0\n' + 'line 1\n' + 'line 2\n' + 'line 3\n' + 'line 4\n';

  const lines = separateLines(linuxOrOSXStyleFileData);
  t.equal(lines.length, 5);
  t.ok(lines.includes('line 0'));
  t.ok(lines.includes('line 1'));
  t.ok(lines.includes('line 2'));
  t.ok(lines.includes('line 3'));
  t.ok(lines.includes('line 4'));
});

test('can separate lines Windows line endings', (t) => {
  t.plan(6);
  const windowsStyleFileData =
    'line 0\r\n' + 'line 1\r\n' + 'line 2\r\n' + 'line 3\r\n' + 'line 4\r\n';

  const lines = separateLines(windowsStyleFileData);
  t.equal(lines.length, 5);
  t.ok(lines.includes('line 0'));
  t.ok(lines.includes('line 1'));
  t.ok(lines.includes('line 2'));
  t.ok(lines.includes('line 3'));
  t.ok(lines.includes('line 4'));
});
