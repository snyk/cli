import { runSnykCLI } from '../util/runSnykCLI';
import { RunCommandResult } from '../util/runCommand';

jest.setTimeout(1000 * 60);

describe('Parallel CLI execution', () => {
  it('parallel woof', async () => {
    const numberOfParallelExecutions = 10;

    const singleTestResult: Promise<RunCommandResult>[] = [];
    for (let i = 0; i < numberOfParallelExecutions; i++) {
      singleTestResult.push(runSnykCLI(`woof -d`));
    }

    for (let i = 0; i < numberOfParallelExecutions; i++) {
      const { code } = await singleTestResult[i];
      expect(code).toBe(0);
    }
  });
});
