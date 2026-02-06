import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { tmpdir } from 'os';

jest.setTimeout(1000 * 60);

describe('npm nested real package with top-level alias shadowing', () => {
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

  it('resolves nested real package when top-level alias shadows the same package name', async () => {
    // This test covers the scenario where:
    // - Root package.json has "@types/node": "npm:@types/web@^0.0.148" (aliased)
    // - A nested dependency (apache-arrow) depends on the real "@types/node": "^20.13.0"
    // - The lockfile has both: node_modules/@types/node (actually @types/web)
    //   and node_modules/apache-arrow/node_modules/@types/node (real @types/node)
    //
    // Previously this caused a false OutOfSyncError because the nested real
    // @types/node was incorrectly filtered out during ancestry matching.
    const project = await createProject(
      'npm-nested-non-alias-with-top-level-alias',
    );

    const { code, stdout } = await runSnykCLI(`test --print-graph --json`, {
      cwd: project.path(),
      env,
    });

    // The main test: no out-of-sync error should be thrown
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

    // Verify the nested real @types/node is present (the key fix)
    // This is the package that was incorrectly filtered out before the fix
    const realTypesNode = depGraph.pkgs?.find(
      (p: any) =>
        p.info?.name === '@types/node' && p.info?.version === '20.19.25',
    );
    expect(realTypesNode).toBeDefined();

    // Verify apache-arrow depends on the real @types/node
    const apacheArrow = depGraph.pkgs?.find(
      (p: any) => p.info?.name === 'apache-arrow',
    );
    expect(apacheArrow).toBeDefined();
    expect(apacheArrow?.info?.version).toBe('17.0.0');

    const apacheArrowNode = depGraph.graph?.nodes?.find(
      (n: any) => n.pkgId === apacheArrow?.id,
    );
    expect(apacheArrowNode).toBeDefined();

    // Check that apache-arrow has @types/node in its dependencies
    const typesNodeDep = apacheArrowNode?.deps?.find((d: any) =>
      d.nodeId.includes('@types/node'),
    );
    expect(typesNodeDep).toBeDefined();

    // Verify the mosaic-core dependency chain is intact
    const mosaicCore = depGraph.pkgs?.find(
      (p: any) => p.info?.name === '@uwdata/mosaic-core',
    );
    expect(mosaicCore).toBeDefined();
    expect(mosaicCore?.info?.version).toBe('0.20.1');
  });
});
