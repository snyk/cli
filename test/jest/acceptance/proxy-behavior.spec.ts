import { runSnykCLI } from '../util/runSnykCLI';
import { isCLIV2 } from '../util/isCLIV2';
import { fakeServer, FakeServer } from '../../../test/acceptance/fake-server';
import * as path from 'path';
import {
  createProjectFromWorkspace,
  TestProject,
} from '../../../test/jest/util/createProject';
import {
  startCommand,
  TestCLI,
  startSnykCLI,
} from '../../../test/jest/util/startSnykCLI';
import { unlink } from 'fs';
import { execSync } from 'child_process';
import * as os from 'os';

const fakeServerPort = 12345;
const SNYK_API_HTTPS = 'https://snyk.io/api/v1';
const SNYK_API_HTTP = 'http://snyk.io/api/v1';
const FAKE_HTTP_PROXY = `http://localhost:${fakeServerPort}`;

function getConnectionRefusedRegExp(): string | RegExp {
  // When running this test against a v2 artifact, we need to look for a message like:
  //   - locally (darwin_amd64): `Cannot read TLS response from mitm'd server proxyconnect tcp: dial tcp 127.0.0.1:12345: connect: connection refused`
  //   - on Windows in CirclCI: `Cannot read TLS response from mitm'd server proxyconnect tcp: dial tcp [::1]:12345: connectex: No connection could be made because the target machine actively refused it`
  //   - on some other systems in CirclCI: `Cannot read TLS response from mitm'd server proxyconnect tcp: dial tcp [::1]:12345: connect: connection refused`
  // Here is a regex that matches any of these scenarios:
  const cliv2MessageRegex = new RegExp(
    `connectex: No connection could be made|connection.*refused`,
  );
  // When running this for v1, the message is more predictable:
  // `Error: connect ECONNREFUSED 127.0.0.1:${fakeServerPort}`
  const expectedMessageRegex = isCLIV2()
    ? cliv2MessageRegex
    : `Error: connect ECONNREFUSED 127.0.0.1:${fakeServerPort}`;

  return expectedMessageRegex;
}

// Global test configuration
const rootDir = path.resolve(path.join(__dirname, '..', '..'));
const squidEnvironmentPath = path.resolve(
  path.join(rootDir, 'fixtures', 'squid_environment'),
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
const HTTP_PROXY_WITH_USER = 'http://patch:dogsrule@localhost:' + proxyPort;
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
    execSync('docker ps');
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
  if (!isDockerAvailable()) {
    // eslint-disable-next-line jest/no-focused-tests
    it('These tests are currently limited to certain environments.', () => {
      console.warn(
        'Skipping CLIv2 test. These tests are limited to environments that have docker and docker-compose installed.',
      );
    });
    return false;
  }
  return true;
}

jest.setTimeout(1000 * 60 * 1);
describe('Proxy configuration behavior', () => {
  describe('*_PROXY against HTTPS host', () => {
    it('tries to connect to the HTTPS_PROXY when HTTPS_PROXY is set', async () => {
      const { code, stderr } = await runSnykCLI(`woof --debug`, {
        env: {
          ...process.env,
          HTTPS_PROXY: FAKE_HTTP_PROXY,
          SNYK_API: SNYK_API_HTTPS,
        },
      });

      expect(code).toBe(0);

      // It will *attempt* to connect to a FAKE_HTTP_PROXY (and fails, because it's not a real proxy server)
      const expectedMessageRegex = getConnectionRefusedRegExp();
      expect(stderr).toMatch(expectedMessageRegex);
    });

    it('uses NO_PROXY to avoid connecting to the HTTPS_PROXY that is set', async () => {
      const { code, stderr } = await runSnykCLI(`woof --debug`, {
        env: {
          ...process.env,
          NO_PROXY: 'snyk.io',
          HTTPS_PROXY: FAKE_HTTP_PROXY,
          SNYK_API: SNYK_API_HTTPS,
        },
      });

      expect(code).toBe(0);

      const expectedMessageRegex = getConnectionRefusedRegExp();
      expect(stderr).not.toMatch(expectedMessageRegex);
    });

    it('does not try to connect to the HTTP_PROXY when it is set', async () => {
      const { code, stderr } = await runSnykCLI(`woof -d`, {
        env: {
          ...process.env,
          HTTP_PROXY: FAKE_HTTP_PROXY,
          SNYK_API: SNYK_API_HTTPS,
        },
      });

      expect(code).toBe(0);

      // It will *not attempt* to connect to a proxy and /analytics call won't fail
      expect(stderr).not.toContain('ECONNREFUSED');
    });
  });

  describe('*_PROXY against HTTP host', () => {
    it('tries to connect to the HTTP_PROXY when HTTP_PROXY is set', async () => {
      const { code, stderr } = await runSnykCLI(`woof -d`, {
        env: {
          ...process.env,
          HTTP_PROXY: FAKE_HTTP_PROXY,
          SNYK_API: SNYK_API_HTTP,
          SNYK_HTTP_PROTOCOL_UPGRADE: '0',
        },
      });

      expect(code).toBe(0);

      // It will *attempt* to connect to a FAKE_HTTP_PROXY (and fails, because it's not a real proxy server)
      const expectedMessageRegex = getConnectionRefusedRegExp();
      expect(stderr).toMatch(expectedMessageRegex);
    });

    if (!isCLIV2()) {
      // This scenario should actually work, an http request should directly go through and not hit the proxy if protocol upgrade is disabled.
      it('needle behavior - only HTTPS Proxy is set but HTTP request (without protocol upgrade) fails.', async () => {
        const { code, stderr } = await runSnykCLI(`woof -d`, {
          env: {
            ...process.env,
            HTTPS_PROXY: FAKE_HTTP_PROXY,
            SNYK_API: SNYK_API_HTTP,
            SNYK_HTTP_PROTOCOL_UPGRADE: '0',
          },
        });

        expect(code).toBe(2);

        // Incorrect behavior when Needle tries to upgrade connection after 301 http->https and the Agent option is set to a strict http/s protocol.
        // See lines with `keepAlive` in request.ts for more details
        expect(stderr).toContain(
          'TypeError [ERR_INVALID_PROTOCOL]: Protocol "https:" not supported. Expected "http:"',
        );
      });
    }
  });
});

jest.setTimeout(1000 * 60 * 1);
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

    if (isCLIV2()) {
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

      it('successfully runs snyk test with proxy (AnyAuth)', async () => {
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

    it('successfully runs snyk test with proxy (Basic)', async () => {
      const logOnEntry = await getProxyAccessLog();

      const localEnv = env;
      localEnv['HTTP_PROXY'] = HTTP_PROXY_WITH_USER;
      localEnv['HTTPS_PROXY'] = HTTP_PROXY_WITH_USER;
      localEnv['SNYK_API'] = SNYK_API_HTTPS;

      // run snyk test
      const args: string[] = [project.path(), '-d'];
      const cli = await runCliWithProxy(localEnv, args, 'woof');
      await expect(cli).toExitWith(0);

      const logOnExit = await getProxyAccessLog();
      const additionalLogEntries = logOnExit.substring(logOnEntry.length);
      expect(additionalLogEntries.includes('TCP_TUNNEL/200')).toBeTruthy();
      expect(additionalLogEntries.includes('CONNECT snyk.io:443')).toBeTruthy();
    });
  }
});

describe('Proxy Authentication (Non-Windows)', () => {
  if (canTestRun() && !os.platform().includes('win32') && isCLIV2()) {
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
