import { runSnykCLI } from '../util/runSnykCLI';
import { RunCommandResult } from '../util/runCommand';
import { createProject } from '../util/createProject';
import {
  USER_JOURNEY_CLI_TIMEOUT_SECS,
  USER_JOURNEY_JEST_TIMEOUT_MS,
} from '../util/constants';

jest.setTimeout(USER_JOURNEY_JEST_TIMEOUT_MS);

describe('Parallel CLI execution', () => {
  it('parallel test', async () => {
    const numberOfParallelExecutions = 10;

    const project = await createProject('npm/with-vulnerable-lodash-dep');
    const env = {
      ...process.env,
      SNYK_TIMEOUT_SECS: USER_JOURNEY_CLI_TIMEOUT_SECS,
    };

    const singleTestResult: Promise<RunCommandResult>[] = [];
    for (let i = 0; i < numberOfParallelExecutions; i++) {
      singleTestResult.push(
        runSnykCLI(`test -d`, { cwd: project.path(), env }),
      );
    }

    const results = await Promise.all(singleTestResult);

    results.forEach((result) => {
      expect(result.code).toBe(1);
    });
  });
});
