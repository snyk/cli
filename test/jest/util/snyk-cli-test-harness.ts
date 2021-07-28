import { runSnykCLI } from './runSnykCLI';
import { RunCommandResult } from './runCommand';

import * as path from 'path';

type CLITestHarness = {
  path: string;
  test: () => Promise<RunCommandResult>;
};

const createCLITestHarness = (fixture: string): CLITestHarness => {
  const fixturePath = path.resolve('test/fixtures', fixture);
  return {
    path: fixturePath,
    test: () =>
      runSnykCLI(`test --all-projects`, {
        cwd: fixturePath,
      }),
  };
};

export { createCLITestHarness };
