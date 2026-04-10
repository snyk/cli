import { describeIf } from '../../../utils';
import {
  createProjectFromFixture,
  createProjectFromWorkspace,
} from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import * as path from 'path';

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

  test('runs `snyk sbom --unmanaged --max-depth=1` against pre-prod', async () => {
    const project = await createProjectFromFixture(
      path.join('unmanaged', 'extraction'),
    );
    const { code, stdout, stderr } = await runSnykCLI(
      `sbom --unmanaged --max-depth=1 --format=cyclonedx1.4+json --org=${process.env.TEST_SNYK_ORG_SLUGNAME} --debug`,
      {
        cwd: project.path(),
        env,
      },
    );

    if (code !== 0) {
      console.debug(stderr);
      console.debug('---------------------------');
      console.debug(stdout);
    }

    expect(code).toEqual(0);

    let sbom;
    expect(() => {
      sbom = JSON.parse(stdout);
    }).not.toThrow();

    expect(sbom.metadata.component.name).toEqual('root-node');
    expect(sbom.components.length).toBeGreaterThanOrEqual(1);
  });
});
