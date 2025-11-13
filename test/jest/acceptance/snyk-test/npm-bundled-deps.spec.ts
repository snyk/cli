import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { tmpdir } from 'os';

jest.setTimeout(1000 * 60);

describe('npm bundled dependencies', () => {
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

  it('test npm package with bundled dependencies', async () => {
    const project = await createProject('npm-package-with-bundled-deps');

    const { code, stdout } = await runSnykCLI(`test --print-graph --json`, {
      cwd: project.path(),
      env,
    });

    // The main test: no out-of-sync error should be thrown
    // even though bundled dependencies don't have separate entries in package-lock.json
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

    // Verify the WASM package with bundled dependencies is in the dependency graph
    const wasmPkg = depGraph.pkgs?.find(
      (p: any) => p.info?.name === '@tailwindcss/oxide-wasm32-wasi',
    );
    expect(wasmPkg).toBeDefined();
    expect(wasmPkg?.info?.version).toBe('4.1.11');

    // Verify bundled dependencies are in the graph as children
    const wasmNode = depGraph.graph?.nodes?.find(
      (n: any) => n.pkgId === wasmPkg?.id,
    );
    expect(wasmNode).toBeDefined();
    expect(wasmNode?.deps?.length).toBeGreaterThan(0);

    // Check for one of the bundled dependencies (@emnapi/core)
    const emnapiCoreDep = wasmNode?.deps?.find((d: any) =>
      d.nodeId.includes('@emnapi/core'),
    );
    expect(emnapiCoreDep).toBeDefined();
  });
});
