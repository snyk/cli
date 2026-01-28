import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom: show-maven-build-scope feature flag (mocked server only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server?.restore();
  });

  afterAll((done) => {
    if (server) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  test('`sbom` with show-maven-build-scope enabled returns scope for CycloneDX 1.6 format', async () => {
    server.setFeatureFlag('show-maven-build-scope', true);
    const project = await createProjectFromFixture('maven-print-graph');

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.6+json --debug --file=pom.xml`,
      {
        cwd: project.path(),
        env,
      },
    );


    expect(code).toEqual(0);
    const bom = JSON.parse(stdout);
    expect(bom.specVersion).toEqual('1.6');

    const componentsWithScope = bom.components?.filter(
      (c: { properties?: Array<{ name: string; value: string }> }) =>
        c.properties?.some((p) => p.name === 'snyk:maven:build_scope'),
    );
    expect(componentsWithScope?.length).toBeGreaterThan(0);
  });

  test('`sbom` with show-maven-build-scope enabled returns scope for SPDX 2.3 format', async () => {
    server.setFeatureFlag('show-maven-build-scope', true);
    const project = await createProjectFromFixture('maven-print-graph');

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=spdx2.3+json --debug --file=pom.xml`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    const bom = JSON.parse(stdout);
    expect(bom.spdxVersion).toEqual('SPDX-2.3');

    const packagesWithScope = bom.packages?.filter(
      (pkg: { properties?: Array<{ name: string; value: string }> }) =>
        pkg.properties?.some((p) => p.name === 'snyk:maven:build_scope'),
    );
    expect(packagesWithScope?.length).toBeGreaterThan(0);
  });
});
