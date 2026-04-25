import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { tmpdir } from 'os';

jest.setTimeout(1000 * 60);

describe('npm bundled dependencies with non-hoisted bundle owner', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeEach(() => {
    process.env.SNYK_ERR_FILE = tmpdir() + '/tmp_err_file.txt';
  });

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      DEBUG: 'snyk*',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('test bundled dependencies with non-hoisted bundle owner', async () => {
    const project = await createProject('npm-bundled-non-hoisted');

    const { code, stdout } = await runSnykCLI(`test --print-graph --json`, {
      cwd: project.path(),
      env,
    });

    // The main test: no out-of-sync error should be thrown
    // when parsing npm lockfiles with bundled dependencies where the bundle owner is not hoisted
    expect(code).toEqual(0);

    // Extract the DepGraph JSON from the output
    const lines = stdout.split('\n');
    const jsonStartIndex = lines.findIndex((line) =>
      line.includes('DepGraph data:'),
    );
    const jsonLines: string[] = [];
    for (let i = jsonStartIndex + 1; i < lines.length; i++) {
      if (
        lines[i].startsWith('DepGraph') ||
        lines[i].startsWith('Testing') ||
        lines[i].trim() === ''
      ) {
        break;
      }
      jsonLines.push(lines[i]);
    }
    const depGraph = JSON.parse(jsonLines.join('\n'));

    // Verify the dependency graph is valid
    expect(depGraph.pkgManager?.name).toBe('npm');
    expect(depGraph.pkgs?.length).toBeGreaterThan(0);

    // Verify the bundle owner is present
    const bundleOwner = depGraph.pkgs?.find(
      (p: any) => p.info?.name === 'builder-tool',
    );
    expect(bundleOwner).toBeDefined();
    expect(bundleOwner?.info?.version).toBe('2.0.0');

    // Verify the bundled dependencies are present
    const bundledDep1 = depGraph.pkgs?.find(
      (p: any) => p.info?.name === 'semver',
    );
    expect(bundledDep1).toBeDefined();
    expect(bundledDep1?.info?.version).toBe('7.5.4');

    const bundledDep2 = depGraph.pkgs?.find(
      (p: any) => p.info?.name === 'chalk',
    );
    expect(bundledDep2).toBeDefined();
    expect(bundledDep2?.info?.version).toBe('4.1.2');

    // Verify the dependency relationship is correctly established
    const bundleOwnerNode = depGraph.graph?.nodes?.find(
      (n: any) => n.pkgId === bundleOwner?.id,
    );
    expect(bundleOwnerNode).toBeDefined();
    expect(bundleOwnerNode?.deps?.length).toBeGreaterThan(0);

    // Check for the bundled dependencies in the bundle owner's dependencies
    const bundledDepInOwner1 = bundleOwnerNode?.deps?.find((d: any) =>
      d.nodeId.includes('semver'),
    );
    expect(bundledDepInOwner1).toBeDefined();

    const bundledDepInOwner2 = bundleOwnerNode?.deps?.find((d: any) =>
      d.nodeId.includes('chalk'),
    );
    expect(bundledDepInOwner2).toBeDefined();
  });
});
