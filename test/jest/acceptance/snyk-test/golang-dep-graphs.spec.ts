import type { DepGraphData } from '@snyk/dep-graph';

import { fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import { createProjectFromWorkspace } from '../../util/createProject';

jest.setTimeout(1000 * 60);

describe('gomodules dep-graphs', () => {
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
    server.setFeatureFlag('disableGoPackageUrlsInCli', false);
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

  it('identifies replaced modules', async () => {
    const project = await createProjectFromWorkspace(
      'golang-gomodules-many-deps',
    );
    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toBeDefined();

    const depGraphJSON = stdout
      .split('DepGraph data:')[1]
      ?.split('DepGraph target:')[0];
    expect(depGraphJSON).toBeDefined();
    const depGraph: DepGraphData = JSON.parse(depGraphJSON);

    const retryablehttpPkg = depGraph.pkgs.find(({ id }) =>
      id.includes('go-retryablehttp'),
    );
    expect(retryablehttpPkg).toBeDefined();
    expect(retryablehttpPkg!.info).toMatchObject({
      name: 'github.com/wiz-sec/go-retryablehttp',
      purl: 'pkg:golang/github.com/wiz-sec/go-retryablehttp@v0.7.8-wiz-1',
      version: '0.7.8-wiz-1',
    });
  });
});
