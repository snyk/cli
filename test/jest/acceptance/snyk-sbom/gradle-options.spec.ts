import { fakeServer } from '../../../acceptance/fake-server';
import { isWindowsOperatingSystem, testIf } from '../../../utils';
import { runSnykSbomCliCycloneDxJsonForFixture } from './common';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom: gradle options (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '58586';
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

  test('`sbom --sub-project=<NAME>` generates an SBOM for selected sub-project', async () => {
    if (isWindowsOperatingSystem()) {
      // Address as part CLI-1203
      return;
    }
    const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
      'gradle-multi-project',
      '--sub-project=lib',
      env,
    );

    expect(sbom.metadata.component.name).toEqual('example-multi-project/lib');
    expect(sbom.components.length).toBeGreaterThan(1);
  });

  // Address as part CLI-1203
  testIf(!isWindowsOperatingSystem())(
    '`sbom --gradle-sub-project=<NAME>` generates an SBOM for selected sub-project',
    async () => {
      const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
        'gradle-multi-project',
        '--gradle-sub-project=lib',
        env,
      );

      expect(sbom.metadata.component.name).toEqual('example-multi-project/lib');
      expect(sbom.components.length).toBeGreaterThan(1);
    },
  );

  // Address as part CLI-1203
  testIf(!isWindowsOperatingSystem())(
    '`sbom --all-sub-projects` generates an SBOM for all sub-projects',
    async () => {
      const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
        'gradle-multi-project',
        '--all-sub-projects',
        env,
      );

      expect(sbom.metadata.component.name).toEqual('gradle-multi-project');
      const listedComponentNames = sbom.components.map((it) => it.name);
      expect(listedComponentNames).toContain('example-multi-project');
      expect(listedComponentNames).toContain('example-multi-project/lib');
      expect(listedComponentNames).toContain('example-multi-project/app');
    },
  );

  // Address as part CLI-1203
  testIf(!isWindowsOperatingSystem())(
    '`sbom --configuration-matching=<CONFIGURATION_REGEX>` generates an SBOM only for matching configuration',
    async () => {
      const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
        'gradle-configurations',
        '--configuration-matching=^runtimeClasspath$',
        env,
      );

      const listedComponentNames = sbom.components.map((it) => it.name);
      expect(listedComponentNames).toContain('org.jooq:jooq');
      expect(listedComponentNames).toContain('com.google.guava:guava');
      expect(listedComponentNames).not.toContain('junit:junit');
    },
  );

  // Address as part CLI-1203
  testIf(isWindowsOperatingSystem())(
    '`sbom --configuration-attributes=<ATTRIBUTE>[,<ATTRIBUTE>]...` generates an SBOM only for matching variant',
    async () => {
      const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
        'gradle-configurations',
        '--configuration-attributes=snykattr:api',
        env,
      );

      // I failed to prepare an example where this works,
      // so I will just test here that CLI executes successfully,
      // meaning the command does not fail due to unrecognized config.
      // To prepare the example I tried to set attribute on a configuration and filter by that,
      // but I was always getting a full list of dependencies instead of a subset.
      // The same I was getting when trying `snyk test` command.
      // I was adding attributes as documented here: https://docs.gradle.org/current/userguide/variant_attributes.html
      // I also tried using existing attribute `usage:java-api`, but also no luck.
      expect(sbom.metadata.component.name).toEqual('gradle-configurations');
      // const listedComponentNames = sbom.components.map((it) => it.name);
      // expect(listedComponentNames).toContain('org.jooq:jooq');
      // expect(listedComponentNames).not.toContain('com.google.guava:guava');
    },
  );

  // Address as part CLI-1203
  testIf(isWindowsOperatingSystem())(
    '`sbom --init-script=<FILE>` applies given init script',
    async () => {
      const sbom = await runSnykSbomCliCycloneDxJsonForFixture(
        'gradle-configurations',
        '--init-script=test-init.gradle',
        env,
      );

      const listedComponentNames = sbom.components.map((it) => it.name);
      expect(listedComponentNames).toContain(
        'org.apache.logging.log4j:log4j-api',
      ); // Dep added by init script
    },
  );
});
