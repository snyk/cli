import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { tmpdir } from 'os';

jest.setTimeout(1000 * 60);

describe('npm optional dependencies without separate package entries', () => {
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

  it('test optional dependencies without separate package entries', async () => {
    const project = await createProject('npm-optional-deps-missing-entries');

    const { code, stdout } = await runSnykCLI(`test --print-graph --json`, {
      cwd: project.path(),
      env,
    });

    // The main test: no out-of-sync error should be thrown
    // even though optional dependencies don't have separate entries in package-lock.json
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

    // Verify the optional dependency is handled correctly
    // The parser should create terminus nodes with missingLockFileEntry: true
    // instead of throwing OutOfSyncError
    const hasOptionalDep = depGraph.pkgs?.some(
      (p: any) => p.info?.name === '@parcel/watcher-darwin-x64',
    );
    expect(hasOptionalDep).toBe(true);

    // The key test is that no error was thrown and the graph was created successfully
    // The optional dependency may or may not be present depending on the parser's handling
    expect(depGraph.graph?.nodes?.length).toBeGreaterThan(0);
  });
});
