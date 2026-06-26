import { execFileSync } from 'child_process';

import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 60 * 5);

// `--include-component-metadata` makes the maven plugin read the install-time
// `.jar.sha1` companion files from the local Maven repository and surface them
// as `hash:<algorithm>` labels on the dep-graph nodes. The artifacts must
// therefore be resolved into the local repository first (via `mvn`), otherwise
// there are no companion files to read.
describe('`snyk test --include-component-metadata` (maven)', () => {
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

  afterAll(
    () =>
      new Promise((res) => {
        server.close(res);
      }),
  );

  const hashLabelKeys = (printGraphStdout: string): string[] => {
    const jsonDG = JSON.parse(
      printGraphStdout.split('DepGraph data:')[1].split('DepGraph target:')[0],
    );
    return jsonDG.graph.nodes
      .flatMap((node) => Object.keys(node.info?.labels ?? {}))
      .filter((key) => key.startsWith('hash:'));
  };

  // mvn is required to resolve artifacts into the local repository first.
  it('attaches `hash:<algorithm>` labels when artifacts are resolved', async () => {
    const project = await createProjectFromFixture('maven-print-graph');

    // Populate the local Maven repository so the `.jar.sha1` companion files
    // the plugin reads are present.
    execFileSync('mvn', ['dependency:resolve'], {
      cwd: project.path(),
      stdio: 'ignore',
      shell: isWindowsOperatingSystem(),
    });

    const { code, stdout } = await runSnykCLI(
      'test --include-component-metadata --print-graph',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toContain('DepGraph data:');
    expect(hashLabelKeys(stdout).length).toBeGreaterThan(0);
  });

  // Control: without the flag the same project must not produce hash labels,
  // proving the labels are driven by `--include-component-metadata`.
  it('does not attach hash labels without the flag', async () => {
    const project = await createProjectFromFixture('maven-print-graph');

    execFileSync('mvn', ['dependency:resolve'], {
      cwd: project.path(),
      stdio: 'ignore',
      shell: isWindowsOperatingSystem(),
    });

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('DepGraph data:');
    expect(hashLabelKeys(stdout)).toHaveLength(0);
  });
});
