/**
 * This is to count the number of "contributing" developers using Snyk on a given repo.
 * "Contributing" is defined as having contributed a commit in the last 90 days.
 * This is use only on the `snyk monitor` command as that is used to monitor a project's dependencies in an
 * on-going manner.
 * It collects the email of a git user and the most recent commit timestamp (both per the `git log`
 * output) and can be disabled by config (see https://snyk.io/policies/tracking-and-analytics/).
 */
import { exec } from 'child_process';
import { Contributor } from '../types';

export const SERIOUS_DELIMITER = '_SNYK_SEPARATOR_';
export const CONTRIBUTING_DEVELOPER_PERIOD_DAYS = 90;
// Limit the number of commits returned from `git log` command to stay within maxBuffer limit
export const MAX_COMMITS_IN_GIT_LOG = 500;

export async function getContributors(
  { endDate, periodDays, repoPath } = {
    endDate: new Date(),
    periodDays: CONTRIBUTING_DEVELOPER_PERIOD_DAYS,
    repoPath: process.cwd(),
  },
): Promise<Contributor[]> {
  const timestampStartOfContributingDeveloperPeriod = getTimestampStartOfContributingDevTimeframe(
    endDate,
    periodDays,
  );
  const gitLogResults = await runGitLog(
    timestampStartOfContributingDeveloperPeriod,
    Math.floor(endDate.getTime() / 1000),
    repoPath,
    execShell,
  );
  const stats: GitRepoCommitStats = parseGitLog(gitLogResults);
  return stats.getRepoContributors();
}

export class GitCommitInfo {
  authorEmail: string;
  commitTimestamp: string; // use ISO 8601 format

  constructor(authorEmail: string, commitTimestamp: string) {
    this.authorEmail = authorEmail;
    this.commitTimestamp = commitTimestamp;
  }
}

export class GitRepoCommitStats {
  commitInfos: GitCommitInfo[];

  constructor(commitInfos: GitCommitInfo[]) {
    this.commitInfos = commitInfos;
  }

  public static empty(): GitRepoCommitStats {
    return new GitRepoCommitStats([]);
  }

  public addCommitInfo(info: GitCommitInfo): void {
    this.commitInfos.push(info);
  }

  public getUniqueAuthorsCount(): number {
    const uniqueAuthorEmails = this.getUniqueAuthorEmails();
    return uniqueAuthorEmails.size;
  }

  public getCommitsCount(): number {
    return this.commitInfos.length;
  }

  public getUniqueAuthorEmails(): Set<string> {
    const allCommitAuthorHashedEmails: string[] = this.commitInfos.map(
      (c) => c.authorEmail,
    );
    const uniqueAuthorEmails: Set<string> = new Set(
      allCommitAuthorHashedEmails,
    );
    return uniqueAuthorEmails;
  }

  public getRepoContributors(): Contributor[] {
    const uniqueAuthorEmails = this.getUniqueAuthorEmails();
    const contributors: Contributor[] = [];
    for (const nextUniqueAuthorEmail of uniqueAuthorEmails) {
      const latestCommitTimestamp = this.getMostRecentCommitTimestamp(
        nextUniqueAuthorEmail,
      );
      contributors.push({
        email: nextUniqueAuthorEmail,
        lastCommitDate: latestCommitTimestamp,
      });
    }
    return contributors;
  }

  public getMostRecentCommitTimestamp(authorHashedEmail: string): string {
    for (const nextGI of this.commitInfos) {
      if (nextGI.authorEmail === authorHashedEmail) {
        return nextGI.commitTimestamp;
      }
    }
    return '';
  }
}

export function parseGitLogLine(logLine: string): GitCommitInfo {
  const lineComponents = logLine.split(SERIOUS_DELIMITER);
  const authorEmail = lineComponents[2];
  const commitTimestamp = lineComponents[3];
  const commitInfo = new GitCommitInfo(authorEmail, commitTimestamp);
  return commitInfo;
}

export function parseGitLog(gitLog: string): GitRepoCommitStats {
  if (gitLog.trim() === '') {
    return GitRepoCommitStats.empty();
  }
  const logLines = separateLines(gitLog);
  const logLineInfos: GitCommitInfo[] = logLines.map(parseGitLogLine);
  const stats: GitRepoCommitStats = new GitRepoCommitStats(logLineInfos);
  return stats;
}

/**
 * @returns time stamp in seconds-since-epoch of 90 days ago since 90 days is the "contributing devs" timeframe
 */
export function getTimestampStartOfContributingDevTimeframe(
  dNow: Date,
  timespanInDays: number = CONTRIBUTING_DEVELOPER_PERIOD_DAYS,
): number {
  const nowUtcEpocMS = dNow.getTime();
  const nowUtcEpocS = Math.floor(nowUtcEpocMS / 1000);
  const ONE_DAY_IN_SECONDS = 86400;
  const lookbackTimespanSeconds = timespanInDays * ONE_DAY_IN_SECONDS;
  const startOfPeriodEpochSeconds = nowUtcEpocS - lookbackTimespanSeconds;
  return startOfPeriodEpochSeconds;
}

export async function runGitLog(
  timestampEpochSecondsStartOfPeriod: number,
  timestampEpochSecondsEndOfPeriod: number,
  repoPath: string,
  fnShellout: (cmd: string, workingDirectory: string) => Promise<string>,
): Promise<string> {
  try {
    const gitLogCommand = `git --no-pager log --pretty=tformat:"%H${SERIOUS_DELIMITER}%an${SERIOUS_DELIMITER}%ae${SERIOUS_DELIMITER}%aI" --after="${timestampEpochSecondsStartOfPeriod}" --until="${timestampEpochSecondsEndOfPeriod}" --max-count=${MAX_COMMITS_IN_GIT_LOG}`;
    const gitLogStdout: string = await fnShellout(gitLogCommand, repoPath);
    return gitLogStdout;
  } catch {
    return '';
  }
}

export function separateLines(inputText: string): string[] {
  const linuxStyleNewLine = '\n';
  const windowsStyleNewLine = '\r\n';
  const reg = new RegExp(`${linuxStyleNewLine}|${windowsStyleNewLine}`);
  const lines = inputText.trim().split(reg);
  return lines;
}

export function execShell(
  cmd: string,
  workingDirectory: string,
): Promise<string> {
  const options = {
    cwd: workingDirectory,
  };

  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        const exitCode = error.code;

        const e = new ShellOutError(
          error.message,
          exitCode,
          stdout,
          stderr,
          error,
        );
        reject(e);
      } else {
        resolve(stdout ? stdout : stderr);
      }
    });
  });
}

export class ShellOutError extends Error {
  public innerError: Error | undefined;
  public exitCode: number | undefined;
  public stdout: string | undefined;
  public stderr: string | undefined;

  constructor(
    message: string,
    exitCode: number | undefined,
    stdout: string,
    stderr: string,
    innerError: Error | undefined,
  ) {
    super(message);
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.innerError = innerError;
  }
}
