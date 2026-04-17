import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

/**
 * Acceptance tests for `snyk sbom --allow-incomplete-sbom --all-projects`.
 *
 * These tests exercise the full CLI pipeline end-to-end against a fake server
 * and use real fixture projects that are intentionally broken to validate the
 * allow-incomplete-sbom behaviour.
 *
 * Fixture layout (test/fixtures/sbom-allow-incomplete/):
 *  npm-multi-partial-broken/
 *    valid-project/    – valid npm project with package-lock.json
 *    broken-project/   – npm project with an invalid (unparseable) package.json
 *  npm-multi-all-broken/
 *    broken-project-a/ – invalid package.json
 *    broken-project-b/ – invalid package.json
 */
describe('snyk sbom --allow-incomplete-sbom (mocked server only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: `http://localhost:${port}${baseApi}`,
      SNYK_HOST: `http://localhost:${port}`,
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
    server.close(() => done());
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getSbomApiRequests = () =>
    server
      .getRequests()
      .filter(
        (req: any) => req.method === 'POST' && req.path.includes('/sbom'),
      );

  // ---------------------------------------------------------------------------
  // CycloneDX 1.6 + JSON
  // ---------------------------------------------------------------------------

  describe('--format cyclonedx1.6+json', () => {
    test(
      'GIVEN a multi-project workspace with one broken npm project ' +
        'WHEN running sbom --format cyclonedx1.6+json --allow-incomplete-sbom --all-projects ' +
        'THEN exits 0, produces a valid CycloneDX 1.6 SBOM from the healthy project, ' +
        'and the SBOM API request body contains scanErrors for the broken project',
      async () => {
        // GIVEN
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-partial-broken',
        );

        // WHEN
        const { code, stdout, stderr } = await runSnykCLI(
          'sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' +
            ' --format cyclonedx1.6+json' +
            ' --allow-incomplete-sbom' +
            ' --all-projects' +
            ' --debug',
          { cwd: project.path(), env },
        );

        if (code !== 0) {
          console.error('stderr:', stderr);
        }

        // THEN – CLI exits successfully
        expect(code).toEqual(0);

        // THEN – stdout is a parseable CycloneDX 1.6 document
        let bom: any;
        expect(() => {
          bom = JSON.parse(stdout);
        }).not.toThrow();
        expect(bom.specVersion).toEqual('1.6');
        expect(bom['$schema']).toEqual(
          'http://cyclonedx.org/schema/bom-1.6.schema.json',
        );

        // THEN – the SBOM contains components resolved from the healthy project
        // (valid-project depends on debug@2.2.0 → ms@0.7.1)
        expect(Array.isArray(bom.components)).toBe(true);
        expect(bom.components.length).toBeGreaterThan(0);

        // THEN – the SBOM API received exactly one request
        const sbomRequests = getSbomApiRequests();
        expect(sbomRequests).toHaveLength(1);

        const requestBody = sbomRequests[0].body;

        // THEN – the request body includes at least one resolved dep graph
        expect(Array.isArray(requestBody.depGraphs)).toBe(true);
        expect(requestBody.depGraphs.length).toBeGreaterThan(0);

        // THEN – the request body exposes scan errors for the broken project
        expect(Array.isArray(requestBody.scanErrors)).toBe(true);
        expect(requestBody.scanErrors.length).toBeGreaterThan(0);

        const scanError = requestBody.scanErrors[0];
        expect(scanError.text).toBeDefined();
        expect(scanError.text.length).toBeGreaterThan(0);
      },
    );

    test(
      'GIVEN a multi-project workspace where ALL npm projects are broken ' +
        'WHEN running sbom --format cyclonedx1.6+json --allow-incomplete-sbom --all-projects ' +
        'THEN exits 0, produces an SBOM with no components, ' +
        'and the SBOM API request body contains scanErrors for every failed project',
      async () => {
        // GIVEN
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-all-broken',
        );

        // WHEN
        const { code, stdout, stderr } = await runSnykCLI(
          'sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' +
            ' --format cyclonedx1.6+json' +
            ' --allow-incomplete-sbom' +
            ' --all-projects' +
            ' --debug',
          { cwd: project.path(), env },
        );

        if (code !== 0) {
          console.error('stderr:', stderr);
        }

        // THEN – CLI exits successfully (allow-incomplete swallows all errors)
        expect(code).toEqual(0);

        // THEN – stdout is a parseable CycloneDX 1.6 document
        let bom: any;
        expect(() => {
          bom = JSON.parse(stdout);
        }).not.toThrow();
        expect(bom.specVersion).toEqual('1.6');

        // THEN – no components were resolved (every project failed)
        expect(Array.isArray(bom.components)).toBe(true);
        expect(bom.components).toHaveLength(0);

        // THEN – the SBOM API received exactly one request
        const sbomRequests = getSbomApiRequests();
        expect(sbomRequests).toHaveLength(1);

        const requestBody = sbomRequests[0].body;

        // THEN – no dep graphs in the payload
        expect(Array.isArray(requestBody.depGraphs)).toBe(true);
        expect(requestBody.depGraphs).toHaveLength(0);

        // THEN – scan errors are present for each broken project
        expect(Array.isArray(requestBody.scanErrors)).toBe(true);
        expect(requestBody.scanErrors.length).toBeGreaterThanOrEqual(2);

        for (const scanError of requestBody.scanErrors) {
          expect(scanError.text).toBeDefined();
          expect(scanError.text.length).toBeGreaterThan(0);
        }
      },
    );
  });

  // ---------------------------------------------------------------------------
  // SPDX 2.3 + JSON
  // ---------------------------------------------------------------------------

  describe('--format spdx2.3+json', () => {
    test(
      'GIVEN a multi-project workspace with one broken npm project ' +
        'WHEN running sbom --format spdx2.3+json --allow-incomplete-sbom --all-projects ' +
        'THEN exits 0, produces a valid SPDX 2.3 SBOM from the healthy project, ' +
        'and the SBOM API request body contains scanErrors for the broken project',
      async () => {
        // GIVEN
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-partial-broken',
        );

        // WHEN
        const { code, stdout, stderr } = await runSnykCLI(
          'sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' +
            ' --format spdx2.3+json' +
            ' --allow-incomplete-sbom' +
            ' --all-projects' +
            ' --debug',
          { cwd: project.path(), env },
        );

        if (code !== 0) {
          console.error('stderr:', stderr);
        }

        // THEN – CLI exits successfully
        expect(code).toEqual(0);

        // THEN – stdout is a parseable SPDX 2.3 document
        let bom: any;
        expect(() => {
          bom = JSON.parse(stdout);
        }).not.toThrow();
        expect(bom.spdxVersion).toEqual('SPDX-2.3');

        // THEN – packages list is non-empty (resolved from the healthy project)
        expect(Array.isArray(bom.packages)).toBe(true);
        expect(bom.packages.length).toBeGreaterThan(0);

        // THEN – the SBOM API received exactly one request
        const sbomRequests = getSbomApiRequests();
        expect(sbomRequests).toHaveLength(1);

        const requestBody = sbomRequests[0].body;

        // THEN – the request body includes at least one resolved dep graph
        expect(Array.isArray(requestBody.depGraphs)).toBe(true);
        expect(requestBody.depGraphs.length).toBeGreaterThan(0);

        // THEN – the request body exposes scan errors for the broken project
        expect(Array.isArray(requestBody.scanErrors)).toBe(true);
        expect(requestBody.scanErrors.length).toBeGreaterThan(0);

        const scanError = requestBody.scanErrors[0];
        expect(scanError.text).toBeDefined();
        expect(scanError.text.length).toBeGreaterThan(0);
      },
    );

    test(
      'GIVEN a multi-project workspace where ALL npm projects are broken ' +
        'WHEN running sbom --format spdx2.3+json --allow-incomplete-sbom --all-projects ' +
        'THEN exits 0, produces an SBOM with no packages, ' +
        'and the SBOM API request body contains scanErrors for every failed project',
      async () => {
        // GIVEN
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-all-broken',
        );

        // WHEN
        const { code, stdout, stderr } = await runSnykCLI(
          'sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' +
            ' --format spdx2.3+json' +
            ' --allow-incomplete-sbom' +
            ' --all-projects' +
            ' --debug',
          { cwd: project.path(), env },
        );

        if (code !== 0) {
          console.error('stderr:', stderr);
        }

        // THEN – CLI exits successfully (allow-incomplete swallows all errors)
        expect(code).toEqual(0);

        // THEN – stdout is a parseable SPDX 2.3 document
        let bom: any;
        expect(() => {
          bom = JSON.parse(stdout);
        }).not.toThrow();
        expect(bom.spdxVersion).toEqual('SPDX-2.3');

        // THEN – no packages were resolved (every project failed)
        expect(Array.isArray(bom.packages)).toBe(true);
        expect(bom.packages).toHaveLength(0);

        // THEN – the SBOM API received exactly one request
        const sbomRequests = getSbomApiRequests();
        expect(sbomRequests).toHaveLength(1);

        const requestBody = sbomRequests[0].body;

        // THEN – no dep graphs in the payload
        expect(Array.isArray(requestBody.depGraphs)).toBe(true);
        expect(requestBody.depGraphs).toHaveLength(0);

        // THEN – scan errors are present for each broken project
        expect(Array.isArray(requestBody.scanErrors)).toBe(true);
        expect(requestBody.scanErrors.length).toBeGreaterThanOrEqual(2);

        for (const scanError of requestBody.scanErrors) {
          expect(scanError.text).toBeDefined();
          expect(scanError.text.length).toBeGreaterThan(0);
        }
      },
    );
  });
});
