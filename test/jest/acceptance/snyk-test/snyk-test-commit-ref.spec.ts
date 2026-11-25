import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runCommand } from '../../util/runCommand';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

// The new Test API flow only runs for projects it can attribute to a
// repository, so the rollout flag and a git remote are both required.
const NEW_TEST_API_FLOW_FF = 'internal_snyk_cli_rollout_dfly_os_cli';

describe('`snyk test` reports the tested commit to the new Test API', () => {
  let server;
  let env: Record<string, string>;
  let cleanups: Array<() => Promise<void> | void> = [];

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/v1';
    const fakeServerIp = getFirstIPv4Address();
    env = {
      ...process.env,
      SNYK_API: `http://${fakeServerIp}:${port}${baseApi}`,
      SNYK_HOST: `http://${fakeServerIp}:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  beforeEach(() => {
    server.setFeatureFlag(NEW_TEST_API_FLOW_FF, true);
  });

  afterEach(async () => {
    server.restore();
    await Promise.all(cleanups.map((cleanup) => cleanup()));
    cleanups = [];
  });

  afterAll((done) => {
    server.close(() => done());
  });

  async function git(cwd: string, ...args: string[]): Promise<string> {
    const result = await runCommand(
      'git',
      [
        '-c',
        'user.name=snyk-test',
        '-c',
        'user.email=snyk-test@example.com',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd },
    );
    if (result.code !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    }
    return result.stdout.trim();
  }

  async function createGitProject(): Promise<{
    dir: string;
    headCommit: string;
  }> {
    const project = await createProjectFromWorkspace('npm-package');
    const dir = project.path();
    cleanups.push(() => project.remove());
    await git(dir, 'init');
    await git(dir, 'add', 'package.json', 'package-lock.json');
    await git(dir, 'commit', '-m', 'initial');
    await git(dir, 'remote', 'add', 'origin', 'https://github.com/acme/repo');
    return { dir, headCommit: await git(dir, 'rev-parse', 'HEAD') };
  }

  async function runSnykTest(cwd: string, args: string) {
    // A clean home keeps GAF off any locally stored token that would
    // override SNYK_API; Windows resolves home from USERPROFILE, not HOME.
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-commit-ref-'));
    cleanups.push(() => fs.rmSync(home, { recursive: true, force: true }));
    const { code, stdout, stderr } = await runSnykCLI(args, {
      cwd,
      env: { ...env, HOME: home, USERPROFILE: home },
    });
    if (code !== 0) {
      throw new Error(
        `snyk ${args} exited with ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
      );
    }
  }

  function submittedScmContexts(): unknown[] {
    return server
      .getRequests()
      .filter(
        (req) =>
          req.method === 'POST' &&
          /^\/rest\/orgs\/[^/]+\/tests$/.test(req.path),
      )
      .flatMap((req) => req.body?.data?.attributes?.resources ?? [])
      .map((item) => item.resource?.scm_context);
  }

  it('tests the HEAD commit of the repository by default', async () => {
    const { dir, headCommit } = await createGitProject();

    await runSnykTest(dir, 'test');

    expect(submittedScmContexts()).toEqual([
      expect.objectContaining({ commit_ref: headCommit }),
    ]);
  });

  it('tests the commit given with --commit-id instead of HEAD', async () => {
    const { dir, headCommit } = await createGitProject();
    const commitId = '0123456789abcdef0123456789abcdef01234567';
    expect(commitId).not.toEqual(headCommit);

    await runSnykTest(dir, `test --commit-id ${commitId}`);

    expect(submittedScmContexts()).toEqual([
      expect.objectContaining({ commit_ref: commitId }),
    ]);
  });
});
