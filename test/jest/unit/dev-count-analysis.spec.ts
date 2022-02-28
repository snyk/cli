import {
  GitCommitInfo,
  parseGitLog,
  GitRepoCommitStats,
  parseGitLogLine,
  ShellOutError,
  runGitLog,
  getContributors,
  getTimestampStartOfContributingDevTimeframe,
  execShell,
  SERIOUS_DELIMITER,
  MAX_COMMITS_IN_GIT_LOG,
  separateLines,
} from '../../../src/lib/monitor/dev-count-analysis';

const testTimeout = 60000;

const TIMESTAMP_TO_TEST = 1590174610000;

describe('cli dev count via git log analysis', () => {
  let expectedContributoremails: string[] = [];
  let expectedMergeOnlyemails: string[] = [];

  // this computes the expectedContributoremails and expectedMergeOnlyemails
  beforeAll(async () => {
    const timestampEpochSecondsEndOfPeriod = Math.floor(
      TIMESTAMP_TO_TEST / 1000,
    );
    const timestampEpochSecondsStartOfPeriod = getTimestampStartOfContributingDevTimeframe(
      new Date(TIMESTAMP_TO_TEST),
      10,
    );

    const withMergesGitLogCommand = `git --no-pager log --pretty=tformat:"%H${SERIOUS_DELIMITER}%an${SERIOUS_DELIMITER}%ae${SERIOUS_DELIMITER}%aI${SERIOUS_DELIMITER}%s" --after="${timestampEpochSecondsStartOfPeriod}" --until="${timestampEpochSecondsEndOfPeriod}" --max-count=${MAX_COMMITS_IN_GIT_LOG}`;
    const withMergesGitLogStdout: string = await execShell(
      withMergesGitLogCommand,
      process.cwd(),
    );
    const withMergesLogLines = separateLines(withMergesGitLogStdout);
    const allEmails = withMergesLogLines.map(
      (l) => l.split(SERIOUS_DELIMITER)[2], // index 2 corresponds to %ae% which is the author email
    );
    const uniqueEmails = [...new Set(allEmails)]; // dedupe the list of emails

    const uniqueEmailsContainingOnlyMergeCommits: string[] = []; // a list of emails which are only associated with merge commits; don't include an email if it also have regular commits
    const uniqueEmailsContainingAtLeastOneNonMergeCommit: string[] = [];
    for (const nextEmail of uniqueEmails) {
      const associatedCommits = withMergesLogLines.filter((l) =>
        l.includes(nextEmail),
      );
      const allAssociatedCommitsAreMergeCommits = associatedCommits.every((e) =>
        e.includes('Merge pull request'),
      );
      if (allAssociatedCommitsAreMergeCommits) {
        uniqueEmailsContainingOnlyMergeCommits.push(nextEmail);
      } else {
        uniqueEmailsContainingAtLeastOneNonMergeCommit.push(nextEmail);
      }
    }

    expectedContributoremails = uniqueEmailsContainingAtLeastOneNonMergeCommit;
    expectedMergeOnlyemails = uniqueEmailsContainingOnlyMergeCommits;
  }, testTimeout);

  it(
    'returns contributors',
    async () => {
      const contributors = await getContributors({
        endDate: new Date(TIMESTAMP_TO_TEST),
        periodDays: 10,
        repoPath: process.cwd(),
      });
      const contributoremails = contributors.map((c) => c.email);
      expect(contributoremails.sort()).toEqual(
        expectedContributoremails.sort(),
      );
    },
    testTimeout,
  );

  it(
    'does not include contributors who have only merged pull requests',
    async () => {
      const contributors = await getContributors({
        endDate: new Date(TIMESTAMP_TO_TEST),
        periodDays: 10,
        repoPath: process.cwd(),
      });
      const contributoremails = contributors.map((c) => c.email);

      // make sure none of uniqueEmailsContainingOnlyMergeCommits are in contributoremails
      const legitemailsWhichAreAlsoInMergeOnlyemails = expectedMergeOnlyemails.filter(
        (user) => contributoremails.includes(user),
      );
      expect(legitemailsWhichAreAlsoInMergeOnlyemails).toHaveLength(0);
    },
    testTimeout,
  );

  it('can calculate start of contributing developer period', () => {
    const dEndMilliseconds = 1590174610000; // arbitrary timestamp in ms since epoch
    const exectedStartTimestampSeconds = 1590174610 - 90 * 24 * 60 * 60;
    const dEnd = new Date(dEndMilliseconds);
    const tStart = getTimestampStartOfContributingDevTimeframe(dEnd, 90);
    expect(tStart).toEqual(exectedStartTimestampSeconds);
  });

  it('can parse a git log line', () => {
    const line =
      '0bd4d3c394a54ba54f6c44705ac73d7d87b39525_SNYK_SEPARATOR_some-user_SNYK_SEPARATOR_someemail-1@somedomain.com_SNYK_SEPARATOR_2020-02-06T11:43:11+00:00';
    const commitInfo: GitCommitInfo = parseGitLogLine(line);
    expect(commitInfo.authorEmail).toEqual('someemail-1@somedomain.com');
  });

  it('can handle an empty git log', () => {
    const gitLog = '';
    const stats = parseGitLog(gitLog);
    expect(stats.getCommitsCount()).toEqual(0);
    expect(stats.getUniqueAuthorsCount()).toEqual(0);

    const authorTimestamps = stats.getRepoContributors();
    const keys: string[] = Object.keys(authorTimestamps);
    expect(keys.length).toEqual(0);
  });

  it('runGitLog returns empty string and does not throw error when git log command fails', async () => {
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

    const gitLog = await runGitLog(
      123456789,
      123456989,
      '/some/fake/path',
      mockExecShell,
    );
    expect(gitLog).toEqual('');
  });

  it('can parse a git log (Linux/OSX line endings)', () => {
    const gitLogLinuxOSXLineEndings =
      '0bd4d3c394a54ba54f6c44705ac73d7d87b39525_SNYK_SEPARATOR_some-user-1_SNYK_SEPARATOR_someemail-1@somedomain.com_SNYK_SEPARATOR_2020-02-06T11:43:11+00:00\n' +
      'c20267ac84a9b81a30e6e41e4437906a69e6b8c0_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:31:13+02:00\n' +
      '9dabba3667520f7e2baf1ac75fb58369ea16050c_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:23:41+02:00\n';
    const stats: GitRepoCommitStats = parseGitLog(gitLogLinuxOSXLineEndings);

    expect(stats.getCommitsCount()).toEqual(3);
    expect(stats.getUniqueAuthorsCount()).toEqual(2);

    const uniqueAuthors: Set<string> = stats.getUniqueAuthorEmails();
    expect(uniqueAuthors.size).toEqual(2);

    expect(uniqueAuthors.has('someemail-1@somedomain.com')).toBeTruthy();
    expect(uniqueAuthors.has('someemail-2@somedomain.com')).toBeTruthy();

    const mostRecentCommitTimestampSomeEmail1 = stats.getMostRecentCommitTimestamp(
      'someemail-1@somedomain.com',
    );
    expect(mostRecentCommitTimestampSomeEmail1).toEqual(
      '2020-02-06T11:43:11+00:00',
    );
    const mostRecentCommitTimestampSomeEmail2 = stats.getMostRecentCommitTimestamp(
      'someemail-2@somedomain.com',
    );
    expect(mostRecentCommitTimestampSomeEmail2).toEqual(
      '2020-02-02T23:31:13+02:00',
    );
    expect(stats.getMostRecentCommitTimestamp('missing-email')).toEqual('');

    const contributors: {
      email: string;
      lastCommitDate: string;
    }[] = stats.getRepoContributors();
    expect(contributors.length).toEqual(2);

    expect(contributors.map((c) => c.email)).toContain(
      'someemail-1@somedomain.com',
    );
    expect(contributors.map((c) => c.email)).toContain(
      'someemail-2@somedomain.com',
    );

    const getTimestampById = (email: string): string => {
      for (const c of contributors) {
        if (c.email === email) {
          return c.lastCommitDate;
        }
      }
      throw new Error('contributor not found');
    };

    expect(getTimestampById('someemail-1@somedomain.com')).toEqual(
      '2020-02-06T11:43:11+00:00',
    );
    expect(getTimestampById('someemail-2@somedomain.com')).toEqual(
      '2020-02-02T23:31:13+02:00',
    );
  });

  it('can parse a git log (Windows line endings)', () => {
    const gitLogWindowsLineEndings =
      '0bd4d3c394a54ba54f6c44705ac73d7d87b39525_SNYK_SEPARATOR_some-user-1_SNYK_SEPARATOR_someemail-1@somedomain.com_SNYK_SEPARATOR_2020-02-06T11:43:11+00:00\r\n' +
      'c20267ac84a9b81a30e6e41e4437906a69e6b8c0_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:31:13+02:00\r\n' +
      '9dabba3667520f7e2baf1ac75fb58369ea16050c_SNYK_SEPARATOR_some-user-2_SNYK_SEPARATOR_someemail-2@somedomain.com_SNYK_SEPARATOR_2020-02-02T23:23:41+02:00\r\n';
    const stats: GitRepoCommitStats = parseGitLog(gitLogWindowsLineEndings);

    expect(stats.getCommitsCount()).toEqual(3);
    expect(stats.getUniqueAuthorsCount()).toEqual(2);

    const uniqueAuthors: Set<string> = stats.getUniqueAuthorEmails();
    expect(uniqueAuthors.size).toEqual(2);

    expect(uniqueAuthors).toContain('someemail-1@somedomain.com');
    expect(uniqueAuthors).toContain('someemail-2@somedomain.com');

    const mostRecentCommitTimestampSomeEmail1 = stats.getMostRecentCommitTimestamp(
      'someemail-1@somedomain.com',
    );
    expect(mostRecentCommitTimestampSomeEmail1).toEqual(
      '2020-02-06T11:43:11+00:00',
    );
    const mostRecentCommitTimestampSomeEmail2 = stats.getMostRecentCommitTimestamp(
      'someemail-2@somedomain.com',
    );
    expect(mostRecentCommitTimestampSomeEmail2).toEqual(
      '2020-02-02T23:31:13+02:00',
    );
    expect(stats.getMostRecentCommitTimestamp('missing-email')).toEqual('');

    const contributors: {
      email: string;
      lastCommitDate: string;
    }[] = stats.getRepoContributors();
    expect(contributors.length).toEqual(2);

    expect(contributors.map((c) => c.email)).toContain(
      'someemail-1@somedomain.com',
    );
    expect(contributors.map((c) => c.email)).toContain(
      'someemail-2@somedomain.com',
    );

    const getTimestampById = (email: string): string => {
      for (const c of contributors) {
        if (c.email === email) {
          return c.lastCommitDate;
        }
      }
      throw new Error('contributor not found');
    };

    expect(getTimestampById('someemail-1@somedomain.com')).toEqual(
      '2020-02-06T11:43:11+00:00',
    );
    expect(getTimestampById('someemail-2@somedomain.com')).toEqual(
      '2020-02-02T23:31:13+02:00',
    );
  });

  it('can separate lines with Linux/OSX line endings', () => {
    const linuxOrOSXStyleFileData =
      'line 0\n' + 'line 1\n' + 'line 2\n' + 'line 3\n' + 'line 4\n';

    const lines = separateLines(linuxOrOSXStyleFileData);
    expect(lines.length).toEqual(5);
    expect(lines).toContain('line 0');
    expect(lines).toContain('line 1');
    expect(lines).toContain('line 2');
    expect(lines).toContain('line 3');
    expect(lines).toContain('line 4');
  });

  it('can separate lines Windows line endings', () => {
    const windowsStyleFileData =
      'line 0\r\n' + 'line 1\r\n' + 'line 2\r\n' + 'line 3\r\n' + 'line 4\r\n';

    const lines = separateLines(windowsStyleFileData);
    expect(lines.length).toEqual(5);
    expect(lines).toContain('line 0');
    expect(lines).toContain('line 1');
    expect(lines).toContain('line 2');
    expect(lines).toContain('line 3');
    expect(lines).toContain('line 4');
  });
});
