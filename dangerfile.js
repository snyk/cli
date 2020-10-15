const { danger, warn, fail, message } = require('danger');

const MAX_COMMIT_MESSAGE_LENGTH = 72;
const SMOKE_TEST_BRANCH = 'feat/smoke-test';
const SMOKE_TEST_WORKFLOW_FILE_PATH = '.github/workflows/smoke-tests.yml';

if (danger.github && danger.github.pr) {
  const commitizenRegex = /^(feat|fix|chore|test|docs|perf|refactor|revert)(\(.*\))?:(.+)$/;
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

    if (firstLine.length >= MAX_COMMIT_MESSAGE_LENGTH) {
      warn(
        `Your commit message ["${firstLine}"](${url}) is too long. Keep first line of your commit under ${MAX_COMMIT_MESSAGE_LENGTH} characters.`,
      );
    }
  }

  if (!willTriggerRelease) {
    message(
      "This PR will not trigger a new version. It doesn't include any commit message with `feat` or `fix`.",
    );
  }

  // Forgotten tests check
  const modifiedTest =
    danger.git.modified_files.some((f) => f.startsWith('test/')) ||
    danger.git.created_files.some((f) => f.startsWith('test/'));
  const modifiedSrc =
    danger.git.modified_files.some((f) => f.startsWith('src/')) ||
    danger.git.created_files.some((f) => f.startsWith('src/'));

  if (modifiedSrc && !modifiedTest) {
    // TODO: let's be careful about wording here. Maybe including Contributing guidelines and project goals document here
    warn(
      "You've modified files in src/ directory, but haven't updated anything in test folder. Is there something that could be tested?",
    );
  }

  const newTestFiles = danger.git.created_files.filter((f) => {
    const inTestFolder = f.startsWith('test/');
    const inLegacyAcceptanceTestsFolder = f.includes('test/acceptance/');
    const testFilenameLooksLikeJest = f.includes('.spec.ts');
    return inTestFolder && !inLegacyAcceptanceTestsFolder && !testFilenameLooksLikeJest;
  });

  if (newTestFiles.length) {
    const joinedFileList = newTestFiles.map(f => '- `' + f + '`').join("\n");
    const msg = `Looks like you added a new Tap test. Consider making it a Jest test instead. See files like \`test/*.spec.ts\` for examples. Files found:\n${joinedFileList}`;
    warn(msg);
  }

  // Smoke test modification check
  const modifiedSmokeTest =
    danger.git.modified_files.some((f) => f.startsWith('test/smoke/')) ||
    danger.git.created_files.some((f) => f.startsWith('test/smoke/')) ||
    danger.git.modified_files.includes(SMOKE_TEST_WORKFLOW_FILE_PATH);

  const isOnSmokeTestBranch = danger.github.pr.head.ref === SMOKE_TEST_BRANCH;

  if (modifiedSmokeTest && !isOnSmokeTestBranch) {
    message(
      `You are modifying something in test/smoke directory, yet you are not on the branch ${SMOKE_TEST_BRANCH}. You can rename your branch to ${SMOKE_TEST_BRANCH} and Smoke tests will trigger for this PR.`,
    );
  }
}
