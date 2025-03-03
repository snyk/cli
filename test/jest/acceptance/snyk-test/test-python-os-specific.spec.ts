import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { runCommand } from '../../util/runCommand';
import { isDontSkipTestsEnabled } from '../../util/isDontSkipTestsEnabled';
import { getServerPort } from '../../util/getServerPort';
import * as os from 'os';
import * as fs from 'fs';

jest.setTimeout(1000 * 60);

const PLATFORM_FIXTURES_MAPS = {
  win32_amd64: 'pip-app-windows',
  darwin_arm64: 'pip-app-macos',
  linux_arm64: 'pip-app-linux-arm64',
  linux_amd64: 'pip-app-linux-amd64',
  alpine_arm64: 'pip-app-alpine-arm64',
};

function getCurrentPlatform(): string {
  const ALPINE_RELEASE_PATH = '/etc/alpine-release';
  const currentPlatform = os.platform() + '_' + os.arch();

  if (currentPlatform == 'linux_arm64') {
    if (fs.existsSync(ALPINE_RELEASE_PATH) || process.env.OSTYPE === 'alpine') {
      return 'alpine_arm64';
    }
  }

  return currentPlatform;
}

describe('`snyk test` of python projects with OS specific dependencies', () => {
  let server;
  let env: Record<string, string>;
  let dontSkip: boolean;

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
    dontSkip = isDontSkipTestsEnabled();
    console.debug("Don't skip tests: " + dontSkip);
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

  test('run `snyk test` on python project $fixture on the corresponding platform', async () => {
    const currentPlatform = getCurrentPlatform();

    if (!(currentPlatform in PLATFORM_FIXTURES_MAPS)) {
      return;
    }

    const fixture = PLATFORM_FIXTURES_MAPS[currentPlatform];

    const project = await createProjectFromWorkspace(fixture);
    let pythonCommand = 'python';

    await runCommand(pythonCommand, ['--version']).catch(function () {
      pythonCommand = 'python3';
    });

    console.debug('Using: ' + pythonCommand);
    let pipResult = await runCommand(
      pythonCommand,
      [
        '-m',
        'pip',
        'install',
        '-r',
        'requirements.txt',
        '--break-system-packages',
      ],
      {
        shell: true,
        cwd: project.path(),
      },
    );

    if (pipResult && pipResult.code != 0) {
      pipResult = await runCommand(
        pythonCommand,
        ['-m', 'pip', 'install', '-r', 'requirements.txt'],
        {
          shell: true,
          cwd: project.path(),
        },
      );
    }

    expect(pipResult.code).toEqual(0);

    const { code } = await runSnykCLI('test -d --command=' + pythonCommand, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });
});
