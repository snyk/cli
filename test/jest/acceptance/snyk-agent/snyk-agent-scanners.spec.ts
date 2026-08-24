import { resolve } from 'path';
import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ACTION_NEEDED = 1;
const scannerSection = (name: string): RegExp =>
  new RegExp(`^${name}(?:\\[|:|_)`, 'm');

describe('snyk agent scanner selection (real server)', () => {
  let env: Record<string, string>;
  let project: Awaited<ReturnType<typeof createProjectFromFixture>>;

  beforeAll(async () => {
    project = await createProjectFromFixture('npm/no-dependencies');
    env = {
      ...process.env,
      SNYK_DISABLE_ANALYTICS: '1',
    };
  });

  afterAll(async () => {
    await project.remove();
  });

  const runAgentTest = (scanners = '') =>
    runSnykCLI(`agent test${scanners ? ` ${scanners}` : ''}`, {
      cwd: project.path(),
      env,
    });

  const expectSections = (
    stdout: string,
    present: string[],
    absent: string[],
  ): void => {
    for (const section of present) {
      expect(stdout).toMatch(scannerSection(section));
    }
    for (const section of absent) {
      expect(stdout).not.toMatch(scannerSection(section));
    }
  };

  const expectCompletedScan = (code: number): void => {
    expect([EXIT_CODE_SUCCESS, EXIT_CODE_ACTION_NEEDED]).toContain(code);
  };

  it('selects SCA, SAST, and Secrets by default, but not Container', async () => {
    const { code, stdout } = await runAgentTest();

    expectCompletedScan(code);
    expectSections(stdout, ['sca', 'sast', 'secrets'], ['container']);
  });

  // Live SAST journeys require TEST_SNYK_TOKEN and the configured Snyk API.
  it('selects only SAST and Secrets for the requested subset', async () => {
    const { code, stdout } = await runAgentTest('sast secrets');

    expectCompletedScan(code);
    expectSections(stdout, ['sast', 'secrets'], ['sca', 'container']);
  });

  it.each([
    ['sca', 'sca', ['sast', 'secrets', 'container']],
    ['sast', 'sast', ['sca', 'secrets', 'container']],
    ['secrets', 'secrets', ['sca', 'sast', 'container']],
  ])(
    'selects only the %s scanner',
    async (scanner, outputSection, absentSections) => {
      const { code, stdout } = await runAgentTest(scanner as string);

      expectCompletedScan(code);
      expectSections(
        stdout,
        [outputSection as string],
        absentSections as string[],
      );
    },
  );

  it('passes an explicit local image only to Container', async () => {
    const image = resolve(
      __dirname,
      '../../../fixtures/container-projects/python-with-pip-dependencies.tar',
    );
    const { code, stdout } = await runAgentTest(
      `container --image=docker-archive:${image}`,
    );

    expectCompletedScan(code);
    expectSections(stdout, ['container'], ['sca', 'sast', 'secrets']);
  });
});
