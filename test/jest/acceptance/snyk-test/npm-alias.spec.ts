import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { tmpdir } from 'os';
process.env.SNYK_ERR_FILE = tmpdir() + '/tmp_err_file.txt';
jest.setTimeout(1000 * 60);

describe('npm alias support', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  beforeEach(() => {
    process.env.SNYK_ERR_FILE = tmpdir() + '/tmp_err_file.txt';
  });

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      DEBUG: 'snyk*',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('test npm alias v1', async () => {
    const project = await createProject('aliases/npm-lock-v1');

    const { code, stdout } = await runSnykCLI(`test --print-deps`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).not.toContain('pkg @ npm:@yao-pkg/pkg@6.5.0');
    expect(stdout).toContain('@yao-pkg/pkg @ 6.5.0');
  });

  it('test npm alias v2', async () => {
    const project = await createProject('aliases/npm-lock-v2');

    const { code, stdout } = await runSnykCLI(`test --print-deps`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).not.toContain('pkg @ npm:@yao-pkg/pkg@6.5.0');
    expect(stdout).toContain('@yao-pkg/pkg @ 6.5.0');
  });
  it('test npm alias v3', async () => {
    const project = await createProject('aliases/npm-lock-v3');

    const { code, stdout } = await runSnykCLI(`test --print-deps`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).not.toContain('pkg @ npm:@yao-pkg/pkg@6.5.0');
    expect(stdout).toContain('@yao-pkg/pkg @ 6.5.0');
  });

  it('test yarn alias v1', async () => {
    const project = await createProject('aliases/yarn-lock-v1');

    const { code, stdout } = await runSnykCLI(`test --print-deps`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).not.toContain('pkg @ npm:@yao-pkg/pkg@6.5.0');
    expect(stdout).toContain('@yao-pkg/pkg @ 6.5.0');
  });

  it('test yarn alias v2', async () => {
    const project = await createProject('aliases/yarn-lock-v2');

    const { code, stdout } = await runSnykCLI(`test --print-deps`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).not.toContain('pkg @ npm:@yao-pkg/pkg@6.5.0');
    expect(stdout).toContain('@yao-pkg/pkg @ 6.5.0');
  });
});
