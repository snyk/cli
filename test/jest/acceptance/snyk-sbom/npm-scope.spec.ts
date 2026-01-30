import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

describe('show-npm-scope feature flag - snyk sbom acceptance tests', () => {
  let server;
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
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('should NOT include npm scope in CycloneDX SBOM when feature flag is disabled', async () => {
    server.setFeatureFlag('show-npm-scope', false);
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stdout } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.4+json`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toBe(0);

    const sbom = JSON.parse(stdout);

    expect(sbom.components).toBeDefined();
    expect(sbom.components.length).toBeGreaterThan(0);

    sbom.components.forEach((component) => {
      const hasNpmScope = component.properties?.some(
        (prop) => prop.name === 'snyk:npm:scope',
      );
      expect(hasNpmScope).toBe(false);
    });
  });

  test('should NOT include npm scope in SPDX SBOM when feature flag is disabled', async () => {
    server.setFeatureFlag('show-npm-scope', false);
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stdout } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=spdx2.3+json`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toBe(0);

    const sbom = JSON.parse(stdout);

    expect(sbom.packages).toBeDefined();
    expect(sbom.packages.length).toBeGreaterThan(0);

    sbom.packages.forEach((pkg) => {
      const hasNpmScope = pkg.annotations?.some((annotation) =>
        annotation.annotationComment?.includes('snyk:npm:scope'),
      );
      expect(hasNpmScope).toBeFalsy();
    });
  });

  test('should include npm scope properties in CycloneDX SBOM', async () => {
    server.setFeatureFlag('show-npm-scope', true);
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stdout } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.4+json`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toBe(0);

    const sbom = JSON.parse(stdout);

    expect(sbom.components).toBeDefined();
    expect(sbom.components.length).toBeGreaterThan(0);

    const componentsWithScope = sbom.components.filter((component) =>
      component.properties?.some((prop) => prop.name === 'snyk:npm:scope'),
    );

    expect(componentsWithScope.length).toBeGreaterThan(0);

    componentsWithScope.forEach((component) => {
      const scopeProperty = component.properties.find(
        (prop) => prop.name === 'snyk:npm:scope',
      );

      expect(scopeProperty).toBeDefined();
      expect(scopeProperty.value).toBeDefined();
      expect(['prod', 'dev', 'optional', 'peer', 'unknown']).toContain(
        scopeProperty.value,
      );
    });
  });

  test('should include npm scope annotations in SPDX SBOM', async () => {
    server.setFeatureFlag('show-npm-scope', true);
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stdout } = await runSnykCLI(
      `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=spdx2.3+json`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toBe(0);

    const sbom = JSON.parse(stdout);

    expect(sbom.packages).toBeDefined();
    expect(sbom.packages.length).toBeGreaterThan(0);

    const packagesWithScope = sbom.packages.filter((pkg) =>
      pkg.annotations?.some((annotation) =>
        annotation.annotationComment?.includes('snyk:npm:scope='),
      ),
    );

    expect(packagesWithScope.length).toBeGreaterThan(0);

    packagesWithScope.forEach((pkg) => {
      const scopeAnnotation = pkg.annotations.find((annotation) =>
        annotation.annotationComment?.includes('snyk:npm:scope='),
      );

      expect(scopeAnnotation).toBeDefined();
      expect(scopeAnnotation.annotationType).toBe('OTHER');
      expect(scopeAnnotation.annotator).toBeDefined();
      expect(scopeAnnotation.annotator.annotator).toBe('Snyk');
      expect(scopeAnnotation.annotator.annotatorType).toBe('Tool');

      // Extract and validate scope value
      const match =
        scopeAnnotation.annotationComment.match(/snyk:npm:scope=(\w+)/);
      expect(match).not.toBeNull();
      if (match) {
        const scopeValue = match[1];
        expect(['prod', 'dev', 'optional', 'peer', 'unknown']).toContain(
          scopeValue,
        );
      }
    });
  });
});
