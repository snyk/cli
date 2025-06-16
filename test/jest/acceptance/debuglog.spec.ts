import { runSnykCLI } from '../util/runSnykCLI';
import {
  createProject,
  createProjectFromWorkspace,
} from '../util/createProject';

jest.setTimeout(1000 * 60);

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
      'container test ubuntu:latest --username=us --password=pw -d',
      {
        env: {
          ...process.env,
          SNYK_DISABLE_ANALYTICS: '1',
          SNYK_LOG_LEVEL: 'trace',
        },
      },
    );

    // this test only makes sense when Basic auth would be expected, otherwise the checks below
    if (stderr.includes('Basic ')) {
      expect(stderr).not.toContain('Basic dXM6cHc=');
      expect(stderr).toContain('Basic ***');
    }
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
