import { fakeServer } from '../../../acceptance/fake-server';
import { runSnykSbomCliCycloneDxJsonForFixture } from './common';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom: maven options (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '58584';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
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

  test('`sbom --maven-aggregate-project` generates an SBOM for the multi-module maven project', async () => {
    const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
      'maven-aggregate-project',
      '--maven-aggregate-project',
      env,
    );

    expect(sbom.metadata.component.name).toEqual('maven-aggregate-project');
    expect(sbom.components.length).toBeGreaterThanOrEqual(11);
  });

  test('`sbom --scan-unmanaged --file=<NAME>` generates an SBOM for the specific JAR file', async () => {
    const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
      'maven-jars',
      '--scan-unmanaged --file=tomcat-http11-4.1.34.jar',
      env,
    );

    expect(sbom.metadata.component.name).toMatch(/^snyk-test-maven-jars-/);
    expect(sbom.components.length).toBeGreaterThanOrEqual(2);
  });

  test('`sbom --scan-all-unmanaged` generates an SBOM for all the available JARs', async () => {
    const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
      'maven-jars',
      '--scan-all-unmanaged',
      env,
    );

    expect(sbom.metadata.component.name).toMatch(/^snyk-test-maven-jars-/);
    expect(sbom.components.length).toBeGreaterThanOrEqual(3);
  });
});
