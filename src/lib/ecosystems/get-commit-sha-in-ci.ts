import { execSync } from 'child_process';

/**
 * A prioritized list of environment variables that CI/CD platforms
 * use to expose the Git commit SHA. Ordered by popularity and specificity.
 */
const CI_COMMIT_SHA_VARS: readonly string[] = [
  'SNYK_GIT_SHA', // Snyk dedicated value if provided
  'GITHUB_SHA', // GitHub Actions
  'CI_COMMIT_SHA', // GitLab CI/CD, BuildBuddy
  'TRAVIS_COMMIT', // Travis CI
  'CIRCLE_SHA1', // CircleCI
  'CODEBUILD_RESOLVED_SOURCE_VERSION', // AWS CodeBuild
  'BUILD_SOURCEVERSION', // Azure DevOps
  'GIT_COMMIT', // Jenkins (with Git Plugin)
  'COMMIT_SHA', // Google Cloud Build
  'REVISION_ID', // Google Cloud Build (alternative)
  'DRONE_COMMIT_SHA', // Harness CI (Drone)
  'BUDDY_RUN_COMMIT', // Buddy
  'OX_BITBUCKET_FULL_COMMIT', // Bitbucket (full SHA)
  'BITBUCKET_COMMIT', // Bitbucket Pipelines
  'SEMAPHORE_GIT_SHA', // Semaphore
  'BUILDKITE_COMMIT', // Buildkite
  'BITRISE_GIT_COMMIT', // Bitrise
  'GO_REVISION', // GoCD
  'VOLATILE_GIT_COMMIT',
];

/**
 * Retrieves the Git commit SHA from the current environment.
 *
 * This function follows a three-tiered approach for maximum reliability:
 * 1. Checks for an explicit override environment variable (SNYK_GIT_SHA).
 * 2. Probes a list of known environment variables from various CI/CD platforms.
 * 3. Falls back to executing `git rev-parse HEAD` if no environment variable is found.
 *
 * @returns {string | null} The Git commit SHA (7-40 characters), or null if it cannot be determined.
 */
export function getCommitSha(): string | null {
  // Tier 1 & 2: Check environment variables from CI/CD platforms
  for (const varName of CI_COMMIT_SHA_VARS) {
    const commitSha = process.env[varName];
    if (commitSha) {
      // Validate it looks like a SHA (hexadecimal, 7-40 chars)
      if (/^[a-f0-9]{7,40}$/i.test(commitSha)) {
        return commitSha;
      }
    }
  }

  // Tier 3: Fallback to Git command
  try {
    const gitOutput = execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000, // 5 second timeout
    });
    const commitSha = gitOutput.trim();

    // Validate the output (should be 40-character full SHA)
    if (/^[a-f0-9]{40}$/i.test(commitSha)) {
      return commitSha;
    }
  } catch (error) {
    // Git command failed - not installed, not a git repo, or no commits yet
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `Warning: Failed to determine commit SHA via git command: ${errorMessage}`,
    );
  }

  return null;
}
