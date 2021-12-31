import * as semver from 'semver';

type Issue = {
  target: string;
  reason: string;
  enforce: boolean;
};

const checkDevEnvironment = async () => {
  const issues: Issue[] = [];
  const supportedNpmVersionRange = '>=7.21.1';

  try {
    /**
     * Example: npm/7.14.0 node/v14.16.1 linux x64 workspaces/false
     * Docs: https://docs.npmjs.com/cli/v8/using-npm/config#user-agent
     *
     * Note: Doesn't work with Lerna. https://github.com/snyk/snyk/pull/2002
     */
    const userAgent = process.env.npm_config_user_agent;
    if (!userAgent) {
      throw new Error("Couldn't find npm_config_user_agent.");
    }

    const matches = /npm\/((\d+)\.\d+\.\d+)/.exec(userAgent);
    if (!matches) {
      throw new Error(`Couldn't find npm version in user agent "${userAgent}"`);
    }

    const [, npmVersion] = matches;
    if (!semver.satisfies(npmVersion, supportedNpmVersionRange)) {
      issues.push({
        target: 'npm',
        reason: `Expected npm@${supportedNpmVersionRange} but found npm@${npmVersion}`,
        enforce: true,
      });
    }
  } catch (error) {
    issues.push({
      target: 'npm',
      reason: `Expected npm@${supportedNpmVersionRange} but faced an error:\n${error}`,
      enforce: false,
    });
  }

  return issues;
};

const run = async () => {
  try {
    const issues = await checkDevEnvironment();
    if (issues.length > 0) {
      console.log('✘ Unsupported Development Environment');
      issues.forEach((issue) => console.log(`  - ${issue.reason}`));
      if (issues.find((issue) => issue.enforce)) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(
      '✘ Failed to detect development environment. See the error below.',
    );
    console.error(error);
    process.exit(1);
  }
};

run();
