import { EOL } from 'os';
import { startMockServer } from './helpers';

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

  it('supports scanning a project matching an OSS manifest name', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/check-paths-regression/package.json`,
    );
    expect(stdout).not.toContain(
      '--file=iac/check-paths-regression/package.json',
    );
    expect(stdout).toContain(
      'Could not find any valid IaC files' +
        EOL +
        '  Path: ./iac/check-paths-regression/package.json',
    );
    expect(exitCode).toBe(3);
  });
});
