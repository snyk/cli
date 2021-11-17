import { danger, fail, message, warn } from 'danger';
import * as fs from 'fs';

function validateCommitMessages() {
  const commitizenRegex = /^(feat|fix|chore|test|docs|perf|refactor|revert)(\(.*\))?:(.+)$/;
  const maxMessageLength = 72;
  const ghCommits = danger.github.commits;
  let willTriggerRelease = false;
  for (const { commit } of ghCommits) {
    const { message, url } = commit;
    const firstLine = message.split('\n')[0];

    if (message.startsWith('feat') || message.startsWith('fix')) {
      willTriggerRelease = true;
    }

    const regexMatch = commitizenRegex.exec(firstLine);
    if (!regexMatch) {
      fail(
        `Commit ["${firstLine}"](${url}) is not a valid commitizen message. See [Contributing page](https://github.com/snyk/snyk/blob/master/.github/CONTRIBUTING.md#commit-types) with required commit message format.`,
      );
    }

    if (firstLine.length >= maxMessageLength) {
      warn(
        `Your commit message ["${firstLine}"](${url}) is too long. Keep first line of your commit under ${maxMessageLength} characters.`,
      );
    }
  }

  if (!willTriggerRelease) {
    message(
      "This PR will not trigger a new version. It doesn't include any commit message with `feat` or `fix`.",
    );
  }
}

function recommendWritingTest() {
  const modifiedTest =
    danger.git.modified_files.some((f) => f.startsWith('test/')) ||
    danger.git.created_files.some((f) => f.startsWith('test/'));
  const modifiedSrc =
    danger.git.modified_files.some((f) => f.startsWith('src/')) ||
    danger.git.created_files.some((f) => f.startsWith('src/'));

  if (modifiedSrc && !modifiedTest) {
    warn(
      "You've modified files in src/ directory, but haven't updated anything in test folder. Is there something that could be tested?",
    );
  }
}

function recommendJest() {
  // `.spec.ts` is always used for Jest tests
  // `.test.ts` is normally used for Tap tests and but there are also `.spec.ts` files which are used be Tap tests in test/acceptance.
  // either way, we should warn about new `.test.ts` or `.spec.ts` files being created outside the `/test/jest` folder
  const newTestFiles = danger.git.created_files.filter((f) => {
    const inTestFolder = f.startsWith('test/');
    const isATestFile = f.includes('.test.ts') || f.includes('.spec.ts');
    const inJestFolder = f.startsWith('test/jest/');
    const inFixturesFolder = f.startsWith('test/fixtures/');
    return inTestFolder && isATestFile && !inJestFolder && !inFixturesFolder;
  });

  if (newTestFiles.length) {
    const joinedFileList = newTestFiles.map((f) => '- `' + f + '`').join('\n');
    const msg = `Looks like you added a new Tap test. Consider making it a Jest test instead. See files in \`test/jest/(unit|system|acceptance)\` for examples. Files found:\n${joinedFileList}`;
    warn(msg);
  }
}

function recommendRunningSmokeTests() {
  const branchPrefix = 'smoke/';
  const workflowPath = '.github/workflows/smoke-tests.yml';

  const modifiedSmokeTest =
    danger.git.modified_files.some((f) => f.startsWith('test/smoke/')) ||
    danger.git.created_files.some((f) => f.startsWith('test/smoke/')) ||
    danger.git.modified_files.includes(workflowPath);

  const isOnSmokeTestBranch = danger.github.pr.head.ref.startsWith(
    branchPrefix,
  );

  if (modifiedSmokeTest && !isOnSmokeTestBranch) {
    message(
      `You are modifying something in test/smoke directory, yet you are not on the branch starting with ${branchPrefix}. You can prefix your branch with ${branchPrefix} and Smoke tests will trigger for this PR.`,
    );
  }
}

function requireGeneratingHelpFiles() {
  const modifiedHelpFiles =
    danger.git.modified_files.some((f) =>
      f.startsWith('help/commands-docs/'),
    ) ||
    danger.git.created_files.some((f) => f.startsWith('help/commands-docs/'));
  const modifiedGeneratedHelpFiles =
    danger.git.modified_files.some((f) => f.startsWith('help/commands-txt/')) ||
    danger.git.created_files.some((f) => f.startsWith('help/commands-txt/'));

  if (modifiedHelpFiles && !modifiedGeneratedHelpFiles) {
    fail(
      "You've modified help files in /help/commands-docs. You need to regenerate manpages locally by running `npm run generate-help` and commiting the changed files. See [README in /help for more details](https://github.com/snyk/snyk/blob/master/help/README.md)",
    );
  }
}

function recommendMigratingModuleSyntax() {
  const filesUsingNodeJSImportExport = danger.git.modified_files
    .filter((filePath) => {
      if (filePath.endsWith('.js')) {
        return false;
      }
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return (
        fileContent.includes('module.exports') ||
        fileContent.includes('= require(')
      );
    })
    .map((filePath) => `- \`${filePath}\``)
    .join('\n');

  if (filesUsingNodeJSImportExport) {
    const message =
      "Since the CLI is unifying on a standard and improved tooling, we're starting to migrate old-style `import`s and `export`s to ES6 ones.\nA file you've modified is using either `module.exports` or `require()`. If you can, please update them to ES6 [import syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) and [export syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export).\n Files found:\n" +
      filesUsingNodeJSImportExport;
    warn(message);
  }
}

validateCommitMessages();
requireGeneratingHelpFiles();
recommendWritingTest();
recommendJest();
recommendRunningSmokeTests();
recommendMigratingModuleSyntax();
