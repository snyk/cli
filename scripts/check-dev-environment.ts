type Issue = {
  target: string;
  reason: string;
  enforce: boolean;
};

/**
 * We have a hack in .circleci/config.yml which uses npm@6 for regression
 * tests. Once that's removed we can remove this check.
 */
const isCIHackInstall = (): boolean => {
  return (
    typeof process.env.CI === 'string' && process.env.NODE_ENV === 'production'
  );
};

const checkDevEnvironment = async () => {
  const issues: Issue[] = [];
  const expectedNpmVersion = '7';

  try {
    // npm/7.14.0 node/v14.16.1 linux x64 workspaces/false
    const userAgent = process.env.npm_config_user_agent;
    if (!userAgent) {
      throw new Error("Couldn't find npm_config_user_agent.");
    }

    const matches = /npm\/((\d+)\.\d+\.\d+)/.exec(userAgent);
    if (!matches) {
      throw new Error(`Couldn't find npm version in user agent "${userAgent}"`);
    }

    const [, npmVersion, npmMajor] = matches;
    if (npmMajor !== expectedNpmVersion) {
      issues.push({
        target: 'npm',
        reason: `Expected npm@${expectedNpmVersion} but found npm@${npmVersion}`,
        enforce: !isCIHackInstall(),
      });
    }
  } catch (error) {
    issues.push({
      target: 'npm',
      reason: `Expected npm@${expectedNpmVersion} but faced an error:\n${error}`,
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
