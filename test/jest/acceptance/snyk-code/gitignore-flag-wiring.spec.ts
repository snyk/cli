// The fake server answers the batch flag evaluation endpoint, so the remote flag path is
// testable without real backend access.
import { runSnykCLI } from '../../util/runSnykCLI';
import { runCommand } from '../../util/runCommand';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';

jest.setTimeout(1000 * 120);

const REMOTE_FLAG_NAME = 'clientFileFilterGitignore_TrackedFilesRollout';
const FLAG_ENV = 'INTERNAL_SNYK_GITIGNORE_RESPECT_TRACKED_FILES_ENABLED';
const PREVIEW_ENV = 'INTERNAL_PREVIEW_FEATURES_ENABLED';
const EVALUATION_PATH = '/feature_flags/evaluation';

describe('snyk code test — tracked-file feature flag wiring', () => {
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
      SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'true',
      // Preview/dev builds force the flag on (cliv2/pkg/core/workflows.go), bypassing
      // the remote flag. Without this, every assertion below is vacuous.
      [PREVIEW_ENV]: 'false',
    } as Record<string, string>;
    // The local override must be absent, otherwise the remote flag is never consulted.
    delete baseEnv[FLAG_ENV];
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => deepCodeServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function configureServers(remoteFlagValue: boolean | undefined) {
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
    // Preview builds force this on too; enable it here so rule parsing matches
    // production rather than falling back to the legacy parser.
    server.setFeatureFlag('clientFileFilterGitignore_MetaCharFix', true);
    if (remoteFlagValue !== undefined) {
      server.setFeatureFlag(REMOTE_FLAG_NAME, remoteFlagValue);
    }
  }

  /** A repo where tracked.js is both git-tracked and matched by .gitignore. */
  async function buildFixture(): Promise<string> {
    const root = fs.mkdtempSync(join(os.tmpdir(), 'snyk-ff-'));
    fs.writeFileSync(join(root, 'control.js'), 'const c = 0;\n');
    fs.writeFileSync(join(root, 'tracked.js'), 'const a = 1;\n');
    fs.writeFileSync(join(root, '.gitignore'), 'tracked.js\n');
    await runCommand('git', ['init'], { cwd: root });
    await runCommand('git', ['add', '-f', 'tracked.js'], { cwd: root });
    return root;
  }

  function uploadedFiles(): string[] {
    const bundleRequest = deepCodeServer
      .getRequests()
      .find(
        (r) => r.method === 'POST' && (r.url as string).includes('/bundle'),
      );
    if (!bundleRequest) return [];
    const raw = Buffer.isBuffer(bundleRequest.body)
      ? Buffer.from(bundleRequest.body.toString('utf8'), 'base64').toString(
          'utf8',
        )
      : JSON.stringify(bundleRequest.body);
    return Object.keys(JSON.parse(raw)).sort();
  }

  /** The flags the CLI asked the backend to evaluate. */
  function evaluatedFlags(): string[] {
    return server
      .getRequests()
      .filter((r) => (r.url as string).includes(EVALUATION_PATH))
      .flatMap((r) => r.body?.data?.attributes?.flags ?? []);
  }

  async function scan(opts: {
    remoteFlag?: boolean;
    envOverride?: boolean;
    previewFeatures?: boolean;
  }): Promise<{ files: string[]; flags: string[]; code: number }> {
    configureServers(opts.remoteFlag);
    const root = await buildFixture();
    const env = { ...baseEnv };
    if (opts.envOverride !== undefined) {
      env[FLAG_ENV] = String(opts.envOverride);
    }
    if (opts.previewFeatures) {
      env[PREVIEW_ENV] = 'true';
    }
    const { code } = await runSnykCLI(`code test ${root}`, { env });
    return { files: uploadedFiles(), flags: evaluatedFlags(), code };
  }

  it('asks the backend to evaluate the tracked-files flag by its remote name', async () => {
    const { flags } = await scan({ remoteFlag: true });

    // A wrong mapping here would leave a dead rollout switch that no behaviour test
    // would catch.
    expect(flags).toContain(REMOTE_FLAG_NAME);
  });

  it('scans a tracked, gitignored file when the backend enables the flag', async () => {
    const { files } = await scan({ remoteFlag: true });

    expect(files).toEqual(['control.js', 'tracked.js']);
  });

  it('excludes a tracked, gitignored file when the backend disables the flag', async () => {
    const { files } = await scan({ remoteFlag: false });

    expect(files).toEqual(['control.js']);
  });

  it('defaults to the legacy behaviour when the backend does not know the flag', async () => {
    const { files } = await scan({});

    expect(files).toEqual(['control.js']);
  });

  it('a local override wins over the backend value', async () => {
    // Backend says on, local config says off.
    const off = await scan({ remoteFlag: true, envOverride: false });
    expect(off.files).toEqual(['control.js']);

    // Backend says off, local config says on.
    const on = await scan({ remoteFlag: false, envOverride: true });
    expect(on.files).toEqual(['control.js', 'tracked.js']);
  });

  describe('preview builds deliberately force the flag on', () => {
    // Intended behaviour. The consequence worth pinning: a preview binary cannot
    // validate the backend rollout switch.
    it('activates the feature even when the backend disables it', async () => {
      const { files } = await scan({
        remoteFlag: false,
        previewFeatures: true,
      });

      expect(files).toEqual(['control.js', 'tracked.js']);
    });

    it('does not even ask the backend to evaluate the flag', async () => {
      const { flags } = await scan({
        remoteFlag: false,
        previewFeatures: true,
      });

      expect(flags).not.toContain(REMOTE_FLAG_NAME);
    });

    it('still lets a local override turn the feature off', async () => {
      const { files, flags } = await scan({
        remoteFlag: true,
        previewFeatures: true,
        envOverride: false,
      });

      expect(files).toEqual(['control.js']);
      // An override short-circuits the default-value function, so setting the key by
      // hand cannot be used to test the remote flag either.
      expect(flags).not.toContain(REMOTE_FLAG_NAME);
    });
  });
});
