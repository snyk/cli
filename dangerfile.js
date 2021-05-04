const { danger, warn, fail, message } = require('danger');
const fs = require('fs');

const MAX_COMMIT_MESSAGE_LENGTH = 72;
const SMOKE_TEST_BRANCH = 'smoke/';
const SMOKE_TEST_WORKFLOW_FILE_PATH = '.github/workflows/smoke-tests.yml';

const dependencyTargetWithGit = /^git\+.*$/;
const dependencyTargetWithHttp = /^http:\/\/.*$/;
const dependencyTargetWithHttps = /^https:\/\/.*$/;

function getDependenciesList(packageJsonFilePath) {
  const pfFileContents = fs.readFileSync(packageJsonFilePath);
  const objNextPJFile = JSON.parse(pfFileContents);
  const deps = objNextPJFile.dependencies;
  const devDeps = objNextPJFile.devDependencies;
  const allDeps = {
    ...deps,
    ...devDeps,
  };
  return allDeps;
}

// returns true if dependencyTarget is matched by the given regex and false otherwise
function checkDepedencyTarget(dependencyTarget, regex) {
  const regexMatch = regex.test(dependencyTarget);
  return regexMatch;
}

function dangerCheckPackageJsonDependencyTargets(packageJsonFilePath) {
  const allDeps = getDependenciesList(packageJsonFilePath);
  for (const [depName, depTarget] of Object.entries(allDeps)) {
    const depTargetContainsGit = checkDepedencyTarget(depTarget, dependencyTargetWithGit);
    const depTargetContainsHttp = checkDepedencyTarget(depTarget, dependencyTargetWithHttp);
    const depTargetContainsHttps = checkDepedencyTarget(depTarget, dependencyTargetWithHttps);

    if (depTargetContainsGit) {
      fail(`The package.json file ${packageJsonFilePath} contains a dependency or devDependency \`${depName}\` with a \`git+\` target. This is bad because it requires that the user has git on their system which may not always be the case.`);
    }
    if (depTargetContainsHttp) {
      fail(`The package.json file ${packageJsonFilePath} contains a dependency or devDependency \`${depName}\` with a \`http://\` target. This is bad because it's not secure.`);
    }
    if (depTargetContainsHttps) {
      warn(`The package.json file ${packageJsonFilePath} contains a dependency or devDependency \`${depName}\` with a \`https://\` target. This may be ok, but may be worth additional consideration.`);
    }
  }
}

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
    return (
      inTestFolder &&
      !inLegacyAcceptanceTestsFolder &&
      !testFilenameLooksLikeJest
    );
  });

  if (newTestFiles.length) {
    const joinedFileList = newTestFiles.map((f) => '- `' + f + '`').join('\n');
    const msg = `Looks like you added a new Tap test. Consider making it a Jest test instead. See files like \`test/*.spec.ts\` for examples. Files found:\n${joinedFileList}`;
    warn(msg);
  }

  // fail on dependencies in package.json which refer to `git+...`, `http://...` and warn on `http://...`
  const modifiedPackageJsonFiles = danger.git.modified_files.filter((f) => f.includes('package.json'));
  const newPackageJsonFiles = danger.git.created_files.filter((f) => f.includes('package.json'));
  const allPackageJsonFiles = modifiedPackageJsonFiles.concat(newPackageJsonFiles);

  for (const nextPackageJsonFile of allPackageJsonFiles) {
    dangerCheckPackageJsonDependencyTargets(nextPackageJsonFile);
  }

  // Smoke test modification check
  const modifiedSmokeTest =
    danger.git.modified_files.some((f) => f.startsWith('test/smoke/')) ||
    danger.git.created_files.some((f) => f.startsWith('test/smoke/')) ||
    danger.git.modified_files.includes(SMOKE_TEST_WORKFLOW_FILE_PATH);

  const isOnSmokeTestBranch = danger.github.pr.head.ref.startsWith(
    SMOKE_TEST_BRANCH,
  );

  if (modifiedSmokeTest && !isOnSmokeTestBranch) {
    message(
      `You are modifying something in test/smoke directory, yet you are not on the branch starting with ${SMOKE_TEST_BRANCH}. You can prefix your branch with ${SMOKE_TEST_BRANCH} and Smoke tests will trigger for this PR.`,
    );
  }
}
