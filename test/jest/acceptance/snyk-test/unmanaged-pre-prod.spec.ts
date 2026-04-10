import { describeIf } from '../../../utils';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

const hasPreProdCredentials = Boolean(
  process.env.TEST_SNYK_API_DEV && process.env.TEST_SNYK_TOKEN_DEV,
);

const env = {
  ...process.env,
  SNYK_API: process.env.TEST_SNYK_API_DEV,
  SNYK_TOKEN: process.env.TEST_SNYK_TOKEN_DEV,
};

describeIf(hasPreProdCredentials)('unmanaged pre-prod user journey', () => {
  test('runs `snyk test --unmanaged` against pre-prod', async () => {
    const project = await createProjectFromWorkspace('unmanaged');
    const { code, stdout, stderr } = await runSnykCLI('test --unmanaged -d', {
      cwd: project.path(),
      env,
    });

    if (code !== 1) {
      console.debug(stderr);
      console.debug('---------------------------');
      console.debug(stdout);
    }

    expect(code).toEqual(1);
    expect(stdout).toContain('pkg:generic/zlib@');
  });

  test('runs `snyk test --unmanaged --json` against pre-prod', async () => {
    const project = await createProjectFromWorkspace('unmanaged');
    const { code, stdout, stderr } = await runSnykCLI(
      'test --unmanaged -d --json',
      {
        cwd: project.path(),
        env,
      },
    );

    if (code !== 1) {
      console.debug(stderr);
      console.debug('---------------------------');
      console.debug(stdout);
    }

    expect(code).toEqual(1);
    expect(JSON.parse(stdout)).toEqual(expect.any(Array));
    expect(stdout).toContain('"purl": "pkg:generic/zlib@');
  });
});
