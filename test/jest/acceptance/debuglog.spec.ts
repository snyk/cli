import { runSnykCLI } from '../util/runSnykCLI';
import {
  createProject,
  createProjectFromWorkspace,
} from '../util/createProject';

jest.setTimeout(10000 * 60);

describe('debug log', () => {
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
      'container test ubuntu:latest --username=us --password=solidpassword -d',
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
        },
      },
    );

    expect(stderr).not.toContain('Basic dXM6c29saWRwYXNzd29yZAo=');
    expect(stderr).toContain('Basic ***');

    expect(stderr).not.toContain('solidpassword');
    expect(stderr).toContain('--password=***');
    expect(stderr).toContain("password: '***'");
  });

  it('redacts short-form basic authentication', async () => {
    const { stderr } = await runSnykCLI(
      'container test ubuntu:latest -u=us -p=solidpassword -d',
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
        },
      },
    );

    expect(stderr).not.toContain('Basic dXM6c29saWRwYXNzd29yZAo=');
    expect(stderr).toContain('Basic ***');

    expect(stderr).not.toContain('solidpassword');
    expect(stderr).toContain('-p=***');
    expect(stderr).toContain("'p=***'");
  });

  it('redacts ENV-driven basic authentication', async () => {
    const { stderr } = await runSnykCLI('container test ubuntu:latest -d', {
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_REGISTRY_USERNAME: 'us',
        SNYK_REGISTRY_PASSWORD: 'solidpassword',
      },
    });

    expect(stderr).not.toContain('Basic dXM6c29saWRwYXNzd29yZAo=');
    expect(stderr).toContain('Basic ***');
  });

  it('redacts basic authentication with trace log level', async () => {
    const { stderr } = await runSnykCLI(
      'container test ubuntu:latest --username=us --password=solidpassword -d',
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
          SNYK_LOG_LEVEL: 'trace',
        },
      },
    );

    expect(stderr).not.toContain('Basic dXM6c29saWRwYXNzd29yZAo=');
    expect(stderr).toContain('Basic ***');

    expect(stderr).not.toContain('solidpassword');
    expect(stderr).toContain('--password=***');
    expect(stderr).toContain("password: '***'");
    expect(stderr).toContain('"password": "***"');
  });

  it('redacts short-form basic authentication with trace log level', async () => {
    const { stderr } = await runSnykCLI(
      'container test ubuntu:latest -u=us -p=solidpassword -d',
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
          SNYK_LOG_LEVEL: 'trace',
        },
      },
    );

    expect(stderr).not.toContain('Basic dXM6c29saWRwYXNzd29yZAo=');
    expect(stderr).toContain('Basic ***');

    expect(stderr).not.toContain('solidpassword');
    expect(stderr).toContain('-p=***');
    expect(stderr).toContain("'p=***'");
    expect(stderr).toContain('"p": "***"');
  });

  it('redacts ENV-driven basic authentication with trace log level', async () => {
    const { stderr } = await runSnykCLI('container test ubuntu:latest -d', {
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_REGISTRY_USERNAME: 'us',
        SNYK_REGISTRY_PASSWORD: 'solidpassword',
        SNYK_LOG_LEVEL: 'trace',
      },
    });

    expect(stderr).not.toContain('Basic dXM6c29saWRwYXNzd29yZAo=');
    expect(stderr).toContain('Basic ***');

    expect(stderr).not.toContain('solidpassword');
    expect(stderr).toContain('"REGISTRY_PASSWORD": "***"');
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
    expect(stderr).toContain('Bearer ***');
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
