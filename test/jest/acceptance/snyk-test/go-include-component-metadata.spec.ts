import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

// `--include-component-metadata` makes the go plugin read the `h1:` module
// hash (via `go list`, falling back to go.sum on older toolchains) and derive
// a module-proxy distribution URL, surfacing them as `hash:sha-256` and
// `distribution:url` labels on the dep-graph nodes — matching snyk-mvn-plugin
// and snyk-nodejs-plugin. Unlike maven there is no separate resolve step: the
// go plugin's own `go list` invocation resolves the module as needed.
describe('`snyk test --include-component-metadata` (go modules)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    const fakeServerIp = getFirstIPv4Address();
    const defaultEnvVars = {
      SNYK_API: `http://${fakeServerIp}:${port}${baseApi}`,
      SNYK_HOST: `http://${fakeServerIp}:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    env = {
      ...process.env,
      ...defaultEnvVars,
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll(
    () =>
      new Promise((res) => {
        server.close(res);
      }),
  );

  const parseDepGraph = (printGraphStdout: string) =>
    JSON.parse(
      printGraphStdout.split('DepGraph data:')[1].split('DepGraph target:')[0],
    );

  const labelKeys = (printGraphStdout: string, prefix: string): string[] =>
    parseDepGraph(printGraphStdout)
      .graph.nodes.flatMap((node) => Object.keys(node.info?.labels ?? {}))
      .filter((key) => key.startsWith(prefix));

  const labelValues = (printGraphStdout: string, key: string): string[] =>
    parseDepGraph(printGraphStdout)
      .graph.nodes.map((node) => node.info?.labels?.[key])
      .filter(Boolean);

  it('attaches `hash:sha-256` and `distribution:url` labels with the flag', async () => {
    const project = await createProjectFromWorkspace(
      'go-include-component-metadata',
    );

    const { code, stdout } = await runSnykCLI(
      'test --include-component-metadata --print-graph',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toContain('DepGraph data:');
    expect(labelKeys(stdout, 'hash:').length).toBeGreaterThan(0);
    expect(labelKeys(stdout, 'distribution:url').length).toBeGreaterThan(0);
  });

  // Control: without the flag the same project must not produce the labels,
  // proving they are driven by `--include-component-metadata`.
  it('does not attach the labels without the flag', async () => {
    const project = await createProjectFromWorkspace(
      'go-include-component-metadata',
    );

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('DepGraph data:');
    expect(labelKeys(stdout, 'hash:')).toHaveLength(0);
    expect(labelKeys(stdout, 'distribution:url')).toHaveLength(0);
  });

  // Regression test for a credential leak: a private GOPROXY can carry
  // basic-auth credentials embedded in the url (e.g. https://user:pass@proxy/).
  // snyk-go-plugin must strip them before surfacing the proxy url as a
  // distribution:url label, otherwise they'd be shipped off-host with the
  // scan results. proxy.golang.org ignores the bogus Authorization header
  // this produces, so the module still resolves over the real network.
  // Fixed in snyk-go-plugin#149, released as 2.2.1.
  it('does not leak GOPROXY credentials into the distribution:url label', async () => {
    const project = await createProjectFromWorkspace(
      'go-include-component-metadata',
    );

    const { code, stdout } = await runSnykCLI(
      'test --include-component-metadata --print-graph',
      {
        cwd: project.path(),
        env: {
          ...env,
          GOPROXY: 'https://foo:bar@proxy.golang.org,direct',
        },
      },
    );

    expect(code).toEqual(0);
    const urls = labelValues(stdout, 'distribution:url');
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).not.toContain('foo:bar@');
      expect(url).not.toMatch(/:\/\/[^/]*@/);
    }
  });
});
