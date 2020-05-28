/**
 * This is to count the number of "contributing" developers using Snyk on a given repo.
 * "Contributing" is defined as having contributed a commit in the last 90 days.
 * This is use only on the `snyk monitor` command as that is used to monitor a project's dependencies in an
 * on-going manner.
 * It collects only a hash of the email of a git user and the most recent commit timestamp (both per the `git log`
 * output) and can be disabled by config (see https://snyk.io/policies/tracking-and-analytics/).
 */
import * as crypto from 'crypto';
import { exec } from 'child_process';

export const SERIOUS_DELIMITER = '_SNYK_SEPARATOR_';
export const CONTRIBUTING_DEVELOPER_PERIOD_DAYS = 90;

export class GitCommitInfo {
  authorHashedEmail: string;
  commitTimestamp: string; // use ISO 8601 format

  constructor(authorHashedEmail: string, commitTimestamp: string) {
    if (isSha1Hash(authorHashedEmail)) {
      this.authorHashedEmail = authorHashedEmail;
      this.commitTimestamp = commitTimestamp;
    } else {
      throw new Error('authorHashedEmail must be a sha1 hash');
    }
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

  public addCommitInfo(info: GitCommitInfo) {
    this.commitInfos.push(info);
  }

  public getUniqueAuthorsCount(): number {
    const uniqueAuthorHashedEmails = this.getUniqueAuthorHashedEmails();
    return uniqueAuthorHashedEmails.size;
  }

  public getCommitsCount(): number {
    return this.commitInfos.length;
  }

  public getUniqueAuthorHashedEmails(): Set<string> {
    const allCommitAuthorHashedEmails: string[] = this.commitInfos.map(
      (c) => c.authorHashedEmail,
    );
    const uniqueAuthorHashedEmails: Set<string> = new Set(
      allCommitAuthorHashedEmails,
    );
    return uniqueAuthorHashedEmails;
  }

  public getRepoContributors(): { userId: string; lastCommitDate: string }[] {
    const uniqueAuthorHashedEmails = this.getUniqueAuthorHashedEmails();
    const contributors: { userId: string; lastCommitDate: string }[] = [];

    // for each uniqueAuthorHashedEmails, get the latest commit
    for (const nextUniqueAuthorHashedEmail of uniqueAuthorHashedEmails) {
      const latestCommitTimestamp = this.getMostRecentCommitTimestamp(
        nextUniqueAuthorHashedEmail,
      );
      contributors.push({
        userId: nextUniqueAuthorHashedEmail,
        lastCommitDate: latestCommitTimestamp,
      });
    }
    return contributors;
  }

  public getMostRecentCommitTimestamp(authorHashedEmail: string): string {
    for (const nextGI of this.commitInfos) {
      if (nextGI.authorHashedEmail === authorHashedEmail) {
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
  const hashedAuthorEmail = hashData(authorEmail);
  const commitInfo = new GitCommitInfo(hashedAuthorEmail, commitTimestamp);
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

export function hashData(s: string): string {
  const hashedData = crypto
    .createHash('sha1')
    .update(s)
    .digest('hex');
  return hashedData;
}

export function isSha1Hash(data: string): boolean {
  // sha1 hash must be exactly 40 characters of 0-9 / a-f (i.e. lowercase hex characters)
  // ^ == start anchor
  // [0-9a-f] == characters 0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f only
  // {40} 40 of the [0-9a-f] characters
  // $ == end anchor
  const matchRegex = new RegExp('^[0-9a-f]{40}$');
  const looksHashed = matchRegex.test(data);
  return looksHashed;
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
  repoPath: string,
  fnShellout: (cmd: string, workingDirectory: string) => Promise<string>,
): Promise<string> {
  try {
    const gitLogCommand = `git --no-pager log --pretty=tformat:"%H${SERIOUS_DELIMITER}%an${SERIOUS_DELIMITER}%ae${SERIOUS_DELIMITER}%aI" --after="${timestampEpochSecondsStartOfPeriod}"`;
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
        // TODO: we can probably remove this after unshipping Node 8 support
        // and then just directly get the error code like `error.code`
        let exitCode = 0;
        try {
          exitCode = parseInt(error['code']);
        } catch {
          exitCode = -1;
        }

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
