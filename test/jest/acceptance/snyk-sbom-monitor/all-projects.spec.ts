import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { getServerPort } from '../../util/getServerPort';
import { getFixturePath } from '../../util/getFixturePath';
import * as path from 'path';

jest.setTimeout(1000 * 60);

describe('snyk sbom monitor (mocked server only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_API_REST_URL: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  beforeEach(() => {
    server.setFeatureFlag('sbomMonitorBeta', true);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('monitor success', async () => {
    const fileToTest = path.resolve(
      getFixturePath('sbom'),
      'npm-sbom-cdx15.json',
    );

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom monitor --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --experimental --file ${fileToTest}`,
      { env },
    );

    expect(code).toEqual(0);

    expect(stderr).toEqual('');
    expect(stdout).toContain(`Monitoring 'test-project'...`);
    expect(stdout).toContain(
      `Explore this snapshot at http://example-url/project/project-public-id/history/snapshot-public-id`,
    );
    expect(stdout).toContain(
      `Notifications about newly disclosed issues related to these dependencies will be emailed to you.`,
    );
  });

  test('monitor bad SBOM', async () => {
    const fileToTest = path.resolve(getFixturePath('sbom'), 'bad-sbom.json');

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom monitor --org badaabad-badb-badb-badb-badbadbadbad --experimental --file ${fileToTest}`,
      { env },
    );

    expect(code).toEqual(2);

    expect(stderr).toEqual('');
    expect(stdout).toContain(`Bad Request (SNYK-0003)`);
    expect(stdout).toContain(`invalid SBOM`);
  });

  test('missing experimental flag', async () => {
    const fileToTest = path.resolve(
      getFixturePath('sbom'),
      'npm-sbom-cdx15.json',
    );

    const { stdout, stderr } = await runSnykCLI(
      `sbom monitor --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --file ${fileToTest}`,
      { env },
    );

    expect(stdout).toMatch(
      'Flag `--experimental` is required to execute this command.',
    );

    expect(stderr).toEqual('');
  });

  test('missing file flag', async () => {
    const { stdout, stderr } = await runSnykCLI(
      `sbom monitor --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --experimental`,
      { env },
    );

    expect(stdout).toContainText(
      'Flag `--file` is required to execute this command. Value should point to a valid SBOM document.',
    );

    expect(stderr).toEqual('');
  });

  test('feature flag sbomMonitorBeta is disabled', async () => {
    const fileToTest = path.resolve(
      getFixturePath('sbom'),
      'npm-sbom-cdx15.json',
    );

    server.setFeatureFlag('sbomMonitorBeta', false);

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom monitor --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --experimental --file ${fileToTest}`,
      { env },
    );

    expect(code).toEqual(2);

    expect(stderr).toEqual('');
    expect(stdout).toContain(
      `The feature you are trying to use is not available for your organization.`,
    );
  });
});
