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

  it('test npm alias v1 - print-deps no json warning msg', async () => {
    const project = await createProject('aliases/npm-lock-v1');

    const { code, stderr } = await runSnykCLI(`test --print-deps`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stderr).toContain(
      '--print-deps option not yet supported for large projects or with aliases. Try with --json.',
    );
  });

  it('test npm alias v1 --json', async () => {
    const project = await createProject('aliases/npm-lock-v1');

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('"aliasTargetDepName": "@yao-pkg/pkg"');
    expect(stdout).toContain('"name": "@yao-pkg/pkg",');
    expect(stdout).toContain('"version": "npm:@yao-pkg/pkg@6.5.0",');
  });

  it('test npm alias v2', async () => {
    const project = await createProject('aliases/npm-lock-v2');

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('"pkgId": "@yao-pkg/pkg@6.5.0",');
    expect(stdout).toContain('"nodeId": "pkg@6.5.0",');

    expect(stdout).toContain('"alias": "pkg=>@yao-pkg/pkg@6.5.0"');
  });

  it('test npm alias v3', async () => {
    const project = await createProject('aliases/npm-lock-v3');

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('"pkgId": "@yao-pkg/pkg@6.5.0",');
    expect(stdout).toContain('"nodeId": "pkg@6.5.0",');
    expect(stdout).toContain('"alias": "pkg=>@yao-pkg/pkg@6.5.0"');
  });

  it('test npm alias v1 - multiple versions of same package via aliasing', async () => {
    const project = await createProject(
      'aliases/alias-multiple-versions/npm-lock-v1',
    );

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(stdout).toContain('"name": "hello-world-npm",');
    expect(stdout).toContain('"name": "hello-world-npm",');
    expect(stdout).toContain('"version": "npm:hello-world-npm@1.1.1"');
    expect(stdout).toContain('"aliasName": "hello-world-npm"');
    expect(stdout).toContain('"aliasTargetDepName": "hello-world-npm"');
    expect(stdout).toContain('"aliasName": "hello-world-npm-v1_1_1"');
  });

  it('test npm alias v2 - multiple versions of same package via aliasing', async () => {
    const project = await createProject(
      'aliases/alias-multiple-versions/npm-lock-v2',
    );

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(stdout).toContain('"pkgId": "hello-world-npm@1.1.0",');
    expect(stdout).toContain('"nodeId": "hello-world-npm@1.1.0",');
    expect(stdout).toContain('"nodeId": "hello-world-npm-v1_1_1@1.1.1",');
    expect(stdout).toContain('"pkgId": "hello-world-npm@1.1.1",');

    expect(stdout).toContain(
      '"alias": "hello-world-npm=>hello-world-npm@1.1.0"',
    );
    expect(stdout).toContain(
      '"alias": "hello-world-npm-v1_1_1=>hello-world-npm@1.1.1"',
    );
  });

  it('test npm alias v3 - multiple versions of same package via aliasing', async () => {
    const project = await createProject(
      'aliases/alias-multiple-versions/npm-lock-v3',
    );

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).toContain('"pkgId": "hello-world-npm@1.1.0",');
    expect(stdout).toContain('"nodeId": "hello-world-npm@1.1.0",');
    expect(stdout).toContain('"nodeId": "hello-world-npm-v1_1_1@1.1.1",');
    expect(stdout).toContain('"pkgId": "hello-world-npm@1.1.1",');

    expect(stdout).toContain(
      '"alias": "hello-world-npm=>hello-world-npm@1.1.0"',
    );
    expect(stdout).toContain(
      '"alias": "hello-world-npm-v1_1_1=>hello-world-npm@1.1.1"',
    );
  });

  it('test yarn alias v1', async () => {
    const project = await createProject('aliases/yarn-lock-v1');

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);
    expect(stdout).toContain('"pkgId": "@yao-pkg/pkg@6.5.0",');
    expect(stdout).toContain('"nodeId": "pkg@6.5.0",');
    expect(stdout).toContain('"alias": "pkg=>@yao-pkg/pkg@6.5.0"');
  });

  it('test yarn alias v2', async () => {
    const project = await createProject('aliases/yarn-lock-v2');

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).toContain('"pkgId": "@yao-pkg/pkg@6.5.0",');
    expect(stdout).toContain('"nodeId": "pkg@6.5.0",');
    expect(stdout).toContain('"alias": "pkg=>@yao-pkg/pkg@6.5.0"');
  });

  it('test npm override with alias syntax', async () => {
    const project = await createProject('npm-package-with-override-alias');

    const { code, stdout } = await runSnykCLI(`test --print-deps --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    // The test passes if dry-uninstall is present as expected
    // (proving the alias override is working)
    expect(stdout).toContain('dry-uninstall');
    expect(stdout).toContain('0.3.0');
  });
});
