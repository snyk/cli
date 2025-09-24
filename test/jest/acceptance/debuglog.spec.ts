import { runSnykCLI } from '../util/runSnykCLI';
import {
  createProject,
  createProjectFromWorkspace,
} from '../util/createProject';

jest.setTimeout(10000 * 60);

describe('debug log', () => {
  const username = 'john.doe@domain.org';
  const password = 'solidpassword';
  const base64EncodedUsername = Buffer.from(username).toString('base64');
  const base64EncodedPassword = Buffer.from(password).toString('base64');

  it('redacts unknown values after end-of-options from args', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');

    const { stderr } = await runSnykCLI(
      `test -d --log-level=trace -- --password=${password} -p ${password} --username ${username} -u=${username}`,
      {
        cwd: project.path(),
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
        },
      },
    );

    expect(stderr).toContain('Using log level: trace');
    expect(stderr).not.toContain(password);
    expect(stderr).not.toContain(username);
    expect(stderr).not.toContain(base64EncodedUsername);
    expect(stderr).not.toContain(base64EncodedPassword);
  });

  it('redacts token from env var', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');
    const token = 'mytoken';

    const { stderr } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        DEBUG: '*',
        SNYK_LOG_LEVEL: 'trace',
        SNYK_TOKEN: token,
        HTTP_PROXY: 'http://user:password@myproxy.com',
      },
    });

    expect(stderr).not.toContain(token);
    expect(stderr).not.toContain('http://user:password@myproxy.com');
  });

  it('redacts token from config file', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');

    const config = await runSnykCLI('config get api');
    const expectedToken = config.stdout.trim();

    const { stderr } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_LOG_LEVEL: 'trace',
      },
    });

    expect(expectedToken).not.toBeFalsy();
    expect(stderr).not.toContain(expectedToken);
  });

  it('redacts basic authentication', async () => {
    const { stderr } = await runSnykCLI(
      `container test ubuntu:latest --username=${username} --password=${password} -d`,
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
        },
      },
    );

    expect(stderr).not.toContain(username);
    expect(stderr).not.toContain(password);
    expect(stderr).not.toContain(base64EncodedUsername);
    expect(stderr).not.toContain(base64EncodedPassword);
  });

  it('redacts short-form basic authentication', async () => {
    const { stderr } = await runSnykCLI(
      `container test ubuntu:latest -u=${username} -p=${password} -d`,
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
        },
      },
    );

    expect(stderr).not.toContain(username);
    expect(stderr).not.toContain(password);
    expect(stderr).not.toContain(base64EncodedUsername);
    expect(stderr).not.toContain(base64EncodedPassword);
  });

  it('redacts ENV-driven basic authentication', async () => {
    const { stderr } = await runSnykCLI('container test ubuntu:latest -d', {
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_REGISTRY_USERNAME: username,
        SNYK_REGISTRY_PASSWORD: password,
      },
    });

    expect(stderr).not.toContain(username);
    expect(stderr).not.toContain(password);
    expect(stderr).not.toContain(base64EncodedUsername);
    expect(stderr).not.toContain(base64EncodedPassword);
  });

  it('redacts basic authentication with trace log level', async () => {
    const { stderr } = await runSnykCLI(
      `container test ubuntu:latest --username=${username} --password=${password} -d`,
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
          SNYK_LOG_LEVEL: 'trace',
        },
      },
    );

    expect(stderr).not.toContain(username);
    expect(stderr).not.toContain(password);
    expect(stderr).not.toContain(base64EncodedUsername);
    expect(stderr).not.toContain(base64EncodedPassword);
  });

  it('redacts short-form basic authentication with trace log level', async () => {
    const { stderr } = await runSnykCLI(
      `container test ubuntu:latest -u=${username} -p=${password} -d`,
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
          SNYK_LOG_LEVEL: 'trace',
        },
      },
    );

    expect(stderr).not.toContain(username);
    expect(stderr).not.toContain(password);
    expect(stderr).not.toContain(base64EncodedUsername);
    expect(stderr).not.toContain(base64EncodedPassword);
  });

  it('redacts ENV-driven basic authentication with trace log level', async () => {
    const { stderr } = await runSnykCLI('container test ubuntu:latest -d', {
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_REGISTRY_USERNAME: username,
        SNYK_REGISTRY_PASSWORD: password,
        SNYK_LOG_LEVEL: 'trace',
      },
    });

    expect(stderr).not.toContain(username);
    expect(stderr).not.toContain(password);
    expect(stderr).not.toContain(base64EncodedUsername);
    expect(stderr).not.toContain(base64EncodedPassword);
  });

  it('redacts externally injected bearer token', async () => {
    const project = await createProject('cocoapods-app');

    const expectedToken = 'my-bearer-token';

    const { stderr } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_LOG_LEVEL: 'trace',
        SNYK_OAUTH_TOKEN: expectedToken,
      },
    });

    expect(expectedToken).not.toBeFalsy();
    expect(stderr).not.toContain(expectedToken);
  });

  it('trace level logs contain body content', async () => {
    const { stderr } = await runSnykCLI('whoami --experimental -d', {
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_LOG_LEVEL: 'trace',
      },
    });

    expect(stderr).toContain('body: ');
  });

  it('debug level logs do not contain body content', async () => {
    const { stderr } = await runSnykCLI('whoami --experimental -d', {
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_LOG_LEVEL: 'debug',
      },
    });

    expect(stderr).not.toContain('body: ');
  });
});
