import { fakeServer } from '../../../acceptance/fake-server';
import { isWindowsOperatingSystem, testIf } from '../../../utils';
import { createProject } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

/**
 * Acceptance tests for `snyk sbom --allow-incomplete-sbom`.
 *
 * What the flag is supposed to do
 * ────────────────────────────────
 * When `--allow-incomplete-sbom` is passed, the CLI is expected to:
 *   1. Scan every detected project (npm, Maven, Gradle, …) without aborting
 *      on the first failure (`fail-fast=false`).
 *   2. Produce a single dep-graph payload that contains:
 *        - `depGraphs[]`   – every successfully resolved project
 *        - `scanErrors[]`  – one entry per project that failed to resolve
 *   3. Return exit code `0` even when some projects could not be resolved.
 *   4. Not prune the dep-graph (so transitive dependencies stay visible
 *      in the resulting SBOM, even if a sub-tree is repeated).
 *
 * The behaviour is identical for both supported SBOM formats:
 *   - cyclonedx1.6+json
 *   - spdx2.3+json
 *
 * These tests run the real CLI binary against a `fakeServer` that mocks the
 * `/sboms` endpoint. The fake server synthesises a CycloneDX/SPDX document
 * out of the dep-graph(s) it received, so we can verify both:
 *   - the wire payload that left the CLI (depGraphs / scanErrors)
 *   - the SBOM document the CLI ultimately handed back to the user (stdout)
 *
 * Fixture layout (`test/fixtures/sbom-allow-incomplete/`):
 *
 *   npm-multi-partial-broken/
 *     valid-project/    – npm project with debug@2.2.0 → ms@0.7.1 (transitive)
 *     broken-project/   – npm project with an unparseable package.json
 *
 *   npm-multi-all-broken/
 *     broken-project-a/ – unparseable package.json
 *     broken-project-b/ – unparseable package.json
 *
 *   maven-multi-partial-broken/
 *     valid-project/    – pom.xml with axis:axis:1.4 + transitive deps
 *     broken-project/   – malformed pom.xml
 *
 *   gradle-multi-partial-broken/
 *     valid-project/    – build.gradle with log4j-core:2.17.1 → log4j-api
 *     broken-project/   – invalid Groovy / build.gradle
 *
 *   multi-lang-partial-broken/
 *     npm-app/          – npm with debug → ms (transitive)
 *     maven-app/        – maven with axis 1.4 (transitive)
 *     gradle-app/       – gradle with log4j-core 2.17.1 (transitive)
 *     broken-app/       – broken package.json
 */

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

interface DepGraphRequest {
  pkgs: Array<{ id: string; info: { name: string; version?: string } }>;
  graph: { rootNodeId: string; nodes: Array<{ nodeId: string; pkgId: string }> };
  pkgManager?: { name?: string };
}

interface SbomPayload {
  depGraph?: DepGraphRequest;
  depGraphs?: DepGraphRequest[];
  subject?: { name: string };
  scanErrors?: Array<{ subject?: string; text: string }>;
  tools?: Array<{ name: string; vendor?: string; version?: string }>;
}

interface SbomRequest {
  method: string;
  path: string;
  body: SbomPayload;
}

interface CycloneDxBom {
  specVersion: string;
  $schema: string;
  components: Array<{ name: string; version?: string; purl?: string }>;
  metadata: { component: { name: string } };
}

interface SpdxBom {
  spdxVersion: string;
  name: string;
  packages: Array<{ name: string; version?: string }>;
  creators: unknown[];
}

type AnyBom = CycloneDxBom | SpdxBom;

// ──────────────────────────────────────────────────────────────────────────
// Test fixture helpers
// ──────────────────────────────────────────────────────────────────────────

const ORG = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function isCycloneDx(bom: AnyBom): bom is CycloneDxBom {
  return (bom as CycloneDxBom).specVersion !== undefined;
}

function logSbomSummary(bom: AnyBom, payload: SbomPayload): void {
  const summary = isCycloneDx(bom)
    ? {
        format: `CycloneDX ${bom.specVersion}`,
        rootName: bom.metadata?.component?.name,
        components: bom.components?.map((c) => c.name).sort(),
      }
    : {
        format: bom.spdxVersion,
        rootName: bom.name,
        components: bom.packages?.map((p) => p.name).sort(),
      };

  const wire = {
    depGraphCount: payload.depGraphs?.length ?? (payload.depGraph ? 1 : 0),
    scanErrorTexts: (payload.scanErrors ?? []).map((e) => ({
      subject: e.subject,
      // truncate noisy stack traces so the test log stays readable
      text: e.text.length > 200 ? `${e.text.slice(0, 200)}…` : e.text,
    })),
  };

  // eslint-disable-next-line no-console
  console.log('SBOM received:', JSON.stringify(summary, null, 2));
  // eslint-disable-next-line no-console
  console.log('Wire payload:', JSON.stringify(wire, null, 2));
}

