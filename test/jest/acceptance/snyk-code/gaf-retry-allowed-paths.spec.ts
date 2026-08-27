// Verifies that GAF's network-retry middleware actually retries a transient failure on
// /feature_flags/evaluation -- one of the paths cliv2/pkg/core/configuration.go's
// defaultNetworkRequestRetryAllowedPaths() adds back to GAF's default retry-allowed-paths
// list. This endpoint is called directly by the Go binary (config_utils.AddFeatureFlagToConfig
// -> featureflaggateway.EvaluateFlags), with no TypeScript-level retry wrapper, so it cleanly
// isolates GAF's retry behavior from the CLI's own legacy retry loop.
import { runSnykCLI } from '../../util/runSnykCLI';
import { runCommand } from '../../util/runCommand';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';

jest.setTimeout(1000 * 60);

const ORG = '11111111-2222-3333-4444-555555555555';
const EVALUATION_PATH = `/api/hidden/orgs/${ORG}/feature_flags/evaluation`;

describe('GAF retry-allowed-paths: feature_flags/evaluation endpoint', () => {
  let server: ReturnType<typeof fakeServer>;
  let deepCodeServer: ReturnType<typeof fakeDeepCodeServer>;
  let baseEnv: Record<string, string>;
  const port = getServerPort(process);
  const baseApi = '/api/v1';

  beforeAll(async () => {
    deepCodeServer = fakeDeepCodeServer();
    await new Promise<void>((resolve) =>
      deepCodeServer.listen(() => resolve()),
    );
    server = fakeServer(baseApi, 'snykToken');
    await new Promise<void>((resolve) => server.listen(port, () => resolve()));

    baseEnv = {
      ...process.env,
      SNYK_API: `http://localhost:${port}${baseApi}`,
      SNYK_HOST: `http://localhost:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_CFG_ORG: ORG,
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'true',
      // Preview/dev builds force feature flags on locally, bypassing the remote
      // evaluation call entirely (cliv2/pkg/core/workflows.go) -- without this override
      // the endpoint under test is never even called, and every assertion below is vacuous.
      INTERNAL_PREVIEW_FEATURES_ENABLED: 'false',
    } as Record<string, string>;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => deepCodeServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function configureServers() {
    server.restore();
    deepCodeServer.restore();
    server.setOrgSetting('sast', true);
    server.setLocalCodeEngineConfiguration({
      enabled: true,
      allowCloudUpload: true,
      url: `http://localhost:${deepCodeServer.getPort()}`,
    });
    deepCodeServer.setFiltersResponse({ configFiles: [], extensions: ['.js'] });
    deepCodeServer.setSarifResponse({
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [],
    });
    server.setFeatureFlag('clientFileFilterGitignore_MetaCharFix', true);
  }

  /** A minimal repo to scan with snyk code test. */
  async function buildFixture(): Promise<string> {
    const root = fs.mkdtempSync(join(os.tmpdir(), 'snyk-retry-test-'));
    fs.writeFileSync(join(root, 'test.js'), 'const x = 0;\n');
    await runCommand('git', ['init'], { cwd: root });
    await runCommand('git', ['add', '.'], { cwd: root });
    return root;
  }

  /**
   * snyk code test naturally calls feature_flags/evaluation more than once (once per
   * file-filter config variant it evaluates), so a raw hit count can't distinguish a real
   * retry from that natural behavior. GAF's retry middleware reuses the same
   * Snyk-Request-Id across attempts of the *same* logical request (see the duplicate-id
   * check in resilience.spec.ts's "maintenance-window" scenario), so a duplicated id
   * among requests to this path is the reliable signal that a retry occurred.
   */
  function hasDuplicateRequestId(): boolean {
    const ids = server
      .getRequests()
      .filter((r) => (r.url as string).includes('feature_flags/evaluation'))
      .map((r) => {
        const header = r.headers?.['snyk-request-id'];
        return Array.isArray(header) ? header[0] : header;
      })
      .filter(Boolean);
    return new Set(ids).size < ids.length;
  }

  it('retries feature_flags/evaluation on a transient (500) failure when retries are enabled', async () => {
    configureServers();
    server.setEndpointStatusCodes(EVALUATION_PATH, [500, 200]);
    const root = await buildFixture();

    await runSnykCLI(`code test ${root}`, {
      env: {
        ...baseEnv,
        INTERNAL_NETWORK_REQUEST_RETRIES_ENABLED: '1',
        SNYK_MAX_ATTEMPTS: '3',
      },
    });

    expect(hasDuplicateRequestId()).toBe(true);
  });

  it('does not retry feature_flags/evaluation when retries are disabled', async () => {
    configureServers();
    server.setEndpointStatusCodes(EVALUATION_PATH, [500, 200]);
    const root = await buildFixture();

    await runSnykCLI(`code test ${root}`, {
      env: {
        ...baseEnv,
        INTERNAL_NETWORK_REQUEST_RETRIES_ENABLED: '0',
      },
    });

    expect(hasDuplicateRequestId()).toBe(false);
  });
});
