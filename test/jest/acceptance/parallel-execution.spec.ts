import { runSnykCLI } from '../util/runSnykCLI';
import { RunCommandResult } from '../util/runCommand';
import { createProject } from '../util/createProject';

jest.setTimeout(1000 * 120);

describe('Parallel CLI execution', () => {
  it('parallel test', async () => {
    const numberOfParallelExecutions = 10;

    const project = await createProject('npm/with-vulnerable-lodash-dep');

    const singleTestResult: Promise<RunCommandResult>[] = [];
    for (let i = 0; i < numberOfParallelExecutions; i++) {
      singleTestResult.push(runSnykCLI(`test -d`, { cwd: project.path() }));
    }

    const results = await Promise.all(singleTestResult);

    results.forEach((result) => {
      expect(result.code).toBe(1);
    });
  });
});