// ──────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────

describe('snyk sbom --allow-incomplete-sbom (acceptance, mocked server)', () => {
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

  // ─── Helpers using the closure of the suite ──────────────────────────────

  const getSbomRequests = (): SbomRequest[] =>
    (server.getRequests() as unknown as SbomRequest[]).filter(
      (req) => req.method === 'POST' && req.path.includes('/sbom'),
    );

  const getSbomRequest = (): SbomRequest => {
    const requests = getSbomRequests();
    expect(requests).toHaveLength(1);
    return requests[0];
  };

  const runSbom = async (
    cwd: string,
    extraArgs: string,
  ): Promise<{ code: number; stdout: string; stderr: string }> => {
    return runSnykCLI(
      `sbom --org ${ORG} --debug ${extraArgs}`,
      { cwd, env },
    );
  };

  const parseSbom = (stdout: string): AnyBom => {
    let bom: AnyBom | undefined;
    expect(() => {
      bom = JSON.parse(stdout) as AnyBom;
    }).not.toThrow();
    if (!bom) {
      throw new Error('failed to parse SBOM from stdout');
    }
    return bom;
  };

  const componentNames = (bom: AnyBom): string[] =>
    isCycloneDx(bom)
      ? (bom.components ?? []).map((c) => c.name)
      : (bom.packages ?? []).map((p) => p.name);

  // ──────────────────────────────────────────────────────────────────────
  // 1. NPM – partial failure (transitive deps in SBOM, scanError on broken)
  // ──────────────────────────────────────────────────────────────────────

  const expectFormat = (bom: AnyBom, format: string): void => {
    if (format === 'cyclonedx1.6+json') {
      expect(isCycloneDx(bom)).toBe(true);
      expect((bom as CycloneDxBom).specVersion).toBe('1.6');
    } else {
      expect(isCycloneDx(bom)).toBe(false);
      expect((bom as SpdxBom).spdxVersion).toBe('SPDX-2.3');
    }
  };

  describe.each([
    { format: 'cyclonedx1.6+json' },
    { format: 'spdx2.3+json' },
  ] as const)('NPM workspace, --format $format', ({ format }) => {
    test(
      'GIVEN a multi-project NPM workspace with one broken project ' +
        'WHEN running `sbom --all-projects --allow-incomplete-sbom` ' +
        'THEN the CLI exits 0, the SBOM contains the transitive deps ' +
        'of the healthy project, and the wire payload has scanErrors ' +
        'for the broken project',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-partial-broken',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code, stdout, stderr } = await runSbom(
          project.path(),
          `--format ${format} --all-projects --allow-incomplete-sbom`,
        );
        if (code !== 0) {
          // eslint-disable-next-line no-console
          console.error('CLI stderr:', stderr);
        }

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).toBe(0);

        const bom = parseSbom(stdout);
        const { body: payload } = getSbomRequest();
        logSbomSummary(bom, payload);

        expectFormat(bom, format);

        // The SBOM exposes both the direct dep (`debug`) and the transitive
        // (`ms`) – this proves the dep-graph was *not* pruned.
        const names = componentNames(bom);
        expect(names).toEqual(expect.arrayContaining(['debug', 'ms']));

        // Wire payload: at least one resolved dep-graph and one scan error
        expect(payload.depGraphs ?? []).toHaveLength(1);
        const [graph] = payload.depGraphs ?? [];
        expect(graph.pkgs.map((p) => p.info.name)).toEqual(
          expect.arrayContaining(['debug', 'ms']),
        );

        expect(payload.scanErrors ?? []).toHaveLength(1);
        expect((payload.scanErrors ?? [])[0].text.length).toBeGreaterThan(0);
      },
    );

    test(
      'GIVEN a workspace where every NPM project is broken ' +
        'WHEN running `sbom --all-projects --allow-incomplete-sbom` ' +
        'THEN the CLI exits 0, the SBOM has zero components, ' +
        'and the wire payload has one scanError per broken project',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-all-broken',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code, stdout, stderr } = await runSbom(
          project.path(),
          `--format ${format} --all-projects --allow-incomplete-sbom`,
        );
        if (code !== 0) {
          // eslint-disable-next-line no-console
          console.error('CLI stderr:', stderr);
        }

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).toBe(0);

        const bom = parseSbom(stdout);
        const { body: payload } = getSbomRequest();
        logSbomSummary(bom, payload);

        expectFormat(bom, format);
        expect(componentNames(bom)).toHaveLength(0);

        expect(payload.depGraphs ?? []).toHaveLength(0);
        expect(payload.scanErrors ?? []).toHaveLength(2);
        for (const err of payload.scanErrors ?? []) {
          expect(err.text.length).toBeGreaterThan(0);
        }
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Maven – transitive deps survive in the SBOM (no pruning)
  // ──────────────────────────────────────────────────────────────────────

  describe('Maven workspace', () => {
    test(
      'GIVEN a multi-module workspace with one valid and one malformed pom.xml ' +
        'WHEN running `sbom --all-projects --allow-incomplete-sbom` ' +
        'THEN the CLI exits 0, the SBOM exposes the full transitive Maven graph, ' +
        'and the wire payload has a scanError for the malformed pom.xml',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        const project = await createProject(
          'sbom-allow-incomplete/maven-multi-partial-broken',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code, stdout, stderr } = await runSbom(
          project.path(),
          '--format cyclonedx1.6+json --all-projects --allow-incomplete-sbom',
        );
        if (code !== 0) {
          // eslint-disable-next-line no-console
          console.error('CLI stderr:', stderr);
        }

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).toBe(0);

        const bom = parseSbom(stdout) as CycloneDxBom;
        const { body: payload } = getSbomRequest();
        logSbomSummary(bom, payload);

        expect(bom.specVersion).toBe('1.6');

        // axis:axis:1.4 has well-known transitive deps; assert direct + at
        // least one transitive component is present in the SBOM.
        const names = componentNames(bom);
        expect(names).toEqual(
          expect.arrayContaining([
            'axis:axis',
            // commons-logging is a transitive of axis:axis through commons-discovery.
            'commons-logging:commons-logging',
          ]),
        );

        // Exactly one resolved Maven graph and one scan error from the
        // malformed pom.xml. The error's text must reference Maven so we
        // know the right plugin produced it.
        expect(payload.depGraphs ?? []).toHaveLength(1);
        expect(payload.scanErrors ?? []).toHaveLength(1);
        expect(
          (payload.scanErrors ?? [])[0].text.toLowerCase(),
        ).toMatch(/maven|pom/);
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. Gradle – transitive deps survive in the SBOM (no pruning)
  // ──────────────────────────────────────────────────────────────────────

  describe('Gradle workspace', () => {
    testIf(!isWindowsOperatingSystem())(
      'GIVEN a Gradle project with a broken sibling build.gradle ' +
        'WHEN running `sbom --all-projects --allow-incomplete-sbom` ' +
        'THEN the CLI exits 0, the SBOM exposes the full transitive Gradle graph, ' +
        'and the wire payload has a scanError for the broken build script',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        const project = await createProject(
          'sbom-allow-incomplete/gradle-multi-partial-broken',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code, stdout, stderr } = await runSbom(
          project.path(),
          '--format cyclonedx1.6+json --all-projects --allow-incomplete-sbom',
        );
        if (code !== 0) {
          // eslint-disable-next-line no-console
          console.error('CLI stderr:', stderr);
        }

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).toBe(0);

        const bom = parseSbom(stdout) as CycloneDxBom;
        const { body: payload } = getSbomRequest();
        logSbomSummary(bom, payload);

        // log4j-core has a known transitive dep on log4j-api – both must
        // be present, proving the dep-graph was not pruned.
        const names = componentNames(bom);
        expect(names).toEqual(
          expect.arrayContaining([
            'org.apache.logging.log4j:log4j-core',
            'org.apache.logging.log4j:log4j-api',
          ]),
        );

        expect(payload.depGraphs?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect((payload.scanErrors ?? []).length).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Multi-language workspace (NPM + Maven + Gradle + broken NPM)
  // ──────────────────────────────────────────────────────────────────────

  describe('multi-language workspace', () => {
    testIf(!isWindowsOperatingSystem())(
      'GIVEN a workspace mixing healthy NPM, Maven and Gradle projects with one broken NPM project ' +
        'WHEN running `sbom --all-projects --allow-incomplete-sbom` ' +
        'THEN the CLI exits 0, the SBOM contains the transitive deps from all three ecosystems, ' +
        'and the wire payload contains exactly three depGraphs and one scanError',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        const project = await createProject(
          'sbom-allow-incomplete/multi-lang-partial-broken',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code, stdout, stderr } = await runSbom(
          project.path(),
          '--format cyclonedx1.6+json --all-projects --allow-incomplete-sbom',
        );
        if (code !== 0) {
          // eslint-disable-next-line no-console
          console.error('CLI stderr:', stderr);
        }

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).toBe(0);

        const bom = parseSbom(stdout) as CycloneDxBom;
        const { body: payload } = getSbomRequest();
        logSbomSummary(bom, payload);

        const names = componentNames(bom);

        // NPM transitive
        expect(names).toEqual(expect.arrayContaining(['debug', 'ms']));
        // Maven transitive
        expect(names).toEqual(
          expect.arrayContaining([
            'axis:axis',
            'commons-logging:commons-logging',
          ]),
        );
        // Gradle transitive
        expect(names).toEqual(
          expect.arrayContaining([
            'org.apache.logging.log4j:log4j-core',
            'org.apache.logging.log4j:log4j-api',
          ]),
        );

        // Three healthy graphs (npm, maven, gradle) and exactly one error
        expect(payload.depGraphs ?? []).toHaveLength(3);
        expect(payload.scanErrors ?? []).toHaveLength(1);

        // Sanity: every healthy graph identifies its package manager so
        // we know each ecosystem actually contributed a graph.
        const pkgManagers = (payload.depGraphs ?? [])
          .map((g) => g.pkgManager?.name)
          .filter((n): n is string => !!n)
          .sort();
        expect(pkgManagers).toEqual(
          expect.arrayContaining(['gradle', 'maven', 'npm']),
        );
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Backward compatibility (without --allow-incomplete-sbom)
  // ──────────────────────────────────────────────────────────────────────

  describe('backward compatibility (flag absent / off)', () => {
    test(
      'GIVEN a multi-project NPM workspace with one broken project ' +
        'WHEN running `sbom --all-projects` WITHOUT --allow-incomplete-sbom ' +
        'THEN the CLI fails with a non-zero exit code (legacy fail-fast behaviour)',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-partial-broken',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code } = await runSbom(
          project.path(),
          '--format cyclonedx1.6+json --all-projects',
        );

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).not.toBe(0);

        expect(getSbomRequests()).toHaveLength(0);
      },
    );

    test(
      'GIVEN a healthy single NPM project ' +
        'WHEN running `sbom` WITHOUT --allow-incomplete-sbom ' +
        'THEN the wire payload has neither depGraphs[] nor scanErrors[] ' +
        'and the SBOM is generated as before the feature was introduced',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-partial-broken',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code, stdout, stderr } = await runSnykCLI(
          `sbom --org ${ORG} --format cyclonedx1.6+json --debug --file=valid-project/package.json`,
          { cwd: project.path(), env },
        );
        if (code !== 0) {
          // eslint-disable-next-line no-console
          console.error('CLI stderr:', stderr);
        }

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).toBe(0);

        const bom = parseSbom(stdout) as CycloneDxBom;
        const { body: payload } = getSbomRequest();
        logSbomSummary(bom, payload);

        expect(bom.specVersion).toBe('1.6');
        expect(componentNames(bom)).toEqual(
          expect.arrayContaining(['debug', 'ms']),
        );

        // Single-project payload uses `depGraph` (singular) – the multi
        // shape (`depGraphs[]` + `scanErrors[]`) must not appear, which
        // would otherwise be a breaking change for the SBOM service.
        expect(payload.depGraph).toBeDefined();
        expect(payload.depGraphs).toBeUndefined();
        expect(payload.scanErrors).toBeUndefined();
      },
    );

    test(
      'GIVEN a healthy multi-project NPM workspace ' +
        'WHEN running `sbom --all-projects --allow-incomplete-sbom` ' +
        'THEN the wire payload contains every depGraph but NO scanErrors entry, ' +
        'so older SBOM consumers see exactly the same shape they used to receive',
      async () => {
        // ── GIVEN ────────────────────────────────────────────────────────
        // We deliberately point the CLI at the valid-project sub-folder so
        // every detected manifest resolves successfully.
        const project = await createProject(
          'sbom-allow-incomplete/npm-multi-partial-broken/valid-project',
        );

        // ── WHEN ─────────────────────────────────────────────────────────
        const { code, stdout, stderr } = await runSbom(
          project.path(),
          '--format cyclonedx1.6+json --all-projects --allow-incomplete-sbom',
        );
        if (code !== 0) {
          // eslint-disable-next-line no-console
          console.error('CLI stderr:', stderr);
        }

        // ── THEN ─────────────────────────────────────────────────────────
        expect(code).toBe(0);

        const bom = parseSbom(stdout) as CycloneDxBom;
        const { body: payload } = getSbomRequest();
        logSbomSummary(bom, payload);

        expect(bom.specVersion).toBe('1.6');
        expect(componentNames(bom)).toEqual(
          expect.arrayContaining(['debug', 'ms']),
        );

        // depGraphs is non-empty, scanErrors is omitted entirely –
        // identical wire-shape to a clean run before CSENG-175.
        expect(payload.depGraphs?.length ?? 0).toBeGreaterThan(0);
        expect(payload.scanErrors).toBeUndefined();
      },
    );
  });
});
