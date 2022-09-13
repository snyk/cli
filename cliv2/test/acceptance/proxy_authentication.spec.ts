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
import { execSync } from 'child_process';
import * as os from 'os';

jest.setTimeout(1000 * 60);

// Global test configuration
const rootDir = path.resolve(path.join(__dirname, '..', '..'));
const squidEnvironmentPath = path.resolve(
  path.join(rootDir, 'test', 'fixtures', 'squid_environment'),
);
const dockerComposeFile = path.resolve(
  path.join(squidEnvironmentPath, 'docker-compose.yml'),
);
const scriptsPath = path.resolve(path.join(squidEnvironmentPath, 'scripts'));
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

function isDockerAvailable(): boolean {
  let result = false;

  try {
    execSync('docker --version');
    execSync('docker-compose --version');
    result = true;
  } catch (error) {
    result = false;
    console.debug(error);
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

  if (env['KRB5CCNAME'] == undefined) {
    env['KRB5CCNAME'] = 'FILE:' + path.join(scriptsPath, KRB5_CACHE_FILE);
    env['KRB5_CONFIG'] = path.join(scriptsPath, KRB5_CONFIG_FILE);
  }

  const cli = await startSnykCLI(temp.join(' '), {
    env: {
      ...env,
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    },
  });
  return cli;
}

function canTestRun(): boolean {
  if (!isCLIV2() || !isDockerAvailable()) {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('These tests are currently limited to certain environments.', () => {
      console.warn(
        'Skipping CLIv2 test. These tests are limited to environments that have docker and docker-compose installed.',
      );
    });
    return false;
  }
  return true;
}

describe('Proxy Authentication (all platforms)', () => {
  if (canTestRun()) {
    let server: FakeServer;
    let env: Record<string, string>;
    let project: TestProject;

    beforeAll(async () => {
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
      server.restore();
    });

    afterAll(async () => {
      await server.closePromise();
      await stopProxyEnvironment();
      unlink(path.join(scriptsPath, KRB5_CACHE_FILE), () => {});
      unlink(path.join(scriptsPath, KRB5_CONFIG_FILE), () => {});
    });

    it('fails to run snyk test due to disabled proxy authentication', async () => {
      const logOnEntry = await getProxyAccessLog();

      // run snyk test
      const args: string[] = ['--proxy-noauth', project.path()];
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

    it('successfully runs snyk test with proxy', async () => {
      const logOnEntry = await getProxyAccessLog();

      // run snyk test
      const args: string[] = [project.path()];
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

describe('Proxy Authentication (Non-Windows)', () => {
  if (canTestRun() && !os.platform().includes('win32')) {
    let server: FakeServer;
    let env: Record<string, string>;
    let project: TestProject;

    beforeAll(async () => {
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
      server.restore();
    });

    afterAll(async () => {
      await server.closePromise();
      await stopProxyEnvironment();
      unlink(path.join(scriptsPath, KRB5_CACHE_FILE), () => {});
      unlink(path.join(scriptsPath, KRB5_CONFIG_FILE), () => {});
    });

    it('fail to run snyk test with proxy due to incorrect cache configuration', async () => {
      const logOnEntry = await getProxyAccessLog();

      // run snyk test
      const args: string[] = [project.path()];
      env['KRB5CCNAME'] = 'MEMORY:' + path.join(scriptsPath, KRB5_CACHE_FILE); // specifying incorrect cache type memory
      env['KRB5_CONFIG'] = path.join(scriptsPath, KRB5_CONFIG_FILE);
      const cli = await runCliWithProxy(env, args);
      await expect(cli).toExitWith(2);

      const logOnExit = await getProxyAccessLog();
      const additionalLogEntries = logOnExit.substring(logOnEntry.length);
      expect(additionalLogEntries.includes('TCP_DENIED/407')).toBeTruthy();
    });

    it('fail to run snyk test with proxy due to incorrect config file', async () => {
      const logOnEntry = await getProxyAccessLog();

      // run snyk test
      const args: string[] = [project.path()];
      env['KRB5CCNAME'] = 'FILE:' + path.join(scriptsPath, KRB5_CACHE_FILE);
      env['KRB5_CONFIG'] =
        path.join(scriptsPath, KRB5_CONFIG_FILE) + '_not_existing'; // specifying incorrect config location
      const cli = await runCliWithProxy(env, args);
      await expect(cli).toExitWith(2);

      const logOnExit = await getProxyAccessLog();
      const additionalLogEntries = logOnExit.substring(logOnEntry.length);
      expect(additionalLogEntries.includes('TCP_DENIED/407')).toBeTruthy();
    });
  }
});
