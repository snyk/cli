import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { tmpdir } from 'os';

jest.setTimeout(1000 * 60);

describe('npm aliased packages with nested dependencies', () => {
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

  it('test aliased packages with nested dependencies', async () => {
    const project = await createProject('npm-alias-nested-deps');

    const { code, stdout } = await runSnykCLI(`test --print-graph --json`, {
      cwd: project.path(),
      env,
    });

    // The main test: no out-of-sync error should be thrown
    // when parsing npm lockfiles with aliased packages that have nested dependencies
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

    // Verify the aliased package is present
    const aliasedPkg = depGraph.pkgs?.find(
      (p: any) => p.info?.name === '@example/component-lib',
    );
    expect(aliasedPkg).toBeDefined();
    expect(aliasedPkg?.info?.version).toBe('3.0.0');

    // Verify the nested dependency is also present
    const nestedDep = depGraph.pkgs?.find(
      (p: any) => p.info?.name === '@types/helper-lib',
    );
    expect(nestedDep).toBeDefined();
    expect(nestedDep?.info?.version).toBe('1.2.3');

    // Verify the dependency relationship is correctly established
    const aliasedNode = depGraph.graph?.nodes?.find(
      (n: any) => n.pkgId === aliasedPkg?.id,
    );
    expect(aliasedNode).toBeDefined();
    expect(aliasedNode?.deps?.length).toBeGreaterThan(0);

    // Check for the nested dependency in the aliased package's dependencies
    const nestedDepInAliased = aliasedNode?.deps?.find((d: any) =>
      d.nodeId.includes('@types/helper-lib'),
    );
    expect(nestedDepInAliased).toBeDefined();
  });
});
