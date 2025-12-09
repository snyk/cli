import {
  createProjectFromFixture,
  createProjectFromWorkspace,
} from '../../../util/createProject';
import { runSnykCLI } from '../../../util/runSnykCLI';
import { fakeServer } from '../../../../acceptance/fake-server';
import { getServerPort } from '../../../util/getServerPort';
import { isWindowsOperatingSystem, testIf } from '../../../../utils';

jest.setTimeout(1000 * 60);

describe('snyk test --sarif', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
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

  test('`snyk test --sarif` includes the expected output', async () => {
    const project = await createProjectFromFixture(
      'npm/with-vulnerable-lodash-dep',
    );
    server.setCustomResponse(
      await project.readJSON('test-dep-graph-result.json'),
    );

    const { code, stdout } = await runSnykCLI('test --sarif', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(1);

    expect(stdout).toContain('"artifactsScanned": 1');
    expect(stdout).toContain('"cvssv3_baseScore": 5.3');
    expect(stdout).toContain('"security-severity": "5.3"');
    expect(stdout).toContain('"fullyQualifiedName": "lodash@4.17.15"');
    expect(stdout).toContain('Upgrade to lodash@4.17.17');
  });

  testIf(!isWindowsOperatingSystem())(
    '`snyk test --sarif --all-sub-projects` on gradle multi-project includes full file paths',
    async () => {
      const project = await createProjectFromWorkspace('gradle-subproject');
      server.setCustomResponse(
        await project.readJSON(
          'subproj/vulnerable-guava-dep-graph-result.json',
        ),
      );

      const { code, stdout } = await runSnykCLI('test --sarif --all-projects', {
        cwd: project.path(),
        env,
      });

      expect(code).toEqual(1);

      const sarifOutput = JSON.parse(stdout);

      const allArtifactUris = new Set<string>();
      sarifOutput.runs?.forEach((run) => {
        run.results?.forEach((result) => {
          result.locations?.forEach((location) => {
            const uri = location.physicalLocation?.artifactLocation?.uri;
            allArtifactUris.add(uri);
          });
        });
      });

      expect(allArtifactUris.size).toBe(2);
      expect(allArtifactUris).toContain('build.gradle');
      expect(allArtifactUris).toContain('subproj/build.gradle');
    },
  );
});
