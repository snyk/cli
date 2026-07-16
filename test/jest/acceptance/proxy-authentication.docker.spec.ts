import { unlink } from 'fs';
import * as path from 'path';
import { fakeServer, FakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace, TestProject } from '../util/createProject';
import { getServerPort } from '../util/getServerPort';
import { startCommand, startSnykCLI, TestCLI } from '../util/startSnykCLI';

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
const port = getServerPort(process);
const baseApi = '/api/v1';
const SNYK_API = 'http://' + hostnameFakeServer + ':' + port + baseApi;
const SNYK_API_HTTPS = 'https://snyk.io/api/v1';
const HTTP_PROXY_WITH_USER = 'http://patch:dogsrule@localhost:' + proxyPort;
const HTTP_PROXY = 'http://localhost:' + proxyPort;
const KRB5_CACHE_FILE = 'krb5_cache';
const KRB5_CONFIG_FILE = 'krb5.conf';

function getDockerOptions() {
  return {
    env: {
      ...process.env,
      HTTP_PROXY_PORT: proxyPort,
      PROXY_HOSTNAME: hostnameProxy,
      SNYK_API: SNYK_API,
      CONTAINER_NAME: containerName,
      SCRIPTS_PATH: scriptsPath,
    },
  };
}

async function startProxyEnvironment(): Promise<void> {
  await stopProxyEnvironment();

  const dockerUp = await startCommand(
    'docker',
    ['compose', '--file', dockerComposeFile, 'up', '--build'],
    getDockerOptions(),
  );
  await expect(dockerUp).toDisplay('Kerberos setup complete.', {
    timeout: 60_000,
  });
}

async function stopProxyEnvironment(): Promise<void> {
  const dockerDown = await startCommand(
    'docker',
    ['compose', '--file', dockerComposeFile, 'down'],
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

  return startSnykCLI(temp.join(' '), {
    env: {
      ...env,
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    },
  });
}

jest.setTimeout(1000 * 60);

describe('Proxy Authentication', () => {
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

  it('successfully runs snyk test with proxy (Basic)', async () => {
    const logOnEntry = await getProxyAccessLog();

    const localEnv = env;
    localEnv['HTTP_PROXY'] = HTTP_PROXY_WITH_USER;
    localEnv['HTTPS_PROXY'] = HTTP_PROXY_WITH_USER;
    localEnv['SNYK_API'] = SNYK_API_HTTPS;

    const args: string[] = [project.path(), '-d'];
    const cli = await runCliWithProxy(localEnv, args, 'woof');
    await expect(cli).toExitWith(0);

    const logOnExit = await getProxyAccessLog();
    const additionalLogEntries = logOnExit.substring(logOnEntry.length);
    expect(additionalLogEntries.includes('TCP_TUNNEL/200')).toBeTruthy();
    expect(additionalLogEntries.includes('CONNECT snyk.io:443')).toBeTruthy();
  });
});

describe('Proxy Authentication with Kerberos', () => {
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

  it('fails to run snyk test with an incorrect Kerberos cache configuration', async () => {
    const logOnEntry = await getProxyAccessLog();

    const args: string[] = [project.path()];
    env['KRB5CCNAME'] = 'MEMORY:' + path.join(scriptsPath, KRB5_CACHE_FILE);
    env['KRB5_CONFIG'] = path.join(scriptsPath, KRB5_CONFIG_FILE);
    const cli = await runCliWithProxy(env, args);
    await expect(cli).toExitWith(2);

    const logOnExit = await getProxyAccessLog();
    const additionalLogEntries = logOnExit.substring(logOnEntry.length);
    expect(additionalLogEntries.includes('TCP_DENIED/407')).toBeTruthy();
  });

  it('fails to run snyk test with an incorrect Kerberos config file', async () => {
    const logOnEntry = await getProxyAccessLog();

    const args: string[] = [project.path()];
    env['KRB5CCNAME'] = 'FILE:' + path.join(scriptsPath, KRB5_CACHE_FILE);
    env['KRB5_CONFIG'] =
      path.join(scriptsPath, KRB5_CONFIG_FILE) + '_not_existing';
    const cli = await runCliWithProxy(env, args);
    await expect(cli).toExitWith(2);

    const logOnExit = await getProxyAccessLog();
    const additionalLogEntries = logOnExit.substring(logOnEntry.length);
    expect(additionalLogEntries.includes('TCP_DENIED/407')).toBeTruthy();
  });
});
