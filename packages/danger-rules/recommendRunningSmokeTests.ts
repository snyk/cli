import { DangerRule } from './types';

const recommendRunningSmokeTests: DangerRule = ({ danger, message }) => {
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
};

export { recommendRunningSmokeTests as rule };
