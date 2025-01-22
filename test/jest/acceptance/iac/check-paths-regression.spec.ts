import { startMockServer } from './helpers';
import { NoFilesToScanError } from '../../../../src/cli/commands/test/iac/local-execution/file-loader';

jest.setTimeout(50000);

describe('checkPath() regression test snyk/cli#3406', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
  });

  afterAll(async () => teardown());

  const filePath = './iac/check-paths-regression/package.json';

  it('supports scanning a project matching an OSS manifest name', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ${filePath}`);
    expect(stdout).not.toContain(`--file=${filePath}`);
    expect(stdout).toContainText(new NoFilesToScanError().message);
    expect(exitCode).toBe(3);
  });
});
