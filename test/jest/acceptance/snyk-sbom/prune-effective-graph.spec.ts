import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

// When `snyk sbom -p` runs and the `sbom-prune-effective-graph` feature flag is
// enabled, the dep-graph extension must request the effective (pruned) graph from
// the legacy CLI (`--print-effective-graph`) instead of the default `--print-graph`.
// The legacy argv is only observable end-to-end here (the decision is compiled in
// from cli-extension-sbom + cli-extension-dep-graph), and it is logged to stderr
// under `--debug`.
describe('snyk sbom --prune-repeated-subdependencies effective-graph feature flag', () => {
  let server;
  let env: Record<string, string>;

  const orgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const runArgs = `sbom --org ${orgId} --format=cyclonedx1.6+json -p --debug`;

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

  test('with the feature flag ON, requests the effective (pruned) graph', async () => {
    server.setFeatureFlag('sbom-prune-effective-graph', true);
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stderr } = await runSnykCLI(runArgs, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stderr).toContain('--print-effective-graph');
    // `--print-effective-graph` does not contain the substring `--print-graph`.
    expect(stderr).not.toContain('--print-graph');
  });

  test('with the feature flag OFF, keeps the default (unpruned) graph', async () => {
    server.setFeatureFlag('sbom-prune-effective-graph', false);
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stderr } = await runSnykCLI(runArgs, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stderr).toContain('--print-graph');
    expect(stderr).not.toContain('--print-effective-graph');
  });
});
