import { fakeServer } from '../../../acceptance/fake-server';
import { runSnykSbomCliCycloneDxJsonForFixture } from './common';
import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom: maven options (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '58587';
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

  test('`sbom --file` generates an SBOM without pruning', async () => {
    const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
      'maven-print-graph',
      '--file=pom.xml',
      env,
    );

    expect(sbom.metadata.component.name).toEqual(
      'io.snyk.example:test-project',
    );
    expect(sbom.dependencies.length).toBeGreaterThanOrEqual(7);
    expect(sbom.dependencies[6].ref).toEqual(
      'commons-discovery:commons-discovery@0.2',
    );
    expect(sbom.dependencies[6].dependsOn.length).toEqual(1);
    expect(sbom.dependencies[6].dependsOn[0]).toEqual(
      'commons-logging:commons-logging@1.0.4',
    );
  });

  test('`sbom --scan-unmanaged --file=<NAME>` fails to generate an SBOM for user defined JAR file', async () => {
    const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
      'maven-jars',
      '--scan-unmanaged --file=mvn-app-1.0-SNAPSHOT.jar',
      env,
    );

    expect(sbom.metadata.component.name).toMatch(/^snyk-test-maven-jars-/);
    expect(sbom.components.length).toBe(2);
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

  test('`sbom using double dash (--) to specify a settings.xml for the underlying maven command', async () => {
    const project = await createProjectFromFixture('maven-aggregate-project');

    const { code: code2, stderr } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.4+json --debug --maven-aggregate-project -- -s settings.xml`,
      {
        cwd: project.path(),
        env,
      },
    );
    expect(code2).toEqual(2);
    console.log(stderr);

    const { code: code0 } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.4+json --debug --maven-aggregate-project`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code0).toEqual(0);
  });
});
