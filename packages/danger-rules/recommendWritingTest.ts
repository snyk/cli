import { DangerRule } from './types';

const recommendWritingTest: DangerRule = ({ danger, warn }) => {
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
};

export { recommendWritingTest as rule };
