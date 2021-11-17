import { DangerRule } from './types';

const recommendJest: DangerRule = ({ danger, warn }) => {
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
};

export { recommendJest as rule };
