import * as path from 'path';
import { fakeServer, FakeServer } from '../../../test/acceptance/fake-server';
import {
  createProjectFromWorkspace,
  TestProject,
} from '../../../test/jest/util/createProject';
import {
  startCommand,
  TestCLI,
  startSnykCLI,
} from '../../../test/jest/util/startSnykCLI';
import { isCLIV2 } from '../../../test/jest/util/isCLIV2';
import { unlink } from 'fs';

jest.setTimeout(1000 * 60);

// Global test configuration
const dockerComposeFile = path.resolve(
  path.join(__dirname, '..', 'fixtures', 'kerberos', 'docker-compose.yml'),
);
const scriptsPath = path.resolve(
  path.join(__dirname, '..', 'fixtures', 'kerberos', 'scripts'),
);
const containerName = 'proxy_authentication_container';
const hostnameFakeServer = 'host.docker.internal';
const hostnameProxy = 'proxy.snyk.local';
const proxyPort = '3128';
const port = process.env.PORT || process.env.SNYK_PORT || '12345';
const baseApi = '/api/v1';
const SNYK_API = 'http://' + hostnameFakeServer + ':' + port + baseApi;
const HTTP_PROXY = 'http://localhost:' + proxyPort;
const KRB5_CACHE_FILE = 'krb5_cache';
const KRB5_CONFIG_FILE = 'krb5.conf';

function getDockerOptions() {
  const dockerOptions = {
    env: {
      ...process.env,
      HTTP_PROXY_PORT: proxyPort,
      PROXY_HOSTNAME: hostnameProxy,
      SNYK_API: SNYK_API,
      CONTAINER_NAME: containerName,
      SCRIPTS_PATH: scriptsPath,
    },
  };
  return dockerOptions;
}

async function isDockerAvailable(): Promise<boolean> {
  let result = false;

  try {
    const process = await startCommand('docker', ['--version']);
    const errorCode = process.wait({ timeout: 30_000 });
    if ((await errorCode).valueOf() == 0) {
      result = true;
    }
  } catch {
    result = false;
  }

  return result;
}

async function startProxyEnvironment(): Promise<void> {
  // Stop any orphaned containers from previous runs.
  await stopProxyEnvironment();

  const dockerUp = await startCommand(
    'docker-compose',
    ['--file', dockerComposeFile, 'up', '--build'],
    getDockerOptions(),
  );
  await expect(dockerUp).toDisplay('Kerberos setup complete.', {
    timeout: 60_000,
  });
}

async function stopProxyEnvironment(): Promise<void> {
  const dockerDown = await startCommand(
    'docker-compose',
    ['--file', dockerComposeFile, 'down'],
    getDockerOptions(),
  );
  await expect(dockerDown).toExitWith(0, { timeout: 30_000 });
}

async function getProxyAccessLog(): Promise<string> {
  const check = await startCommand('docker', [
    'exec',
    containerName,
    'cat',
    '/var/log/squid/access.log',
  ]);
  await expect(check).toExitWith(0);
  return check.stdout.get();
}

async function runCliWithProxy(
  env: Record<string, string>,
  args: string[] = [],
  cmd = 'test',
): Promise<TestCLI> {
  let temp: string[] = [cmd, '--debug'];
  temp = temp.concat(args);
  const cli = await startSnykCLI(temp.join(' '), {
    env: {
      ...env,
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      KRB5CCNAME: 'FILE:' + path.join(scriptsPath, KRB5_CACHE_FILE),
      KRB5_CONFIG: path.join(scriptsPath, KRB5_CONFIG_FILE),
    },
  });
  return cli;
}

describe('Proxy Authentication', () => {
  if (!isCLIV2() || !process.env.TEST_SNYK_COMMAND?.includes('linux')) {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('These tests are currently limited to cover linux builds of CLIv2.', () => {
      console.warn(
        'Skipping test. These tests covering CLIv2 only features on linux and mac.',
      );
    });
  } else {
    let server: FakeServer;
    let env: Record<string, string>;
    let project: TestProject;
    let hasDockerInstalled: boolean;

    beforeAll(async () => {
      hasDockerInstalled = (await isDockerAvailable()).valueOf();
      if (false == hasDockerInstalled) {
        console.warn('These tests require Docker to be installed!');
      }
      expect(hasDockerInstalled).toBe(true);

      project = await createProjectFromWorkspace('npm-package');
      await startProxyEnvironment();

      env = {
        ...process.env,
        SNYK_API: SNYK_API,
        SNYK_TOKEN: '123456789',
        HTTP_PROXY: HTTP_PROXY,
        HTTPS_PROXY: HTTP_PROXY,
      };
      server = fakeServer(baseApi, env.SNYK_TOKEN);
      await server.listenPromise(port);
    });

    afterEach(() => {
      if (hasDockerInstalled) {
        server.restore();
      }
    });

    afterAll(async () => {
      if (hasDockerInstalled) {
        await server.closePromise();
        await stopProxyEnvironment();
        unlink(path.join(scriptsPath, KRB5_CACHE_FILE), () => {});
        unlink(path.join(scriptsPath, KRB5_CONFIG_FILE), () => {});
      }
    });

    it('fails to run snyk test due to missing --proxy-negotiate', async () => {
      const logOnEntry = await getProxyAccessLog();

      // run snyk test
      const args: string[] = [project.path()];
      const cli = await runCliWithProxy(env, args);
      await expect(cli).toExitWith(2);

      const logOnExit = await getProxyAccessLog();
      const additionalLogEntries = logOnExit.substring(logOnEntry.length);
      expect(additionalLogEntries.includes('TCP_DENIED/407')).toBeTruthy();
      expect(
        additionalLogEntries.includes(
          'CONNECT ' + hostnameFakeServer + ':' + port,
        ),
      ).toBeFalsy();
    });

    it('successfully runs snyk test', async () => {
      const logOnEntry = await getProxyAccessLog();

      // run snyk test
      const args: string[] = ['--proxy-negotiate', project.path()];
      const cli = await runCliWithProxy(env, args);
      await expect(cli).toExitWith(0);

      const logOnExit = await getProxyAccessLog();
      const additionalLogEntries = logOnExit.substring(logOnEntry.length);
      expect(additionalLogEntries.includes('TCP_TUNNEL/200')).toBeTruthy();
      expect(
        additionalLogEntries.includes(
          'CONNECT ' + hostnameFakeServer + ':' + port,
        ),
      ).toBeTruthy();
    });
  }
});
