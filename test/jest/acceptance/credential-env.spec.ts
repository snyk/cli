import * as fs from 'fs';
import * as path from 'path';
import { fakeServer } from '../../acceptance/fake-server';
import {
  createProject,
  createProjectFromWorkspace,
  TestProject,
} from '../util/createProject';
import { getServerPort } from '../util/getServerPort';
import { runSnykCLI } from '../util/runSnykCLI';
import { isWindowsOperatingSystem, testIf } from '../../utils';

jest.setTimeout(1000 * 60);

// Build tools run code from the scanned project. A malicious gradlew stands
// in for that code here and records the token it was given, if any.
const maliciousGradlew = `#!/bin/sh
echo "SNYK_TOKEN=$SNYK_TOKEN SNYK_CFG_API=$SNYK_CFG_API" > "$(dirname "$0")/leaked-env.txt"
exit 1
`;

describe('credentials in child process environments', () => {
  const port = getServerPort(process);
  const baseApi = '/api/v1';
  const token = 'credential-env-test-token';
  let server: ReturnType<typeof fakeServer>;
  let project: TestProject;
  let env: Record<string, string | undefined>;

  beforeAll((done) => {
    server = fakeServer(baseApi, token);
    server.listen(port, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    project = await createProject('gradle-configurations');
    fs.writeFileSync(project.path('gradlew'), maliciousGradlew, {
      mode: 0o755,
    });
    env = {
      ...process.env,
      SNYK_API: `http://localhost:${port}${baseApi}`,
      SNYK_HOST: `http://localhost:${port}`,
      SNYK_DISABLE_ANALYTICS: '1',
    };
    delete env.SNYK_TOKEN;
  });

  afterEach(async () => {
    server.restore();
    await project.remove();
  });

  const leakedEnv = () =>
    fs.readFileSync(path.join(project.path(), 'leaked-env.txt'), 'utf-8');

  testIf(!isWindowsOperatingSystem())(
    'does not pass SNYK_TOKEN to build tools',
    async () => {
      await runSnykCLI('test', {
        cwd: project.path(),
        env: { ...env, SNYK_TOKEN: token },
      });

      expect(leakedEnv()).not.toContain(token);
    },
  );

  testIf(!isWindowsOperatingSystem())(
    'does not pass a token from the config file to build tools',
    async () => {
      await runSnykCLI('test', {
        cwd: project.path(),
        env: { ...env, SNYK_CFG_API: token },
      });

      expect(leakedEnv()).not.toContain(token);
    },
  );

  it('removes the token from its own environment but still authenticates', async () => {
    const { stdout } = await runSnykCLI(
      'woof --language=cat --env=SNYK_TOKEN',
      {
        env: { ...env, SNYK_TOKEN: token },
      },
    );
    expect(stdout).toContain('SNYK_TOKEN=undefined');

    const npmProject = await createProjectFromWorkspace('npm-package');
    try {
      const { code } = await runSnykCLI('monitor', {
        cwd: npmProject.path(),
        env: { ...env, SNYK_TOKEN: token },
      });
      expect(code).toEqual(0);
      expect(
        server.getRequests().map((r) => r.headers.authorization),
      ).toContain(`token ${token}`);
    } finally {
      await npmProject.remove();
    }
  });
});
